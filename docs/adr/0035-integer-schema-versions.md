# ADR-0035: Integer schema versions and the rule for evolving schemas

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §9

## Context and Problem Statement

The policy file and every stored record (policy revision, submission, run, execution
record, finding, decision, report, maintainer action, metrics event) outlive a steward
release. Readers need to know which shape a given file or record holds, and record hashes
need one canonical byte form so that a hash is reproducible across readers and platforms.

## Considered Options

- Integer versions with an additive rule — `version: 1` in the policy and `schema_version: 1` in every record; optional additions keep the version; removal, rename, or a change of meaning increments it
- Semantic version strings — a string such as "1.2.0" per schema
- No version field — readers infer the shape from the fields present

## Decision Outcome

Chosen option: "Integer versions with an additive rule", because one integer is enough
when additions are always optional; strings invite partial-compatibility rules that no
reader actually checks; and without a field an old reader silently misreads a changed
shape. An unknown version is a typed failure and never a pass: the policy reports
`policy.version-missing` or `policy.version-unsupported`, and records reject a wrong
`schema_version`. Before the steward's 1.0 release, an increment needs no migration of
evidence recorded by test installations.

The policy's `version` and every record's `schema_version` are integers, starting at 1.
An optional addition to a schema keeps its version unchanged; a removal, a rename, or a
change of meaning increments it. Content hashes of records are `sha256:<hex>` over
RFC 8785 (JSON Canonicalization Scheme) bytes: keys sorted by UTF-16 code units,
ECMAScript number serialization, and no whitespace; non-finite numbers and lone surrogates
are rejected, so hashing a validated record cannot fail.

### Consequences

- [architecture §9](../architecture.md) states the evolution rule, the record types, and
  the canonical JSON form for content hashes.
- [architecture §15](../architecture.md) no longer lists the record schemas as an open
  implementation decision.
- The [configuration reference](../user-manual/configuration.md) checks `version` first,
  before the strict schema and cross-field rules.

## More Information

- The project owner decided this on September 26, 2026.
