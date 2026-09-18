# ADR-0030: Per-submission concurrency only after commitment

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §12; `docs/processes.md` SP19; `probes/findings.md` PA05

## Context and Problem Statement

Per-submission concurrency serializes the committed work and publication of a submission ([ADR-0013](0013-orchestration.md)). The design said that only a newly committed replacement may cancel earlier submission work and that ignored events never enter a workflow-level cancel-in-progress group; it did not say when a job joins the per-submission group.

With job-level `concurrency` and `cancel-in-progress: false`, a pending job of one run was cancelled when a job of a newer run joined the same group, and it never started: GitHub keeps at most one pending member per group. With `cancel-in-progress: true`, only the group's job was cancelled, the run's other jobs completed, and the run's conclusion was `cancelled` (PA05.3 in the [findings record](../../probes/findings.md); [results](../../probes/pa05-rounds-concurrency/results/org-public.md), E4, E5). So `cancel-in-progress: false` does not protect a pending job: any job that joins a per-submission group, including one started by an ignored event or an unchanged-input echo, replaces the pending member. Where does a job enter the per-submission group?

## Considered Options

- Join the group only after commitment — a job joins the per-submission concurrency group only after `gate` has decided that the event is a committed replacement; deduplication and commitment happen outside the group; a job-level cancellation marks the whole run `cancelled`
- No text change — the rule that only a newly committed replacement may cancel earlier submission work already implies that ignored events never join the group; the platform rule is applied when serialization is implemented

## Decision Outcome

Chosen option: "Join the group only after commitment", because the replacement rule is not obvious and applies even with `cancel-in-progress: false`, which the earlier text did not cover; stating where group entry happens keeps an implementer from placing `gate` in the group, where an echo would cancel a pending committed job.

A job joins the per-submission concurrency group only after `gate` has decided that the event is a committed replacement; deduplication and commitment happen outside the group. The reason is the platform rule: GitHub keeps one pending member per group, and a newer member replaces it even with `cancel-in-progress: false`. A job-level cancellation marks the whole run `cancelled`.

### Consequences

- [Architecture §6.4](../architecture.md) (the bullet starting "Per-submission concurrency serializes") and "Concurrency" in [architecture §12](../architecture.md) state the rule.
- [SP19](../processes.md) step 3 applies it.
- A run cancelled by a committed replacement still publishes as `superseded` ([ADR-0028](0028-publish-after-cancellation.md)).

## More Information

- The project owner decided this on September 25, 2026.
