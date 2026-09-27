# ADR-0070: Phase handoff records

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §12.1

## Context and Problem Statement

Architecture §6.4 runs one workflow run per event with jobs `gate`, `intake`, `execute`, `assess`, a bounded
number of `execute-N`/`assess-N` pairs, and `publish`, and it states that every handoff between jobs carries the
run, attempt, snapshot, round, and remaining cumulative budget. A local run needs the same phase sequence in a
single process, and later work fills `intake`, `execute`, and `assess` with real behavior without changing the
contract between phases. A handoff must never drop a finding that an earlier phase already recorded, and must
never let a later phase restore budget that an earlier phase spent. What carries state between phases, and how
is it kept honest?

## Considered Options

- A strict, versioned handoff record validated at every phase boundary
- Plain in-memory objects passed between phases without validation
- Persisting handoffs in the run directory alongside records

## Decision Outcome

Chosen option: "A strict, versioned handoff record validated at every phase boundary", because the same
contract must hold later between separate jobs running in separate processes, and an unvalidated in-memory
handoff could silently drop findings or let a later phase raise a budget that an earlier phase had already
spent down. Persisting handoffs in the run directory was rejected because the run directory holds records, not
transport state; artifact persistence between jobs belongs to the GitHub-hosted workflow, not to the record
schema.

The phases run in the fixed order `gate`, `intake`, `execute`, `assess`, then up to `stages.challenge_rounds`
pairs of `execute-N`/`assess-N`, hard-bounded at 3 pairs, then `publish`. At the contract level implemented so
far, `intake`, `execute`, and `assess` are pass-throughs: they produce no stage result, no model call, and no
execution, and no challenge round runs.

The handoff record is a strict schema with `handoff_version` 1, serialized as canonical JSON of at most
8388608 bytes. It holds the producing phase, the run id and attempt, the snapshot hash, the policy revision,
the round (0 for `execute` and `assess`, N for pair N), the remaining budget (GitHub requests, model calls,
tokens or null, AI credits or null, executions, execution seconds, and rounds), the early exit state (none,
contract needs-changes, or contract inconclusive), the findings so far, the causes so far, the stage results so
far, and the next round plan, which is null at the contract level.

Every phase boundary validates the schema; checks that the run, attempt, snapshot, and policy revision equal
those recorded by `gate`; checks that the round follows the sequence and stays within the maximum; checks that
every budget field is non-negative and never increases from one handoff to the next; and checks that findings,
causes, and stage results are only ever appended to, never removed or replaced. A violation of the schema or of
run, attempt, snapshot, or round binding adds the cause `steward-defect`, with code `pipeline.handoff-invalid`
for a schema violation or `pipeline.handoff-binding` for a run, snapshot, revision, or round mismatch, and the
run jumps directly to `publish` with the last valid state.

`gate` hands off directly to `publish` when the submission contract's disposition is `needs-changes` or
`inconclusive`, so the contract gates spending before any inference happens; a `met` or `uncertain` contract
disposition continues to `intake`. Each phase after `gate` runs under `limits.stage_seconds`; a timeout adds the
cause `budget-exhausted` with code `pipeline.phase-timeout`. `assess` requests another round by returning a
round plan in its handoff, and a request beyond the maximum adds `budget-exhausted` with code
`pipeline.rounds-exhausted`. `publish` itself is never raced by a timeout, because an abandoned write could
still commit its effect afterward.

The initial budget is computed from the policy: `limits.github.requests_per_run` minus the requests the
contract capture already used, `llm.limits.model_calls_per_run` (0 when the policy has no `llm` section), token
limits for the `openai-compatible` provider and AI credit limits for the `copilot-sdk` provider (null for the
other), `limits.execution.executions_per_run`, `limits.execution.run_execution_seconds`, and
`stages.challenge_rounds`. Handoffs are validated in process and are never persisted in the run directory.

### Consequences

- [Architecture §6.4](../architecture.md) states that a local run executes every phase in one process with
  validated handoffs between them.
- [Architecture §12.1](../architecture.md) lists the handoff size bound.
- The invariant 4 conformance test injects a handoff failure at every phase boundary.
- The invariant 8 conformance test proves that handoffs bind the run, attempt, snapshot, revision, and round.

## More Information

- The project owner decided this on September 27, 2026.
