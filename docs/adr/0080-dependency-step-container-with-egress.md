# ADR-0080: Dependency step in its own container with egress

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §8, §12, §13; `docs/processes.md` SP17; `docs/user-manual/configuration.md` "Runner"

## Context and Problem Statement

The policy's `runner.network` is `none`, with egress only for a declared `runner.dependency_step`. How that step runs and how its result reaches the network-none executions was open (architecture §15, network policy for dependency installation). Most projects need packages installed before tests can run, while the executions that run submitted tests must have no network.

## Considered Options

- A policy-declared dependency step in its own container with egress, then network-none execution containers on its prepared copy
- No network at all: dependencies must be in the runner image
- Egress for every execution container
- An egress allowlist or filtering proxy

## Decision Outcome

Chosen option: "A policy-declared dependency step in its own container with egress, then network-none execution containers on its prepared copy", because only the install step needs the network and every other execution keeps the strictest sandbox. No network at all was rejected because it forces every project to bake dependencies into an image before any screening. Egress for every execution was rejected because the tests themselves could then reach the network and results would depend on it. An allowlist or proxy was rejected because it needs infrastructure on every host that the runtimes do not portably provide.

The policy key `runner.dependency_step` is null or `{run, working_directory}`. The step runs first, in its own container on the materialized copy, with the runtime's default network (unrestricted egress), no credentials, the same non-root user and resource limits, bounded by `limits.execution.dependency_step_seconds`. Afterwards `/work/checkout` is exported from its volume as a tar stream bounded by `limits.execution.prepared_checkout_bytes` (`runner.prepared-copy-too-large`), kept as a host temp file, never extracted on the host, and copied into each network-none execution container. Execution containers always run with network `none`.

The step is recorded as an execution record (`kind: dependency-step`, network `egress`) and counts against `limits.execution.executions_per_run` and `limits.execution.run_execution_seconds`. A non-zero exit or a timeout is the environment failure `runner.dependency-step-failed`: the plan stops and the run ends `inconclusive`, never as a failing result.

Stated risk: submitted install scripts reach whatever the host network reaches (the internet, the local network, link-local metadata endpoints, `host.docker.internal` on Docker Desktop), but the container holds nothing to exfiltrate. Version 1 does not block these destinations.

### Consequences

- The step counts against the execution count and the run time budget like any execution.
- Failure or timeout is `runner.dependency-step-failed`, an environment failure that ends the run `inconclusive`.
- The prepared copy is bounded by `limits.execution.prepared_checkout_bytes` and is never extracted on the host.
- Install scripts can reach the host's networks, including `host.docker.internal` on Docker Desktop; the accepted mitigation is that the container holds no credentials or secrets.
- Dependencies are preferably baked into a runner image built from the trusted branch ([ADR-0079](0079-runner-image-sources-and-local-build-cache.md)), which needs no dependency step.
- The architecture no longer lists the dependency-step network policy as open.

## More Information

- The project owner decided this on September 28, 2026.
- Related: [ADR-0006](0006-sandbox-model.md), [ADR-0082](0082-no-services-for-reproductions.md), [ADR-0085](0085-container-hardening-profile-and-checkout-delivery.md).
