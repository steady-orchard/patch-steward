# ADR-0064: Evidence run directory, record files, and the local store

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §9, §11; `docs/processes.md` SP18

## Context and Problem Statement

Architecture §15 listed the evidence store's run-directory layout and stored-record file format as open.
§11 requires an append-only store with one directory per run. SP18 step 1 and SP13 step 3 require durable
evidence before any report is produced. A local run (T3) needs durable local evidence without an orphan
branch, and a later branch or repository store ([ADR-0009](0009-evidence-store.md))
must be able to reuse the same layout instead of inventing its own ([ADR-0009](0009-evidence-store.md)).

## Decision Drivers

- Stored records must be verifiable byte for byte later, including after a partial or interrupted write.
- The layout must not depend on git history or a remote, so it works for local runs.
- The same layout must be reusable by a branch or repository store without a rewrite.

## Considered Options

- One directory per run, one JSON file per record, a manifest written last, staged and renamed into place
- A single JSON document per run
- JSON Lines appended per repository
- Committing sample run directories to the fixture corpus

## Decision Outcome

Chosen option: "One directory per run, one JSON file per record, a manifest written last, staged and renamed
into place", because a single JSON document per run has no per-record hashes, makes a partial write harder to
detect, and forces a rewrite when later records such as maintainer actions arrive; JSON Lines appended per
repository modifies existing files and mixes unrelated runs together; and committing sample run directories to
the fixture corpus fails because an ignore rule for `logs` would untrack the log directory, a formatter rewrites
JSON and Markdown, and line-ending conversion changes bytes, while runs are in fact generated in temporary
directories from committed inputs and golden reports are already byte-exact text files.

Runs live under `<evidence-dir>/<owner>/<repo>/`, the subtree a later branch or repository store will hold ([ADR-0009](0009-evidence-store.md)), at
`runs/<pr|issue>-<number>/<run-id>/`. A run directory contains `manifest.json` (written last; its presence marks
a complete run directory), `run.json`, `submission.json`, `policy-revision.json`, `decision.json`, `report.json`
(the rendered report and check summary), `report.md` (identical to the report record's rendered text),
`findings/finding-0001.json` (one finding per file in decision order), `executions/execution-0001.json`,
`maintainer-actions/action-0001.json` (each of these directories absent when empty), and `logs/steward.txt` (a
redacted, bounded run log). Metrics events go to `metrics/<YYYY-MM>/<run-id>.json`, a JSON array of the run's
events in the UTC month of the run's start, so no write ever modifies an existing file.

Record files are UTF-8 without a byte-order mark, with keys at every level in RFC 8785 order, two-space
indentation, every non-empty array and object expanded one member per line (empty ones inline), RFC 8785 number
and string serialization, LF line endings, and one final LF. Parsing a file and canonicalizing it yields the
record's content hash.

The manifest (`manifest_version` 1) lists `run_id`, `run_attempt`, `store_path`, `created_at`, and `files`:
every file except the manifest itself, sorted by path with POSIX separators, each with `bytes`, the `sha256` of
its raw bytes, and, for records, `record_type` and the RFC 8785 `content_hash` (else null); plus `metrics`
(`path`, `bytes`, `sha256`) and `redaction` (built-in detector ids, policy pattern ids, the number of exact
values, and replacement counts per id).

The write protocol writes every file into `runs/.staging/<run-id>/` with exclusive create (never overwrite),
writes the metrics file with exclusive create at its final path, writes the manifest last, then renames the
staging directory to its final path as the single commit point; the rename fails if the target already exists.
On any failure before the rename, the staging directory and the metrics file are removed and the write is
reported as failed, so a final run directory never exists without its manifest and no report is ever produced
from one.

All bytes of a run directory plus its metrics file stay within the policy's `limits.evidence.run_bytes`; logs
are truncated first, head and tail kept with a marker line, each log file at most 1048576 bytes and at most 16
log files; a run directory holds at most 4096 files; when records and the report alone exceed the size cap the
write fails. `limits.evidence.write_retries` applies only to the later branch store; local writes never retry.

Evidence locations in local reports are code spans of paths relative to the store root; the report module takes
an evidence-location function so a branch store can later supply URLs without changing report templates.
`steward report` verifies a run directory before printing: the manifest validates, every listed file exists
with its recorded bytes and hash, no unlisted file exists, every record validates and matches its content hash,
`report.md` equals the report record's rendered text, and the metrics file matches when present.

### Consequences

- [Architecture §11](../architecture.md) and [§9](../architecture.md) describe the layout and file format, and
  §15 no longer lists it as open.
- [SP18](../processes.md) step 1 writes the run directory as specified here.
- The fixture corpus never contains a committed run directory; runs are generated at test time.

## More Information

- The project owner decided this on September 27, 2026.
