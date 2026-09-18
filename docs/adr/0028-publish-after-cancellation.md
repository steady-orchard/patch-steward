# ADR-0028: Publication after cancellation

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §12; `docs/processes.md` SP13, SP19; `probes/findings.md` PA04

## Context and Problem Statement

`publish` depends on all pipeline jobs and runs under `if: ${{ always() && needs.gate.result == 'success' && needs.gate.outputs.committed == 'true' }}`, so that it records incomplete required work after failed or skipped jobs. The design also said: "A workflow cancellation can still prevent publication."

A probe cancelled a run while `execute` was running: `execute` and `assess` ended `cancelled`, and `publish`, with the design's exact condition, still ran and completed `success` with `committed=true` (PA04.4 in the [findings record](../../probes/findings.md); [results](../../probes/pa04-privilege-separation/results/org-public.md), E7). `always()` makes the job run after a cancellation; a cancellation prevents publication only if it lands before `gate` completes or while `publish` itself runs. The same condition after failed and skipped jobs, and its skip when `gate` fails or nothing was committed, were confirmed (PA04.3). What does a cancelled run publish?

## Considered Options

- Keep `always()` and state the cancellation behavior — `publish` also runs after a cancellation: a run cancelled by a committed replacement finds the newer ownership artifact and abandons as `superseded`, completing only its own still-pending check `cancelled`; a run cancelled without a replacement records the cancelled required work as `inconclusive`; only a cancellation that reaches `gate` or `publish` itself leaves the check pending for reconciliation
- Skip publication after a cancellation — change the condition to `!cancelled() && needs.gate.result == 'success' && needs.gate.outputs.committed == 'true'`, so a cancelled run never publishes and its check stays pending until a newer run's `gate` or stale reconciliation

## Decision Outcome

Chosen option: "Keep `always()` and state the cancellation behavior", because it matches the rule that ownership and freshness, not cancellation, decide publication, lets a superseded run complete its own pending check at once instead of after the stale timeout, and keeps a cancellation without a replacement visible as `inconclusive`; the alternative trades that for one fewer job per cancelled run.

The `publish` condition keeps `always()`, and `publish` also runs after a workflow cancellation. A run cancelled by a committed replacement finds the newer ownership artifact and abandons as `superseded`, completing only its own still-pending check `cancelled`. A run cancelled without a replacement records the cancelled required work as `inconclusive`. Only a cancellation that reaches `gate` or `publish` itself leaves the check pending for reconciliation.

### Consequences

- [Architecture §6.4](../architecture.md) (the `publish` paragraph and the bullet on failed `gate`/`publish` jobs), [architecture §10](../architecture.md) (superseded runs complete only their own still-pending check `cancelled`), and "Failure classes and outcomes" in [architecture §12](../architecture.md) state the behavior.
- The Failure handling of [SP13](../processes.md) and [SP19](../processes.md) applies it.

## More Information

- The project owner decided this on September 25, 2026.
