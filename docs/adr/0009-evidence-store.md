# ADR-0009: Evidence store

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Evidence store", commit `0da65aa`

## Context and Problem Statement

Every run produces run records, execution records, findings, the rendered report, and maintainer actions that must persist append-only, and some projects need their evidence to stay private. Patch Steward keeps no hosted backend. Where is evidence stored?

## Considered Options

- Configurable evidence store — an orphan branch in the target repository by default, or a separate evidence repository

No other option was recorded.

## Decision Outcome

Chosen option: "Configurable evidence store", because a separate repository allows private evidence and keeps the main repository's history clean, at the cost of installing the App there as well.

Configurable. Default: an orphan branch in the target repository. Option: a separate evidence repository.

### Consequences

- [Architecture §11](../architecture.md) defines both store types, the append-only layout, and publication; the "Evidence" policy area of [architecture §8](../architecture.md) selects the store type, and the evidence-store adapter of [architecture §6.3](../architecture.md) writes it.
- [SP02](../processes.md) step 4 creates the store, and [SP18](../processes.md) retains and publishes evidence.
- Where a repository's plan and visibility offer no rulesets, the push restriction on the store is unavailable ([ADR-0025](0025-ruleset-dependent-controls-limitation.md)).

## More Information

- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
