# ADR-0075: Waiting, supersession, and closure records

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §9, §11; `docs/processes.md` SP03 step 2, SP06 step 8, SP13 step 4, SP18 step 6

## Context and Problem Statement

A queued run must persist a restart record; a superseded run must append its supersession without changing its
evidence; closures must record maintainer resolutions paired with the screened snapshot (SP03 step 2); all in the
append-only store, whose run directory layout ([ADR-0064](0064-evidence-run-directory-and-local-store.md)) knows
only outcome runs. What do these records contain, and where are they stored?

## Considered Options

- Waiting run directories, supersession records, and metrics-only closures

No other option was recorded.

## Decision Outcome

Chosen option: "Waiting run directories, supersession records, and metrics-only closures", because each fits the
append-only layout as new files only and leaves every existing run directory unchanged.

Outcome runs keep the run directory `runs/<pr|issue>-<number>/<run_id>-<run_attempt>/` and the metrics file
`metrics/<YYYY-MM>/<run_id>-<run_attempt>.json`; in GitHub-hosted runs the report's evidence locations are URLs
into the store's tree, and the local-run notice is absent (these runs are not local runs).

Waiting run directory (disposition `queued`): `run.json`, `submission.json`, `policy-revision.json`,
`waiting.json`, `logs/steward.txt`, and `manifest.json`; no decision, report, or findings. The manifest gains an
optional key `run_kind` (`outcome` or `waiting`; absent means `outcome`, so every existing manifest stays valid
and `manifest_version` stays 1), and the required files follow it. Metrics: a state transition to `queued`,
latency events, and a cost event.

`waiting.json` (record type `waiting`, version 1): run id and attempt, subject, state `queued`, reason
(`daily-runs` or `per-author-concurrent-runs`), the counts and limits, snapshot hash, policy revision,
`arrival_at` (the API creation time of the run's ownership artifact), and `recorded_at`. It is the restart
record: restarts go in `arrival_at` order, which is maintenance work not implemented yet.

Supersession: after a confirmed mismatch, a second commit adds
`runs/<pr|issue>-<number>/supersessions/<run_id>-<run_attempt>.json` (record type `supersession`, version 1: run
id and attempt, subject, reason `newer-owner` or `snapshot-changed`, successor run id, attempt, and artifact
creation time or null, the recorded snapshot hash, the live snapshot hash or null, `recorded_at`) and
`metrics/<YYYY-MM>/<run_id>-<run_attempt>-supersession.json` with one state transition to `superseded`. For
`newer-owner` the successor comes from the newer artifact's validated record and the live hash is null; for
`snapshot-changed` the successor is null and the live hash is the recaptured one. The original run directory is
never modified.

Closure: a record-only publication commits one file `metrics/<YYYY-MM>/<run_id>-<run_attempt>.json` holding one
`maintainer-resolution` event whose subject is the submission, with no run directory and no manifest; the
read-back checks its blob id. The event payload gains optional keys: `resolution` (`merged`, `closed-by-author`,
`closed-by-maintainer`, or `deleted`), `paired_run` (run id and attempt, or null), and `paired_snapshot_hash` (or
null); `action_kind` is `resolution` and `dismissal_code` is null (coded dismissals come from `/steward resolve`,
which is not implemented). Attribution: a merged pull request is `merged`; otherwise a sender equal to the
author is `closed-by-author`, any other sender `closed-by-maintainer`; a deleted issue is `deleted`, an
extension of SP03 step 2, which listed no deletion. The pairing is the unique newest committed owner from the
gate's ownership listing, or null. A closure never supersedes an owner and never cancels work.

The record types gain `ownership`, `waiting`, and `supersession`, each version 1; the optional additions keep
every schema at version 1.

### Consequences

- [architecture §9](../architecture.md) and [architecture §11](../architecture.md) list the records and paths;
  [SP03](../processes.md) step 2, [SP06](../processes.md) step 8, and [SP18](../processes.md) step 6 apply them;
  `steward report` still verifies outcome run directories only; on the test-beds superseded runs gained
  supersession records (S04, S05), closures committed metrics files with `merged`, `closed-by-author`, and
  `closed-by-maintainer` (S10), and over-cap issues recorded waiting run directories (S11)
  (`scenarios/README.md`).

## More Information

- The project owner decided this on September 27, 2026.
