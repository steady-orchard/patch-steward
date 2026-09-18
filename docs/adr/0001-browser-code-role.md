# ADR-0001: Browser code role

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Browser code role", commit `0da65aa`

## Context and Problem Statement

Contributors need to see a project's expectations before they write an issue or a pull request, and maintainers need a view of queues, evidence, and calibration metrics. Patch Steward runs without a hosted backend ([whitepaper §11](../whitepaper.md)), so any browser code has to work from files that GitHub serves. What role does browser code play in version 1?

## Considered Options

- One static app with two faces — a single static application on GitHub Pages that is both the contributor submission assistant and the maintainer dashboard

No other option was recorded.

## Decision Outcome

Chosen option: "One static app with two faces".

One static app on GitHub Pages with two faces: contributor submission assistant and maintainer dashboard.

### Consequences

- [Architecture §6.6](../architecture.md) defines the static bundle, its two faces, the data contract that the maintenance workflow publishes to GitHub Pages, and its deployment; [architecture §4](../architecture.md) confines it to zone Z6.
- The contributor face runs the browser assistant steps of [SP05](../processes.md); publication of the bundle and its data belongs to [SP18](../processes.md).
- What the app may hold and do is decided in [ADR-0002](0002-browser-secrets.md).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
