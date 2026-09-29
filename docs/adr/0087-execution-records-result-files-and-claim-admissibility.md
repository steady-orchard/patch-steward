# ADR-0087: Execution records: environment identity, result files, and claim admissibility

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §9, §11; `docs/processes.md` SP17; `docs/user-manual/configuration.md` "Local evidence and reports"

## Context and Problem Statement

The version-1 execution record held the command, environment identity, exit status, bounded output head and tail,
result-file hashes, and admissibility `evidence` or `signal`. Execution needs more: runtime and image identity,
limits, timing, checkout identity, result-file status and JUnit summaries, a place for the full bounded output,
stored result files, and a value for unsandboxed results. [ADR-0035](0035-integer-schema-versions.md) lets optional
additions keep `schema_version` 1, and [ADR-0065](0065-redaction-at-persistence.md) redacts at persistence.

## Considered Options

- Optional additions to the version-1 execution record, the full bounded output in a separate redacted file
  referenced from the record, and stored redacted result files
- The whole bounded output inside the record (widening `output.head` and `output.tail`)
- Parsed summaries only, without stored result files
- Failing the run's evidence when a result file cannot be redacted whole

## Decision Outcome

Chosen option: "Optional additions to the version-1 execution record, the full bounded output in a separate
redacted file referenced from the record, and stored redacted result files", because it keeps existing records
valid, keeps records small, and keeps the bytes a maintainer needs to audit a result. Widening the record was
rejected because JSON escaping can expand control characters up to sixfold and records would carry megabytes.
Summaries alone were rejected because they discard the bytes a maintainer needs to audit a result. Failing the
evidence was rejected because it would lose a whole run for one oversize file.

All additions are optional keys of the version-1 record: `kind` (`command` or `dependency-step`); `runner`
(`container` or `unsandboxed`); `working_directory`; `expected` (`exit-zero`, `exit-nonzero`, or `any`);
`environment.runtime` (name `docker`, `podman`, or `host`, client and server versions, OS, architecture);
`environment.image` (source, reference, digest, id, runner tree id, `cached`; null for unsandboxed runs);
`environment.platform`; `environment.network` (`none` or `egress`); the applied `limits` (execution seconds; output
head, tail, and stream bytes; cpus, memory, pids, and scratch, the last four null for unsandboxed runs); `timing`
(start, finish, duration); `exit.oom_killed` and `exit.output_limited` next to `code`, `signal`, and `timed_out`;
`checkout` (commit, tree, archive SHA-256, files, bytes, overlays, skipped submodules); and per result file
`format`, `status`, `error_code`, `stored_path`, `stored_omitted`, `stored_omitted_reason`, and a `junit` summary.
`environment.image_digest` keeps the digest (or the local id of a built image); `tool_versions` lists the runtime
client and server.

Admissibility values are `evidence`, `signal`, and `claim`. Container runs the steward starts are `evidence`;
unsandboxed runs (`steward preflight --run`) are `claim`; `signal` stays reserved for ingested CI results, which
are not implemented. No decision rule reads a `claim` record, and a stored run directory holding one fails
verification.

