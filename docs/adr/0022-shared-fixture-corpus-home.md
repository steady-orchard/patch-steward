# ADR-0022: Shared fixture corpus in root fixtures/

- Status: accepted
- Date: 2026-09-17
- Deciders: project owner
- Source: `docs/architecture.md` §6.1; `fixtures/README.md`

## Context and Problem Statement

Fixture-tier tests ([ADR-0021](0021-test-tiers-and-ci-placement.md)) in every package read files from one shared corpus. Where does that corpus live?

## Considered Options

- Root fixtures/ directory — a plain root directory of the repository, not a workspace package
- A workspace package

## Decision Outcome

Chosen option: "Root fixtures/ directory".

Root `fixtures/` directory, not a workspace package.

### Consequences

- [Architecture §6.1](../architecture.md) places `fixtures/` in the layout as the shared fixture-tier test corpus, not a workspace package; the [fixture corpus README](../../fixtures/README.md) describes its use.

## More Information

- No rationale was recorded for this decision.
- The project owner decided this on September 17, 2026; it was recorded in architecture §6.1 in commit `9c2a1cb` (2026-09-17).
