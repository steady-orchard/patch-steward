# ADR-0082: No services for reproductions in version 1

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/processes.md` SP09; `docs/architecture.md` §12; `docs/user-manual/configuration.md` "Runner"

## Context and Problem Statement

SP09 left open whether a policy may declare allowed services for reproductions, such as a database or a message broker started next to the container that runs the reproduction. Execution containers run with network `none`, so any service would need its own container and a controlled connection to the execution container.

## Considered Options

- No services: one container per execution with network `none`; a reproduction that needs network or services ends `inconclusive` with a request to reduce it
- A policy key declaring allowed services (sidecar containers) for reproductions
- Network access for reproductions

## Decision Outcome

Chosen option: "No services: one container per execution with network `none`; a reproduction that needs network or services ends `inconclusive` with a request to reduce it", because it keeps the sandbox boundary simple and uniform across runtimes. Sidecars were rejected because they need container-to-container networking, more lifecycle and cleanup, and service images the policy would have to pin and validate. Network access was rejected because it breaks the sandbox.

Each execution uses exactly one container, always with network `none`. The only network use is the dependency step ([ADR-0080](0080-dependency-step-container-with-egress.md)), which is not a reproduction. A reproduction that needs network or services cannot be run, so its run ends `inconclusive` with a request to the submitter to reduce the reproduction. There is no policy key for allowed services.

### Consequences

- The SP09 open item closes as not supported.
- No policy key is reserved for services.
- Such reproductions end `inconclusive`, never "not reproduced", because the absence of a service is an environment limit and not evidence about the claim.

## More Information

- The project owner decided this on September 28, 2026.
- Related: [ADR-0006](0006-sandbox-model.md), [ADR-0069](0069-required-stages-never-pass-incomplete.md).
