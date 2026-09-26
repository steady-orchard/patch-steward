# ADR-0044: Built-in dismissal-code catalog

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` SP01; `docs/user-manual/configuration.md` "Policy keys"

## Context and Problem Statement

Dismissal codes appear in reports, overrides, and resolutions, and should mean the same thing in every project
(O02). An earlier draft of SP01 listed nine example codes and let projects extend the catalog freely; whether those
codes are fixed by the steward or merely a suggested starting point needed a decision.

## Considered Options

- Nine built-in codes; projects add — `no-reproduction`, `intended-behavior`, `not-applicable-version`,
  `unsupported-claim`, `fabricated-reference`, `duplicate`, `out-of-scope`, `insufficient-benefit`, and
  `proposal-required` are built into the steward with fixed definitions; projects add codes but cannot remove or
  redefine built-ins
- Editable template catalog — the template ships the codes and projects may edit or remove them
- Project-defined catalogs only — no built-in codes

## Decision Outcome

Chosen option: "Nine built-in codes; projects add", because fixed definitions keep a code's meaning stable across
projects and releases, which lets reports, calibration, and cross-project comparison stay comparable; an editable
template or no built-ins at all would let each project redefine or drop the shared vocabulary.

The nine codes above are always available with stable definitions. The policy key `dismissal_codes` lists project
additions only: each entry's `code` is unique, lowercase kebab form, and not equal to a built-in code; its
`definition` is a bounded, non-empty sentence (`policy.dismissal-code` otherwise). The template shows the built-in
catalog with definitions as comments. The resolved policy and the public subset both list the built-in codes plus
any additions, with definitions stated in the configuration reference.

### Consequences

- [SP01 step 4](../processes.md) states the nine built-in codes and the addition rule.
- The [configuration reference](../user-manual/configuration.md) documents the Dismissal codes, including their
  definitions.
- [Architecture §8](../architecture.md) lists `dismissal_codes[]` in the Dismissal codes row.

## More Information

- The project owner decided this on September 26, 2026.
