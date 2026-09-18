# ADR-0015: Preflight inference

- Status: accepted
- Date: 2026-09-16
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Preflight inference", commit `0da65aa`

## Context and Problem Statement

Contributor preflight ([ADR-0007](0007-local-cli-scope.md)) runs on the contributor's own machine, and its results are claims, never evidence. Does preflight use a model, and if so with which adapter and whose credential?

## Considered Options

- Optional inference with the contributor's own credential — deterministic preflight needs no inference account; LLM-assisted preflight uses any shipped adapter with the contributor's own credential after the CLI discloses what leaves the machine

No other option was recorded.

## Decision Outcome

Chosen option: "Optional inference with the contributor's own credential", because the output of LLM-assisted preflight is unverified advice.

Optional. Deterministic preflight needs no inference account. LLM-assisted preflight uses any shipped adapter with the contributor's own credential, because its output is unverified advice, and the CLI discloses what leaves the machine before sending.

### Consequences

- [SP05](../processes.md) CLI step 4 runs the optional self-review after listing what leaves the machine and waiting for confirmation; CLI steps 1 to 3 need no inference account.
- The `steward preflight` row and the CLI paragraph of [architecture §6.5](../architecture.md), and topology T2 of [architecture §5](../architecture.md), state the same scope; zone Z4 of [architecture §4](../architecture.md) treats the results as claims.

## More Information

- History: the architecture's status line records the LLM provider decisions as revised on September 16, 2026, after the retirement of GitHub Models on July 30, 2026; this record takes that date for the preflight inference decision. The decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
