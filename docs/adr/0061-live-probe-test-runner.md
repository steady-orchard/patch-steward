# ADR-0061: Live-probe test runner

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.1; `docs/user-manual/configuration.md` "Scaffold configuration"

## Context and Problem Statement

The live-probe tier (`*.live.test.ts`) existed by name in [ADR-0021](0021-test-tiers-and-ci-placement.md) with
no runner to execute it. Recorded GitHub responses used by the default suite can drift from what GitHub
actually serves over time. CI must make no live network calls under any circumstance. What runs the live tier,
and how does it stay separate from the suite CI executes?

## Considered Options

- Separate Vitest configuration and script, never in CI — a dedicated config and root script, excluded from CI
  entirely
- Recorded fixtures only — never add a runner, and accept that recorded shapes may drift silently
- Live tests in the default suite behind an environment flag — keep one Vitest configuration, gated by a
  runtime check

## Decision Outcome

Chosen option: "Separate Vitest configuration and script, never in CI", because live reads are the only way to
detect drift in the recorded fixture shapes the default suite depends on, while keeping that default suite
offline and deterministic. An environment flag inside the default suite could turn on live calls in CI by
accident, since flags meant for local use tend to leak into CI environments over time; a fully separate
configuration cannot be triggered by any CI job that never invokes it.

The root `vitest.live.config.ts` runs `packages/*/src/**/*.live.test.ts` with the same core alias as the
default configuration, one file at a time, with 60-second timeouts. The root script `pnpm test:live` runs it.
`pnpm test` and CI are unchanged by its existence. Live tests only read public test-bed data, use `GH_TOKEN`
when it is set, and skip with a visible message when GitHub is unreachable, rather than failing the run.

### Consequences

- The configuration reference and [architecture §6.1](../architecture.md) describe the tier and its runner.
- The repository guidance lists the `pnpm test:live` command.
- The tier placement `*.live.test.ts` decided in [ADR-0021](0021-test-tiers-and-ci-placement.md) is unchanged.

## More Information

- The project owner decided this on September 26, 2026.
