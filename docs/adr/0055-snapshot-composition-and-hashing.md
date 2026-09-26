# ADR-0055: Snapshot composition and hashing

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` §0.1; `docs/architecture.md` §2 invariant 8, §9

## Context and Problem Statement

The snapshot definition listed the base commit among the snapshot inputs, while publication recomputed the
base ref. A push to the base branch fires no pull-request event, so hashing the base commit would make
unpublished runs end `superseded` with nothing to rescreen them. The snapshot also needed an exact composition
and hash so that two runs of the same intent are provably comparable.

## Considered Options

- Record the base commit without hashing it
- Hash the base commit

## Decision Outcome

Chosen option: "Record the base commit without hashing it", because base-branch movement is handled by strict
up-to-date branches or a merge queue, never by the steward revoking checks, and a push to the base branch fires
no pull-request event that could refresh a hash tied to it. The base ref (target branch) stays in the hash; the
base commit is recorded like the trusted-branch commit, and the report states the base commit it tested.

Composition: a strict object with `snapshot_version: 1`. An issue snapshot holds repository, type, number,
issue content hash, attachments (URL, content hash or null), author responses (request id, comment id, content
hash or null for a deleted comment), and policy revision. A PR snapshot holds repository, type, number, target
branch, head commit, base commit, body hash, linked issue (repository, number, content hash), attachments,
author responses, the numbers of the other open PRs sharing the head commit, and policy revision. The snapshot
hash is the SHA-256 of the RFC 8785 canonical JSON of the snapshot without `base_commit`, written
`sha256:<hex>`; body and content hashes cover the body bytes as the API returns them (an absent body is empty);
the title and the trusted-branch commit never enter the hash; lists keep a canonical order.

### Consequences

- [Processes §0.1](../processes.md), [architecture invariant 8 and §9](../architecture.md), the whitepaper §8,
  the user manual's overview, and the repository guidance state the rule.
- Two snapshots that differ only in the base commit have equal hashes.
- Conformance tests check stability under title-only edits, one hash change per hashed input, and unchanged
  hashes for the base and trusted-branch commits.

## More Information

- The project owner decided this on September 26, 2026.
