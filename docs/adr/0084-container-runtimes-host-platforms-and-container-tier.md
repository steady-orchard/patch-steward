# ADR-0084: Container runtimes, host platforms, and the container test tier

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §6.1, §6.3, §12; `docs/user-manual/installation.md` "Prerequisites"; `docs/user-manual/commands.md` "Development commands"

## Context and Problem Statement

The sandbox model ([ADR-0006](0006-sandbox-model.md)) names local Docker or Podman containers for maintainer screening. Which runtimes are supported, how the steward drives them, which host platforms are supported, and how the container tier is tested were open.

## Decision Drivers

- Submitted code must never reach a host path, a runtime socket, or a host secret.
- Resource limits must be enforced, never silently dropped.
- Maintainers run either runtime, on Linux, Windows, or macOS.
- The unit and fixture tiers must stay independent of any runtime or network.

## Considered Options

- Docker and Podman, each driven through its command-line binary by argument vector, detected automatically (Docker first) or chosen by a flag; Linux containers only
- Docker only
- A runtime socket API or SDK
- Bind-mounting the checkout instead of copying it in

## Decision Outcome

Chosen option: "Docker and Podman, each driven through its command-line binary by argument vector, detected automatically (Docker first) or chosen by a flag; Linux containers only", because the command line is the narrowest interface both runtimes share and it needs no dependency and no shell. Docker only was rejected because it excludes hosts that run Podman. A runtime socket API or SDK was rejected because it adds a dependency and a privileged daemon channel that the steward would then have to secure. Bind-mounting the checkout was rejected because it exposes a host path to submitted code; data enters and leaves only through copy streams (see [ADR-0085](0085-container-hardening-profile-and-checkout-delivery.md) for the profile).

Runtime selection is `auto` by default: `docker version --format json`, then `podman version --format json`; the first whose validated output reports a server is used, and none gives `runner.runtime-unavailable`. An explicit `--container-runtime docker` or `podman` uses only that runtime. The server OS must be `linux` (`runner.runtime-not-linux`, for example Docker Desktop in Windows-containers mode), and every container runs `--platform linux/amd64` (emulated on arm64 hosts), so only Linux containers exist.

Limits must be enforceable. Podman must report cgroup v2 with the `cpu`, `memory`, and `pids` controllers; Docker must report no missing memory, CPU, or pids limit support; a runtime warning about an ignored limit at container creation also fails. All give `runner.limits-unenforceable`. The recorded identity is the runtime name, client version, server version, and server OS and architecture.

The runtime CLI process gets a minimal environment: only `PATH`, `SystemRoot`, `windir`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP`, `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `ProgramData`, `ProgramFiles`, `XDG_RUNTIME_DIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `DOCKER_HOST`, `DOCKER_CONTEXT`, `DOCKER_CONFIG`, `DOCKER_CERT_PATH`, `DOCKER_TLS_VERIFY`, `CONTAINER_HOST`, `CONTAINER_CONNECTION`, `CONTAINERS_CONF`, `CONTAINERS_STORAGE_CONF`, and `REGISTRY_AUTH_FILE`, each only when set.

Supported hosts are Linux; Windows with Docker Desktop (WSL2) or a Podman machine; and macOS with Docker Desktop or a Podman machine. On Windows the Podman client cannot stream `podman cp <container>:<path> -` to standard output, so the runner falls back to `podman volume export <volume>` (result files and the prepared dependency-step copy) and `podman export <container>` (the Podman `/work` probe), validated like every runtime argument vector. Native Linux Podman uses `cp -` unchanged.

The container tier is `pnpm test:container`, which runs `vitest run --config vitest.container.config.ts` over the `packages/*/src/**/*.container.test.ts` files, with `@patch-steward/core` aliased to its sources, no file parallelism, and 300000 ms test and hook timeouts. Tests read `STEWARD_CONTAINER_RUNTIME` (`docker` or `podman`, default `docker`) and fail, never skip, when that runtime is unavailable; for example `STEWARD_CONTAINER_RUNTIME=podman pnpm test:container`. `pnpm test` is unchanged and never needs a runtime or network; the root `vitest.config.ts` still excludes the container and live suffixes. Test images are public images pinned by digest (a Node 24 slim image and a minimal shell image), pulled anonymously. Everything a test creates carries the label `org.patch-steward.test=<nonce>` and is removed afterwards; the leak checks `docker ps -a --filter label=org.patch-steward.test -q`, `docker volume ls -q --filter label=org.patch-steward.test`, and `docker image ls -q --filter label=org.patch-steward.test` print nothing (the same with `podman`).

In CI, `.github/workflows/ci.yml` job `container-tests` (name `Container tests / <runtime>`, `ubuntu-latest`, matrix `runtime: [docker, podman]`, `fail-fast: false`, the same triggers as `build-and-test`, `permissions: contents: read`, no secrets) installs with the frozen lockfile, runs `pnpm test:container` with `STEWARD_CONTAINER_RUNTIME` set to the matrix runtime, and then runs the label leak checks.

### Consequences

- Verified on Windows with Docker Desktop and with a Podman machine, and on Ubuntu with Docker (the CI container job run locally); the CI Podman leg has not run on GitHub yet; macOS is supported but untested.
- The CI Podman leg first runs on GitHub. If rootless Podman cannot enforce limits on a CI runner, only a test-only runtime-command override may run rootful Podman; product code never escalates privileges.
- The Windows Podman copy fallback (`podman volume export`, `podman export`) is part of the runner and is covered by the same validation as every other argument vector.
- `pnpm test` never needs a runtime, and container-tier tests fail, never skip, without the runtime.
- The placement of [ADR-0021](0021-test-tiers-and-ci-placement.md) holds: the unit and fixture tiers still run on Ubuntu and Windows, and the container tier runs in CI on Ubuntu only.
- Invariant 3 has its first conformance checks: exact create argument vectors per runtime, a forbidden-argument scan over every argument vector the runner builds, the runtime CLI environment allowlist, and the rule that only the CLI preflight module constructs the unsandboxed runner. In core only `process/`, `git/`, `materialize/`, and `runner/` spawn processes.

## More Information

- The project owner decided this on September 28, 2026.
- [ADR-0085](0085-container-hardening-profile-and-checkout-delivery.md) records the container profile and checkout delivery.
