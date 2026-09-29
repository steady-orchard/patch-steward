# ADR-0085: Container hardening profile and checkout delivery

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §4, §12, §13; `docs/processes.md` SP17; `docs/user-manual/configuration.md` "Runner"

## Context and Problem Statement

Invariant 3 and the sandbox zone require a sandbox with nothing beyond a copied checkout and scratch space. The exact flag set, how the checkout enters the container, and where scratch space lives were open.

## Decision Drivers

- Submitted code must see no host environment, token, socket, or host path.
- Memory, process, CPU, and time limits must hold for every execution.
- The profile must behave the same under Docker and Podman wherever the runtimes allow, and differ visibly where they do not.

## Considered Options

- A fixed hardening profile with the checkout copied into a labeled volume at `/work`, a read-only root filesystem, and a sized `/tmp` tmpfs
- Bind-mounting a host checkout
- Copying the checkout into a tmpfs
- The runtime's default container settings

## Decision Outcome

Chosen option: "A fixed hardening profile with the checkout copied into a labeled volume at `/work`, a read-only root filesystem, and a sized `/tmp` tmpfs", because it leaves the container with no mount beyond the copied checkout and scratch space. A bind mount was rejected because it exposes host paths. A tmpfs checkout was rejected because it would count the whole checkout against memory. Runtime defaults were rejected because they keep capabilities, a writable root, and the network.

Lifecycle: create a labeled volume; create the container; copy the checkout archive from standard input into `/work` with the runtime's `cp` (no bind mount); `start -a` with standard input closed and output streamed; `inspect` for the exit code and OOM kill; copy each declared result file out as a tar stream on standard output; `rm -f` the container and remove the volume, always, even after failures (a cleanup failure after a 30000 ms grace is `runner.cleanup-failed`).

Create flags: labels `org.patch-steward.managed=true` and `org.patch-steward.run=<run id>`; `--platform linux/amd64 --pull never`; `--user 65532:65532 --read-only`; `--network none` (omitted only for the dependency step); `--cap-drop ALL --security-opt no-new-privileges`; `--pids-limit <runner.resources.pids> --memory <memory_mb>m --memory-swap <memory_mb>m --cpus <cpus>`; `--ulimit core=0:0 --ipc private --cgroupns private --hostname patch-steward --log-driver none`; `--tmpfs /tmp:rw,exec,nosuid,nodev,size=<runner.resources.scratch_mb>m,mode=1777`; `--mount type=volume,src=<volume>,dst=/work,volume-nocopy` under Docker and `--mount type=volume,src=<volume>,dst=/work` under Podman; `--workdir /work/checkout[/<working_directory>]`; `--env HOME=/tmp --env TMPDIR=/tmp --env CI=true`; `--entrypoint <run[0]>`, the image by digest or id, then `run[1..]`. Podman also gets `--read-only-tmpfs=false`, because otherwise Podman mounts unbounded tmpfs on `/run`, `/var/tmp`, and others.

Never in any argument vector: `-v`, `--volume`, a bind mount, any host path, `--privileged`, `--cap-add`, `--device`, unconfined seccomp or AppArmor, `label=disable`, `--env-file`, an `--env NAME` without a value, the host network, PID, IPC, user, or UTS namespace, another container's network, `-i`, `-t`, `--init`, `--add-host`, `--group-add`, `--sysctl`, `--gpus`, a socket path. Data enters and leaves only through `cp` streams. The result is a container with no host environment, no tokens, no runtime socket, and no mounts beyond the copied checkout (`/work/checkout` on the volume) and the `/tmp` scratch tmpfs; it runs as the non-root user 65532 with no capabilities and no new privileges, with the network disabled. Runtime-generated files (`/etc/hostname`, `/etc/hosts`, `/etc/resolv.conf`, and the pseudo-filesystems `/proc`, `/sys`, `/dev`, `/dev/shm`, `/dev/mqueue`, cgroup) are inherent to a container and are not host mounts.

Capture: standard output and standard error are read as one stream in arrival order; the first `limits.execution.output_head_bytes` and the last `limits.execution.output_tail_bytes` are kept; reading continues until exit or until `limits.execution.output_stream_bytes` have been read, which stops the execution (recorded `output_limited`). Text is decoded as UTF-8 with U+FFFD replacement, omitted bytes are marked `[... <n> bytes omitted ...]`, and control characters stay data and are escaped wherever rendered.

