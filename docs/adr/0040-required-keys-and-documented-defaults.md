# ADR-0040: Required policy keys and documented defaults

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8; `docs/user-manual/configuration.md` "Policy keys"

## Context and Problem Statement

SP01 forbids silent fallback to defaults, yet the design already states defaults for a few settings. Which keys may be omitted?

## Considered Options

- Required keys with documented defaults only — every key required except those whose default the design states
- Defaults for every key — the steward fills any omitted key
- Every key required — no defaults at all

## Decision Outcome

Chosen option: "Required keys with documented defaults only", because steward-chosen values for undocumented defaults would silently govern screening, which SP01 forbids; requiring even the documented defaults would force maintainers to restate values the design already fixes, such as the only allowed execution network, `none`, and all label names.

The defaults are `llm.admission` (`all`), `submission.unrequested_change` (`propose-first`), `submission.free_form` (`false`, [ADR-0042](0042-free-form-submissions-off-by-default.md)), `runner.network` (`none`), `policy_change` (`enforced`, [ADR-0041](0041-policy-change-default-enforced.md)), and each label name under `labels` ([ADR-0043](0043-default-label-names.md)). A missing required key is `policy.missing-key`. The resolved policy records the effective value of every key, merges built-in and project dismissal codes, and sets `llm` to null when absent. The policy template writes every key explicitly, including the defaulted ones.

### Consequences

- [Architecture §8](../architecture.md) (Defaults paragraph) states the list of keys with documented defaults.
- [Configuration reference](../user-manual/configuration.md) (Defaults table) lists them for maintainers.
- [SP01](../processes.md) failure handling ties a missing required key to `policy-invalid`.

## More Information

- The project owner decided this on September 26, 2026.
- [ADR-0041](0041-policy-change-default-enforced.md)
- [ADR-0042](0042-free-form-submissions-off-by-default.md)
- [ADR-0043](0043-default-label-names.md)
