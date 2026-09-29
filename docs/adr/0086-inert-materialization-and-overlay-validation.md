# ADR-0086: Inert materialization from git objects and overlay validation

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §6.3, §13; `docs/processes.md` SP17 step 1

## Context and Problem Statement

SP17 requires an inert host materialization of the commit under test: no hooks, external filters, automatic
submodule commands, or credential persistence, and overlay paths validated against traversal and symlink escapes.
How the commit is fetched and turned into the container's checkout was open. The host runs the steward with the
maintainer's privileges, so nothing the repository controls may run there, and the bytes in the container must be
the bytes committed.

## Considered Options

- A depth-1 fetch by commit id into a temporary bare repository with inert configuration, and a checkout archive
  the steward builds from git objects
- A clone and checkout with hooks disabled
- `git archive` of the commit
- The GitHub tarball endpoint

## Decision Outcome

Chosen option: "A depth-1 fetch by commit id into a temporary bare repository with inert configuration, and a
checkout archive the steward builds from git objects", because it is the only option in which no repository-controlled
program, filter, or attribute can act on the host and the steward controls every mode, owner, and symlink in the
archive. A clone and checkout was rejected because a checkout applies filters, attributes, and LFS smudging and
writes a working tree on the host. `git archive` was rejected because it applies the `export-ignore` and
`export-subst` attributes. The tarball endpoint was rejected because attribute processing happens on GitHub's side,
it gives no control over modes and symlinks, and it spends REST budget.

The head commit is fetched by a depth-1 fetch by commit id from exactly `https://github.com/<owner>/<repo>.git`:
no tags, no submodule recursion, no `FETCH_HEAD`. The configuration is inert: an empty hooks directory, fsmonitor
off, fsck of fetched objects on, only the https protocol allowed, no credential helper, no askpass. No host `GIT_*`
variable is passed, system and global git configuration are ignored, and terminal prompts are off. A resolved
GitHub token, if any, travels only as environment-only git configuration of an `Authorization` extra header for
`https://github.com/`, never in an argument vector and never persisted. After the fetch the commit id is verified
(`materialize.commit-mismatch` otherwise). The fetch is bounded by `limits.execution.materialize_seconds`.

The tree is read with git plumbing (`ls-tree`, `cat-file --batch`) within `limits.execution.checkout_files`
entries and `limits.execution.checkout_bytes` bytes; only regular files (modes 100644, 100755), symlinks, and
gitlinks are accepted. The steward builds its own POSIX tar archive from the objects: top entry `checkout/`, owner
65532:65532, directories 0755, files 0644 or 0755 by git mode, symlinks stored as symlinks with their committed
target (never resolved), gitlinks (submodules) omitted and listed in the record, and file times set to the
commit's committer time. The archive SHA-256 is recorded. It is written to a host temp file and streamed into the
container; nothing is extracted on the host.

Materialization is inert by construction: no working tree, no checkout, no filter (clean, smudge, process, LFS),
no hook, no attribute processing (`.gitattributes` line endings, filters, `export-ignore`, and `export-subst`
never apply; bytes are exactly as committed), no submodule command, and no repository-controlled program on the
host. The temporary repository, configuration, and archive are deleted afterwards.

Every path is valid UTF-8 of 1 to 4096 bytes with no NUL or control character, no leading `/`, no `\`, no empty,
`.`, or `..` segment, and no segment that, after removing trailing dots and spaces and the HFS-ignorable code
points, case-folds to `.git` or `git~1` (`materialize.path-invalid`).

Overlays are entries `{path, content, mode 100644 or 100755}` or `{path, delete}`, never a symlink, at most
`limits.execution.overlay_files` entries and `limits.execution.overlay_bytes` content bytes. Each path passes the
path rules, no proper prefix of it is a file, symlink, or gitlink, and the path itself is not a symlink, gitlink,
or directory. Any violation rejects the whole materialization with `materialize.overlay-rejected`; no partial
overlay is applied.

### Consequences

- Bytes in the container are exactly as committed; no attribute or filter changes them.
- The copied checkout has no `.git` directory, LFS pointers stay pointers, and submodules are absent and listed in
  the record. Commands that need git metadata, LFS content, or submodules are unsupported in version 1.
- Git fetches use the git protocol, not REST, so they do not count against `limits.github.requests_per_run`.
- Overlays are used only by the `steward preflight --run` preview, where the same rules plus host realpath checks
  apply; `materialize.overlay-rejected` covers any violation.
- The token never appears in an argument vector and is never persisted.

## More Information

- The project owner decided this on September 28, 2026.
- [Architecture §6.3 and §13](../architecture.md) and [SP17](../processes.md) describe the behavior.
- The archive is delivered to a hardened container as described in
  [ADR-0085](0085-container-hardening-profile-and-checkout-delivery.md).
- The limits are policy keys, see [ADR-0083](0083-execution-limits-as-policy-keys.md); the recorded checkout
  identity is described in [ADR-0087](0087-execution-records-result-files-and-claim-admissibility.md).
