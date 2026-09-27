# ADR-0068: Local run identity

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.3, §9

## Context and Problem Statement

Every version-1 record identified a run by the Actions run id, a positive integer, and its attempt, but a
local run has neither. Every run record must also carry the steward version, and no version constant existed
before this decision. Reproducible tests need an injectable clock and random source rather than reads of the
system clock and process entropy. The snapshot schema accepted only a git tree id as a policy revision, so
every run started under a named local policy file, `local:<sha256>`, failed capture before it could begin. How
does a local run get an identity, a version, and a policy revision that the existing record schemas accept
without a schema version bump?

## Decision Drivers

- Existing records and their consumers must stay valid without a schema version increase, per
  [ADR-0035](0035-integer-schema-versions.md).
- Local and Actions run ids must never collide or be mistaken for one another.
- Tests need deterministic time and randomness.

## Considered Options

- Widen `run_id` to accept a local id form, keeping every record schema at version 1
- Increment every record schema to version 2
- Synthetic numeric ids for local runs
- A hand-kept steward version constant

## Decision Outcome

Chosen option: "Widen `run_id` to accept a local id form, keeping every record schema at version 1", because
the change is a widening that keeps every existing record valid with unchanged meaning, and architecture §9
together with [ADR-0035](0035-integer-schema-versions.md) keep the schema version unchanged for such changes.
Incrementing every schema to version 2 would force every consumer to handle two incompatible shapes for no
semantic gain. Synthetic numeric ids for local runs were rejected because they would be indistinguishable from,
and could collide with, real Actions run ids. A hand-kept steward version constant was rejected because it
drifts at every release bump instead of tracking the package manifest that already carries the true version.

`run_id` in every record that carries it is now a positive integer for an Actions run, or a string of the form
`local-<YYYYMMDDTHHMMSSZ>-<8 lowercase hex>`: the UTC start time plus 32 random bits. A local run always has
`run_attempt` 1. The local run id also names the run directory; an Actions run directory is instead named
`<run_id>-<run_attempt>`. Finding ids are `finding-<4-digit sequence>` in decision order regardless of run kind.

Finding records gain optional `code`, `detail`, `subjects`, and `request_id` fields; decision records gain an
optional `causes` field. An issue record may carry no issue kind exactly when it matched no template, an
unstructured issue, so every run still produces a submission record. Every record schema version stays 1.

The snapshot's `policy_revision` field now also accepts `local:<sha256>` alongside a git tree id;
`snapshot_version` stays 1, and the hash of every git-revision snapshot is unchanged. A proposed policy's
revision recorded in the submission record stays a git tree id in every case, because a proposal is always
evaluated against the trusted revision it targets.

The steward version is read once from the core package's own manifest and validated as a semantic version;
failure to read or validate it is a steward defect raised before any run starts. A test keeps the root, core,
and CLI package versions equal, so the recorded version never drifts from what shipped. An injectable clock and
random source default to the system clock and cryptographic random bytes respectively; tests inject both to
make local run ids and their timing deterministic.

### Consequences

- [Architecture §9](../architecture.md) states the run id forms and the new optional record keys.
- [Architecture §6.3](../architecture.md) "Clock and ids" names the local run id form and its inputs.
- The invariant 8 conformance test proves that a local-policy run binds the same `local:<sha256>` revision
  across the snapshot, the submission record, the run record, and the report.

## More Information

- The project owner decided this on September 27, 2026.
