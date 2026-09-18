# ADR-0021: Test tiers and their CI placement

- Status: accepted
- Date: 2026-09-17
- Deciders: project owner
- Source: `docs/architecture.md` §6.1

## Context and Problem Statement

Tests range from pure unit tests to tests that read a shared fixture corpus, tests that need a container runtime, and live probes of GitHub and model services. Which test tiers exist, and which of them run in CI?

## Considered Options

- Four tiers with fixed CI placement — unit, fixture, container, and live probe, selected by filename suffix

No other option was recorded.

## Decision Outcome

Chosen option: "Four tiers with fixed CI placement".

Unit and fixture on Ubuntu and Windows; container on Ubuntu only; live probe never in CI. CI makes no live GitHub or model calls.

### Consequences

- [Architecture §6.1](../architecture.md) tiers tests by filename suffix (`*.test.ts` unit, `*.fixture.test.ts` fixture, `*.container.test.ts` container, `*.live.test.ts` live probe) and states where CI runs each tier; the [fixture corpus README](../../fixtures/README.md) lists the same suffixes.
- The platform-assumption probe suite never runs in CI either ([ADR-0023](0023-probe-suite-location.md)).

## More Information

- No rationale was recorded for this decision.
- The project owner decided this on September 17, 2026; it was recorded in architecture §6.1 in commit `9c2a1cb` (2026-09-17).
