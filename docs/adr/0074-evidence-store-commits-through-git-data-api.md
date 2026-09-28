# ADR-0074: Evidence store commits through the Git Data API

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §11, §12.1; `docs/processes.md` SP18 steps 1 and 6

## Context and Problem Statement

[ADR-0009](0009-evidence-store.md) selected an orphan branch or a separate repository as the evidence store;
[ADR-0064](0064-evidence-run-directory-and-local-store.md) fixed the run directory layout and a local store whose
commit point is a directory rename. A GitHub-hosted `publish` job has no checkout and no local store, holds only
scoped App tokens, and may race other runs' publications on the same branch. How does it commit evidence
append-only and prove the write before any other publication step?

## Considered Options

- One commit per run through the Git Data API

No other option was recorded.

## Decision Outcome

Chosen option: "One commit per run through the Git Data API", because one commit adds a whole run directory and
its metrics file at once, a non-forced ref update fails instead of overwriting when another run moved the
branch, and blob ids let the write be verified without downloading it.

The store is named by `evidence.store` of the trusted policy: `orphan-branch` uses the target repository,
`repository` the named repository, both at `refs/heads/<branch>`, with the target's `<owner>/<repo>/` subtree at
the root of either store. The policy template's branch name is `steward-evidence` (it was
`patch-steward-evidence`; both are valid). An absent branch gets a root commit and is created with it, and a
concurrent creation is handled like a non-fast-forward; a store repository must already hold at least one
commit, because the Git database API refuses an empty repository.

`publish` builds one blob per file with exactly the bytes the local store would write, the same manifest, one
tree on the tip's tree with an entry per new path, and one commit with the message
`evidence: <owner>/<repo> <pr|issue>-<number> run <run-id>` and no submission text. Before the update it runs an
append-only check: comparing the tip with the new commit must report one commit ahead in which every
file is added and the paths are exactly the expected ones; otherwise `evidence.store-not-append-only` and no ref
update.

The update is a non-forced ref update, which is the commit point. A non-fast-forward update rebuilds the tree
and commit on the new tip, reusing blobs, and checks again, at most `limits.evidence.write_retries` times,
waiting 1000 ms times the attempt number, at most 10000 ms; then `evidence.store-conflict`.

Before any other publication step, `publish` reads back: the branch contains the commit, and the committed tree
lists exactly the expected entries whose blob ids equal the git blob ids computed locally, so no blob is
downloaded; otherwise `evidence.readback-mismatch`.

Total bytes stay within `limits.evidence.run_bytes`; every request counts against
`limits.github.requests_per_run` with `limits.github.retries_per_request`; the store token names only the store
repository, with contents write. A failed write fails `publish`: no summary outcome, no supersession record.

The only store read in `gate` is the deduplication fallback: the contents listing of the submission's run
directories, under 1000 entries, the latest by run id and attempt, and its `run.json`, at most 1048576 bytes,
validated and matched to the submission; anything else is treated as unavailable.

### Consequences

- [architecture §11](../architecture.md) and [architecture §12.1](../architecture.md) (wait and fallback bounds)
  state the protocol; [SP18](../processes.md) steps 1 and 6 apply it; on the test-beds every evidence commit
  added files only (S05), a separate private evidence repository received its run directory (S16), and an
  unwritable store failed publication with nothing published (S07) (`scenarios/README.md`); pruning and
  retention mechanics stay open (architecture §15).

## More Information

- The project owner decided this on September 27, 2026.
