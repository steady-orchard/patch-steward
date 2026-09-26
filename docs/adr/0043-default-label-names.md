# ADR-0043: Default label names

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §10; `docs/user-manual/configuration.md` "Policy keys"

## Context and Problem Statement

Architecture §10 defines two label families: `steward:<state>` for status (`queued`, `awaiting-approval`,
`screening`, `pass`, `awaiting-author`, `triage`) and `claim:<classification>` for issues (`supported-defect`,
`intended-behavior`, `feature-request`, `accepted-proposal`, `proposal-pending`, `duplicate`, `uncertain`). Labels
are outputs, never inputs, but their names must be configurable, since a project's existing labels can collide with
the family names.

## Considered Options

- Family names as defaults, overridable per name — the thirteen family names are defaults; the policy may override
  any single name
- Every name required — the policy must name all thirteen labels
- Fixed names — no configuration

## Decision Outcome

Chosen option: "Family names as defaults, overridable per name", because most projects need no label configuration
at all, and a project whose names collide with existing labels only needs to override the colliding ones; requiring
every name would burden every project for the sake of the few with collisions, and fixed names would remove
configurability the design otherwise provides.

The policy keys `labels.status.<state>` and `labels.classification.<classification>` are each optional overrides of
a single default name. Overridden or default, names must be unique across all thirteen labels case-insensitively,
non-empty, within the label-name bound (`policy.label-name`), and without leading or trailing whitespace or control
characters. Label colors and descriptions are steward constants applied when labels are created, not policy
settings.

### Consequences

- [Architecture §10](../architecture.md) states the default names and the per-name override keys.
- [Architecture §8](../architecture.md) lists `labels.status.<state>` and `labels.classification.<classification>` in
  the Labels row and its Defaults.
- The [configuration reference](../user-manual/configuration.md) documents the Labels overrides.

## More Information

- The project owner decided this on September 26, 2026.
