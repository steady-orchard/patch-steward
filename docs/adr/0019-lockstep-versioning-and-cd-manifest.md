# ADR-0019: One lockstep version with root package.json as the CD manifest

- Status: accepted
- Date: 2026-09-17
- Deciders: project owner
- Source: `docs/architecture.md` §6.1

## Context and Problem Statement

The single-package scaffold became a pnpm workspace of several packages ([ADR-0012](0012-repository-layout.md)). The CD workflow builds and tags a release when the version in the root `package.json` changes on `master`. How are the packages versioned, and which manifest does the CD trigger read?

## Considered Options

- One lockstep version with root package.json as the CD manifest — every package carries the root version, and the CD trigger keeps reading the root `package.json`
- Per-package versions — each package carries its own version

## Decision Outcome

Chosen option: "One lockstep version with root package.json as the CD manifest", because the CD workflow's path filter and tag logic keep their semantics.

One shared version; root `package.json` is the source the CD trigger reads; packages stay in lockstep.

### Consequences

- [Architecture §6.1](../architecture.md) states that all packages version in lockstep with the root `package.json`, which stays the manifest the CD workflow reads for release tagging; the scaffold configuration section of the [user manual](../user-manual/configuration.md) states the same.

## More Information

- The project owner decided this on September 17, 2026; it was recorded in architecture §6.1 in commit `9c2a1cb` (2026-09-17).
