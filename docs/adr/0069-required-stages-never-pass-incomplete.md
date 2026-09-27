# ADR-0069: Required stages never pass incomplete

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/processes.md` SP13, SP19; `docs/architecture.md` §12

## Context and Problem Statement

Architecture §8 states that reference verification and claim validation always run. SP13's outcome table
allows `pass` only when every required check is satisfied, and SP19 step 8 enforces that never-pass rule as
invariant 4. The first local runs check only the submission contract, so no downstream stage produces a result
at all. None of the 19 closed causes in the existing vocabulary named "a required stage produced no result";
the closest, `coverage-missing`, means platform coverage, a different failure. How does the decision module
represent a required stage that never ran, so that an incomplete run can never resolve to `pass`?

## Considered Options

- A new closed cause `stage-incomplete` for a required stage with no result
- Reusing the existing `steward-defect` cause for the same situation
- Passing a met contract with a note listing the unrun stages

## Decision Outcome

Chosen option: "A new closed cause `stage-incomplete` for a required stage with no result", because reusing
`steward-defect` would be misleading: nothing in the pipeline is defective when a later stage has simply not
run yet. Passing a met contract with a note about unrun stages was rejected outright because it violates
invariant 4 and architecture §8, both of which require certain stages to run before any outcome can be `pass`.

The decision module computes a required-stage plan before evaluating any outcome: every issue and pull request
requires the `references` and `claim` stages; a defect issue additionally requires `reproduction`; a pull
request additionally requires every stage that `stages.per_category` lists for each category the submission
contract check found plausible, or every listed stage when no category is plausible. Stage ids, in pipeline
order, are `references`, `claim`, `reproduction`, `fix-verification`, `regression`, `challenge`.

A stage result is either complete or unavailable with a cause. A required stage with neither adds the cause
`stage-incomplete`, code `pipeline.stage-incomplete`, with subjects listing the missing stage ids in pipeline
order. That cause ends the run `inconclusive` under SP13's row for unavailable required steward work, while
keeping every finding the run had already independently established.

The decision table applies SP13's rows in precedence order: superseded; a shared head, which resolves
`needs-changes`; a contract failure before any spending, which resolves `needs-changes`; a capacity cap, which
resolves the waiting state `queued`; inference admission, which resolves the waiting state `awaiting-approval`;
required steward work unavailable, which resolves `inconclusive`; an unresolved maintainer decision, which
resolves `uncertain`; missing contributor evidence or a later blocking finding, which resolves `needs-changes`;
and otherwise `pass`.

Advisory and speculative findings never change the outcome, and an optional requirement never changes it
either. `pass` is constructed in exactly one place in the decision module. Causes are recorded only for an
`inconclusive` outcome. The closed cause vocabulary grows from 19 to 20 entries with the addition of
`stage-incomplete`.

A direct consequence is accepted: until later stages exist, a local run can only end `needs-changes` or
`inconclusive`; `uncertain` and `pass` remain reachable only in decision-table tests. The cause stays useful
once later stages exist, for example to represent a stage skipped by a job failure.

### Consequences

- [SP13](../processes.md) and [SP19](../processes.md) state the cause and the required-stage plan.
- [Architecture §12](../architecture.md) lists the new failure class among the closed causes.
- The report's "What would change the outcome" section names the missing required stages.
- The invariant 4 conformance test injects a missing required stage result at every phase boundary.

## More Information

- The project owner decided this on September 27, 2026.
