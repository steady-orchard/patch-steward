# ADR-0056: Canonical claim-scope text

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §9

## Context and Problem Statement

PR intent acceptance binds to a canonical claim-scope text hash, so implementation pushes keep it. The text
must ignore invisible formatting differences from GitHub and editors yet change with any substantive edit of
the claim. What is the exact canonical form and hash?

## Considered Options

- Normalized fields in canonical JSON — extract the structured fields and hash their canonical JSON
- Hash of the whole body — hash the entire PR body as submitted
- Model-extracted summary — have the model produce a summary and hash that

## Decision Outcome

Chosen option: "Normalized fields in canonical JSON", because a whole-body hash changes with unrelated fields
such as test scaffolding and would drop acceptance needlessly, and a model summary is nondeterministic and
derived from untrusted text. The claim scope is the RFC 8785 canonical JSON of `claim_scope_version` `1`, the
fields `problem`, `benefit`, `intended-behavior`, `acceptance-criteria`, and `linked-proposal` (repository,
number, and content hash of the linked issue, or null). Each field is normalized: CRLF and lone CR converted to
LF, HTML comments removed, Unicode NFC applied, trailing spaces and tabs removed per line, leading and trailing
empty lines removed, Markdown otherwise verbatim. The hash is the SHA-256 of that canonical JSON.

The claim scope is unavailable for an unstructured body, a missing, trivial, or duplicated field, or a linked
issue that does not resolve to exactly one readable issue; then a maintainer must clarify, and acceptance never
broadens.

### Consequences

- [Architecture §9](../architecture.md) states the text.
- The submission record carries `claim_scope_hash`.
- Recording acceptance with `/steward accept` is not implemented yet.

## More Information

- The project owner decided this on September 26, 2026.