Output: the record keeps a bounded excerpt (`output.head` and `output.tail`, each at most 65536 UTF-16 code units,
cut from the redacted text). The full bounded capture is stored, redacted, as `executions/execution-NNNN/output.txt`
(`NNNN` is the record's own sequence in `executions/execution-NNNN.json`), referenced by the optional key
`output.stored_path`. The file holds the head part, marker lines, then the tail part: `[... <n> bytes omitted ...]`
for raw stream bytes not kept, and `[... <m> decoded bytes trimmed ...]` when invalid UTF-8 expansion or redaction
markers forced a trim. It is at most `limits.execution.output_head_bytes + limits.execution.output_tail_bytes + 128`
bytes. Each part is redacted as one input below the redaction input bound of 8388608 bytes. The file exists for
every stored execution record (0 bytes when there was no output), is listed in the manifest, is not a log file, and
is never dropped. `output.truncated` is true when anything was omitted, trimmed, or left out of the excerpt;
`output.total_bytes` counts all bytes read.

Result files: a declared result file whose status is `parsed` or `malformed` is stored as
`executions/execution-NNNN/result-<k>.xml` (`<k>` is the entry's 1-based position in that record's `result_files`,
never renumbered): the raw copied bytes decoded as UTF-8 with U+FFFD replacement and one leading byte-order mark
removed, redacted as one input, encoded as UTF-8. The manifest `sha256` covers the stored (redacted) bytes; the
record's `content_hash` covers the raw copied bytes. `content_hash` is null exactly for `missing`, `not-regular`,
and `too-large` entries; `bytes` is the copied size for `parsed` and `malformed`, the declared size for `too-large`,
else 0.

Redaction-input omission: a result file whose decoded text exceeds 8388608 bytes is not stored, and the run is
kept. The entry keeps its status, raw `content_hash`, `bytes`, error code, and `junit` summary and gets
`stored_path: null`, `stored_omitted: true`, and `stored_omitted_reason: redaction-input`. The text is never
chunked, trimmed, partially redacted, or stored unredacted.

Evidence budget: over `limits.evidence.run_bytes`, stored result files are dropped one at a time, highest execution
number first and within it the highest `<k>`. A dropped entry keeps status, hash, bytes, error code, and its `junit`
summary and gets `stored_path: null`, `stored_omitted: true`, and `stored_omitted_reason: evidence-budget`. Records
and output files are never dropped; when no result file remains and the run is still over the limit, the existing
rules apply (the steward log shrinks, then `evidence.too-large`, cause `budget-exhausted`). A run directory whose
file count would exceed 4096 ends `evidence.too-many-files` (`budget-exhausted`) without dropping anything. The
schema ties the keys together: `stored_omitted_reason` is present exactly when `stored_omitted` is true, and
`stored_path` is non-null exactly for a stored `parsed` or `malformed` file.

Verification (`steward report`): an execution record's `output.stored_path` must name its own
`executions/execution-NNNN/output.txt`, listed in the manifest, valid UTF-8, within the size bound. Every manifest
output file and result file must be referenced by exactly one record or entry. A string result-file `stored_path`
must equal its own `executions/execution-NNNN/result-<k>.xml`, and omitted entries have no file. A stored execution
record with `output.stored_path: null` or with admissibility `claim` fails verification.

The run record gains `runner_identity`, `<runtime> <server version> <reference>@<digest first 12 hex>` (at most 256
characters; null when nothing ran), and the run budget gains `executions` and `container_seconds`; the cost metrics
event carries `container_seconds`, and no new metrics kind exists. `intake` passes the plan to `execute` as an
`execution-plan` transport record, and `execute` passes the records, their unredacted bounded output parts, and
decoded result-file text to `publish` as an `execution-results` transport record. Both are validated at every
boundary, bound to the run id and attempt, snapshot hash, and policy revision, and never stored; `publish` redacts
and writes the files. The handoff record is unchanged.

### Consequences

- Output has two stored forms: consumers that read only records see the excerpt, while the file is the complete
  bounded capture and stages that need full output read the file.
- Each execution adds one more run file.
- Verification grows: path, references in both directions, UTF-8 validity, and the size bound.
- Output files are never dropped over budget, so a run whose fixed evidence exceeds `limits.evidence.run_bytes`
  still fails.
- The excerpt and the file are redacted separately, so verification cannot require byte-exact prefix and suffix
  equality; tests assert it for the fixture corpus.
- A credential straddling the pre-redaction cut, applied only when invalid UTF-8 expands a part beyond 8388608
  bytes, keeps an unredacted fragment, the same class of exposure as the capture cut.
- The file stores text without JSON escaping, so control characters do not expand the stored size up to sixfold.
- `schema_version` stays 1 and existing records stay valid.
- Per execution, the stored size is a record plus at most `output_head_bytes + output_tail_bytes + 128` bytes of
  output file; the template values (`limits.execution.output_bytes` 1048576, `limits.evidence.run_bytes` 10485760)
  hold about seven executions with full output plus the fixed run files.
- `steward report` verifies every stored execution file.

## More Information

- The project owner decided this on September 28, 2026.
- [Architecture §9 and §11](../architecture.md) and [SP17](../processes.md) describe the records and the evidence.
- The materialized checkout identity is described in
  [ADR-0086](0086-inert-materialization-and-overlay-validation.md); the limits are described in
  [ADR-0083](0083-execution-limits-as-policy-keys.md).
