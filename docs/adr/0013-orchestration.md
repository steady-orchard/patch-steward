# ADR-0013: Orchestration

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Orchestration", commit `0da65aa`

## Context and Problem Statement

Screening runs in GitHub Actions ([ADR-0005](0005-deployment-and-triggers.md)). Jobs that hold App or model credentials must stay apart from jobs that run submitted code, and a later run must be able to tell whether an earlier run still owns a submission and may publish. How is screening orchestrated?

## Considered Options

- Single-run model — one trusted workflow run per event with job-level privilege separation; ownership and freshness come from per-submission ownership artifacts and, when the repository gate is active, check runs
- Persisted orchestration state kept by the steward

## Decision Outcome

Chosen option: "Single-run model".

Single-run model: one trusted workflow run per event with job-level privilege separation. Per-submission ownership artifacts uploaded by `gate` and, when the repository gate is active, GitHub check runs provide ownership and freshness; the Actions run list serves only the caps; the steward keeps no persisted orchestration state. A credential-free relay serves the merge queue.

### Consequences

- [Architecture §6.4](../architecture.md) defines the jobs `gate`, `intake`, `execute`, `assess`, the bounded `execute-N`/`assess-N` pairs, and `publish`, the wrappers including the credential-free merge-queue relay, and ownership and freshness without steward state, and states that the Actions run list serves only the caps.
- [Architecture §9](../architecture.md) has no persisted orchestration entity; [architecture §10](../architecture.md) defines the check-run representation, and [architecture §12](../architecture.md) the caps counted from the run list and per-submission concurrency; [SP19](../processes.md) applies them, and its step 1 states that the Actions run list serves only the caps.
- Later decisions refine the model: [ADR-0026](0026-ownership-artifact-ordering.md), [ADR-0027](0027-wrapper-permission-ceiling.md), [ADR-0028](0028-publish-after-cancellation.md), [ADR-0030](0030-per-submission-concurrency-after-commitment.md), [ADR-0031](0031-merge-queue-relay-membership.md), and [ADR-0033](0033-explicit-secrets-mapping.md).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
