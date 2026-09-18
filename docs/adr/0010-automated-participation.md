# ADR-0010: Automated participation

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Automated participation", commit `0da65aa`

## Context and Problem Statement

Review exchanges attract low-value automated activity that consumes maintainer attention (P08). How far does the steward's handling of that activity go in version 1?

## Considered Options

- Passive handling only — the steward follows its own conduct rules and flags automated activity for maintainer attention in its report
- Active moderation of automated participation — deferred as [DF03](../deferred.md#df03-active-moderation-of-automated-participation)

## Decision Outcome

Chosen option: "Passive handling only", because moderation is a governance act with side effects, so passive flagging comes first.

Passive handling only (P08).

### Consequences

- [SP16](../processes.md) defines the steward's own conduct and passive flagging; flags never affect an outcome, and the steward does not minimize or hide comments, lock threads, or set interaction limits.
- [Architecture §7](../architecture.md) lists interaction limits and comment minimization as not used in version 1; the "Hygiene" policy area of [architecture §8](../architecture.md) holds the heuristics and the allowlist.

## More Information

- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
