# ADR-0077: Steward built at runtime inside jobs

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.1, §6.4, §7, §12.1, §13

## Context and Problem Statement

[ADR-0011](0011-distribution.md) distributed reusable workflows and a JavaScript action published from this
repository, an npm CLI, and a `steward init` command. A JavaScript action runs committed compiled code, and the jobs
that run the core also hold the App private key. How does a workflow pinned by commit SHA obtain the steward code it
runs, and where may dependency installation happen?

## Considered Options

- Build at runtime in a credential-free job
- Commit a compiled bundle at each pinned commit
- Install and build inside the jobs that hold the App key

## Decision Outcome

Chosen option: "Build at runtime in a credential-free job", the project owner's choice over a committed bundle after
its consequences were stated and mitigated; installing inside the jobs that hold the App key was rejected because
install-time code of any dependency would then run in a job that later holds the key, on the filesystem the steward
runs from.

Consequences accepted with the choice: every run installs dependencies from the npm registry and compiles
TypeScript, adding about one to two minutes of billed Actions time and a dependency on the registry's availability;
the pinned commit plus the lockfile's resolved packages fix what runs, but the package tarballs are fetched at run
time.

Mitigations: only the `build` job checks out, installs, and compiles, and it holds no secret and no token; it runs
`pnpm install --frozen-lockfile --ignore-scripts` (pnpm verifies the lockfile's integrity hashes, fails on any
drift, and runs no install scripts; no job edits `pnpm-lock.yaml`); Node 24 comes from `actions/setup-node` pinned by
commit SHA and pnpm from corepack and the root `packageManager` pin, with no third-party setup action and no
dependency cache; every action is pinned by full commit SHA; checkout uses `persist-credentials: false`; every job
has `permissions: {}` and a timeout; the App key appears only in the `env:` of the one step of `gate` and `publish`
that runs the steward; a static test asserts these properties on the workflow text.

Runtime: `build` packs `packages/core/dist`, `packages/action/dist`, their `package.json` files, and the production
dependencies only (`zod`, `yaml`, and the core workspace link) into a tar archive of at most 52428800 bytes (about
2 MB in practice), uploads it as the same-run artifact `steward-runtime` (retained 1 day), and outputs its SHA-256;
`gate` and `publish` download it, verify the SHA-256 before extracting it, and run
`node <runtime>/packages/action/dist/main.js gate` or `publish`, with no install and no build.

`steward_ref`: the wrapper passes the same 40-hex SHA that pins the reusable workflow; a `build` step before the
checkout rejects any value that is not exactly 40 lowercase hexadecimal characters, reading it through `env:`; the
core never receives it; a static test checks that each template's pin and `steward_ref` are equal.

Unchanged from ADR-0011: reusable workflows published from this repository, an npm CLI, and a `steward init`
command that installs templates. The JavaScript action is replaced by the `action` package run from the runtime.
ADR-0011's status becomes `superseded by ADR-0077`.

### Consequences

- [architecture §6.1](../architecture.md) (the action package's entry point), [architecture
  §6.4](../architecture.md) (the `build` job and the runtime), [architecture §7](../architecture.md) (the action
  package row), [architecture §12.1](../architecture.md) (runtime archive size), and [architecture §13](../architecture.md)
  (compromised release) state the design; [ADR-0011](0011-distribution.md) is superseded.

## More Information

- The project owner decided this on September 27, 2026.