Time: a steward timer per execution (`limits.execution.execution_seconds`, or `limits.execution.dependency_step_seconds` for the dependency step) kills the container and records `timed_out`; `limits.execution.container_start_seconds` bounds volume creation, container creation, copy-in, and start until attached. A memory kill is recorded `oom_killed`. `timed_out`, `oom_killed`, and `output_limited` are results, not environment failures; an entrypoint that cannot start (for example an executable not found) is the environment failure `runner.start-failed`. Everything the steward creates carries `org.patch-steward.managed=true`; it removes only its own labeled containers and volumes, and images are kept.

Podman-only rules (Docker behavior unchanged):

- `/work` mount: Podman has no no-copy volume option, so its `/work` volume is mounted without one, and Podman would copy image content found at `/work` into the volume. Under Podman only, every image the runner uses must therefore have `/work` absent or an empty directory. The runner checks this once per image per run, after pull, build, or cache hit and before any volume or execution container exists for that image: it creates a probe container that is never started (`--entrypoint /bin/true`, no mount, no environment, network none, the same user and hardening flags), copies its `/work` out, inspects the tar stream, and removes the probe. A non-empty `/work` is refused, not neutralized: the run ends with the environment failure `runner.create-failed` and the message `image-work-not-empty` (outcome `inconclusive`). A failing probe copy is `runner.copy-failed`. The probe is not an execution: it counts against no execution budget and produces no execution record. Under Docker the volume is mounted with `volume-nocopy`, so image content at `/work` never reaches the volume, and no probe runs.
- Generated files: Podman adds `/etc/passwd`, `/etc/group`, `/run/.containerenv`, and `/run/secrets` inside the container. These are runtime-generated container files, not host mounts, and are permitted under Podman only (exact mount points, nothing below them); `/run/secrets` must be empty or absent. Docker's permitted set stays `/etc/hostname`, `/etc/hosts`, and `/etc/resolv.conf`.
- Capabilities: with `--cap-drop ALL`, Podman's inspected `HostConfig.CapDrop` shows its default capability list rather than `ALL`, so under Podman the proof of no capabilities is the five capability masks `CapInh`, `CapPrm`, `CapEff`, `CapBnd`, and `CapAmb` in `/proc/self/status` all being zero. Under Docker the inspected `CapDrop` is `ALL` and `CapEff` is zero.

### Consequences

- The `/work` volume has no portable disk quota, so writes under `/work/checkout` during an execution are bounded only by time (`limits.execution.execution_seconds`, or `limits.execution.dependency_step_seconds` for the dependency step), and the dependency step's exported copy by `limits.execution.prepared_checkout_bytes`.
- The `/tmp` tmpfs is sized by `runner.resources.scratch_mb`, and its pages count against `runner.resources.memory_mb`.
- The mount check differs per runtime, so Podman evidence is checked against a wider allow-list than Docker's; nothing else is relaxed.
- The Podman `/etc/passwd` and `/etc/group` are runtime-generated (an entry for user 65532 may be added), and `/run/.containerenv` exposes container metadata (engine, container name and id, image) to submitted code; none of it is a host secret.
- A Podman default mount configured in the host's `mounts.conf` would place host data under `/run/secrets`; the check fails rather than permits it, and the operator empties those default mounts.
- Under Podman the inspected `CapDrop` is no evidence, and the five zero masks are the only capability proof.
- An image with content at `/work` runs under Docker but is refused under Podman, so the runtime choice can decide whether a policy's runner image is usable.
- Runner images meant for Podman must leave `/work` absent or empty (for example no `WORKDIR /work/...` and no `COPY` into `/work`).
- The probe adds one never-started container, one copy, and one removal per image per run under Podman.
- The guarantee rests on the image being immutable between probe and execution (the same digest or id reference), not on a mount option.

## More Information

- The project owner decided this on September 28, 2026.
- The Podman-only mount, capability, and `/work` rules were decided on October 23, 2026, after measurements with Podman 6.1.
- [ADR-0084](0084-container-runtimes-host-platforms-and-container-tier.md) records the runtimes, hosts, and test tier; [ADR-0006](0006-sandbox-model.md) records the sandbox model.
