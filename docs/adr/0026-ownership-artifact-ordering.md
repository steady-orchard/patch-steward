# ADR-0026: Ownership artifact ordering by created_at

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §7; `docs/processes.md` SP19; `probes/findings.md` PA02

## Context and Problem Statement

Ownership rests on per-submission ownership artifacts ([ADR-0013](0013-orchestration.md)): the newest artifact by creation time wins, including a new attempt of an old run, and an ambiguous or incomplete listing cannot authorize publication. The artifacts API returns both an artifact id and a `created_at` time.

A probe uploaded the same artifact name three times: run R1 attempt 1, run R2, then run R1 attempt 2. The `created_at` order matched the real upload order; the artifact id order did not. Afterwards the repository-wide listing held only two of the three artifacts, because the re-run attempt's upload replaced attempt 1's artifact of the same name. `created_at` has 1-second resolution (PA02.3 and PA02.5 in the [findings record](../../probes/findings.md); [results](../../probes/pa02-ownership-artifacts/results/org-public.md), E3–E6). The design already ordered by creation time; the cell was refuted only because the sub-claim required both fields to agree. Does the design need to say more?

## Considered Options

- Clarify creation time as `created_at` — state that creation time means the artifact's `created_at`, never the artifact id, which is not monotonic across a re-run attempt; that `created_at` has 1-second resolution, so equal values make the listing ambiguous; and that a re-run attempt's upload of the same name replaces the earlier attempt's artifact in the listing
- No text change — treat the finding as not affecting the design and leave the id and tie details to the ownership-artifact schema

## Decision Outcome

Chosen option: "Clarify creation time as `created_at`", because three short clauses prevent a plausible implementation error, ordering by id, the natural sort key of the API, and state the tie rule that already follows from the rule that an ambiguous or incomplete listing cannot authorize publication; without them the facts would stay only in the probe record.

"Creation time" means the artifact's `created_at`, never the artifact id: ids are not monotonic across a re-run attempt. `created_at` has 1-second resolution, so equal values make the listing ambiguous, and an ambiguous listing cannot authorize publication. A re-run attempt's upload of the same name replaces the earlier attempt's artifact in the listing.

### Consequences

- [Architecture §6.4](../architecture.md) (the ownership bullet "Only committed artifacts count as ownership") and the "Actions artifacts API" row of [architecture §7](../architecture.md) state the rule; the Failure handling of [SP19](../processes.md) orders owners by the artifact's `created_at`.
- The ownership-artifact naming, retention, listing consistency, and schema remain open implementation decisions ([architecture §15](../architecture.md)).

## More Information

- The project owner decided this on September 25, 2026.
