# ADR-0007: Local CLI scope

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Local CLI scope", commit `0da65aa`

## Context and Problem Statement

The same screening core serves GitHub Actions and local runs. A local CLI that is not running cannot receive events ([whitepaper §11](../whitepaper.md)), so it screens on demand. Which local uses does version 1 support?

## Considered Options

- Four local uses — contributor preflight, maintainer-initiated screening, historical replay, and repository initialization

No other option was recorded.

## Decision Outcome

Chosen option: "Four local uses".

Contributor preflight (unsandboxed, own code), maintainer-initiated screening (local container), historical replay, and repository initialization.

### Consequences

- [Architecture §6.5](../architecture.md) defines the CLI commands, and [architecture §5](../architecture.md) the local topologies T2 (contributor preflight), T3 (maintainer local screening), and T4 (evaluation replay).
- The local uses follow [SP05](../processes.md) (CLI steps), [SP20](../processes.md), [SP04](../processes.md), and [SP02](../processes.md) step 1 (`steward init`).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
