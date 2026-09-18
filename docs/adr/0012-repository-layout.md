# ADR-0012: Repository layout

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Repository layout", commit `0da65aa`

## Context and Problem Statement

One TypeScript screening core runs in every topology ([architecture §3](../architecture.md)) and is used by the CLI, the GitHub action, and the browser app. How is the repository that holds them organized?

## Considered Options

- pnpm monorepo — workspace packages `core`, `cli`, `action`, and `web`, plus the reusable workflows and the templates

No other option was recorded.

## Decision Outcome

Chosen option: "pnpm monorepo".

pnpm monorepo: `core`, `cli`, `action`, `web`, reusable workflows, templates.

### Consequences

- [Architecture §6.1](../architecture.md) defines the layout and the one shared toolchain of the packages.
- The workspace conventions are decided in [ADR-0019](0019-lockstep-versioning-and-cd-manifest.md), [ADR-0020](0020-node-24-only.md), [ADR-0021](0021-test-tiers-and-ci-placement.md), and [ADR-0022](0022-shared-fixture-corpus-home.md).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since; the layout was implemented in commit `9c2a1cb` (2026-09-17).
