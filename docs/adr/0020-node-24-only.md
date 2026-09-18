# ADR-0020: Node.js 24 only

- Status: accepted
- Date: 2026-09-17
- Deciders: project owner
- Source: `docs/architecture.md` §6.1

## Context and Problem Statement

The workspace ([ADR-0012](0012-repository-layout.md)) ships a CLI to npm and a JavaScript action that runs inside workflow jobs, and CI builds and tests every package. Which Node.js versions do the CLI and the action runtime support?

## Considered Options

- Node.js 24 only — CI pins Node 24, the CLI declares `engines.node >=24`, and the action targets the `node24` runtime

No other option was recorded.

## Decision Outcome

Chosen option: "Node.js 24 only".

Node 24 only: CLI `engines` `>=24`; action runtime `node24`.

### Consequences

- [Architecture §6.1](../architecture.md) states that the packages use Node 24 only: CI pins Node 24, the CLI declares `engines.node >=24`, and the action targets the `node24` runtime; the [user manual](../user-manual/installation.md) lists Node.js 24 as a prerequisite.

## More Information

- No rationale was recorded for this decision.
- The project owner decided this on September 17, 2026; it was recorded in architecture §6.1 in commit `9c2a1cb` (2026-09-17).
