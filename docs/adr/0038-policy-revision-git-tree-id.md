# ADR-0038: Policy revision is the git tree id of the policy directory

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8, §9; `docs/processes.md` SP01

## Context and Problem Statement

Every report records the policy revision, and a run cannot publish once the revision changed. The design called the revision a "content hash of the policy directory" without defining it. It must be identical on Windows and Linux, unchanged by commits outside `.github/patch-steward/`, changed by any change inside it, cheap to obtain inside Actions, and checkable by maintainers with standard tools.

## Considered Options

- Git tree id of the policy directory — the tree object id of `.github/patch-steward/` at the trusted commit, read from git objects
- Steward-computed content hash — a hash the steward computes over the directory's file paths and bytes
- Trusted commit id — the default-branch commit at load

## Decision Outcome

Chosen option: "Git tree id of the policy directory", because git objects hold committed bytes, so checkout line-ending conversion cannot affect it and it is identical on every operating system; it is unchanged by commits outside the directory and changed by any byte, file, or mode change inside it, including `runner/`; in Actions one GitHub API call returns it (GraphQL `object(expression: "<commit>:.github/patch-steward") { oid }`, or the contents API entry `sha`); and anyone can check it with `git rev-parse <commit>:.github/patch-steward`. A steward-computed hash would need its own rules for file order, modes, and line endings, one read per file in Actions, and a custom tool to check. The commit id changes with every unrelated commit, so unrelated commits would supersede runs; it stays recorded for traceability only.

SHA-1 repositories give 40 hexadecimal characters, SHA-256 repositories 64. Reads are inert: git read plumbing only (`rev-parse`, `ls-tree`, `cat-file`) through an argument vector, `--end-of-options` before the ref, refs starting with `-` rejected, inherited `GIT_*` environment variables removed, no fetch, checkout, hooks, or filters, bounded time and output; `policy.yml` must be a regular file, not a symbolic link or submodule entry. An explicitly named local file gets `local:<sha256 of the file bytes>` and is never authoritative; no interface marks a file authoritative. Reading the id through the GitHub API is not implemented yet.

### Consequences

- [Architecture §8](../architecture.md) (location and revision) and [§9](../architecture.md) (policy revision entity), invariant 8 in [architecture §2](../architecture.md), and [SP01](../processes.md) step 3 now say "git tree id" and "policy revision" instead of a content hash.
- [Configuration reference](../user-manual/configuration.md) ("Policy file and revision") states the same rule.

## More Information

- The project owner decided this on September 26, 2026.
