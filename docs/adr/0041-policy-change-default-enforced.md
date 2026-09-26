# ADR-0041: `policy_change` defaults to `enforced`

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8

## Context and Problem Statement

`policy_change` (`all`, `enforced`, or `manual`) controls rescreening of already published outcomes after the policy changes; replacing an unpublished run superseded by a policy change is mandatory in every setting (architecture §6.4). A default was needed.

## Considered Options

- `enforced` — rescreen published outcomes of enforced categories only
- `all` — rescreen every published outcome
- `manual` — rescreen only on maintainer request

## Decision Outcome

Chosen option: "`enforced`", because enforced categories are the ones whose published checks gate merging, so a stale outcome there matters most; rescreening everything spends inference, which observe mode spends as well, on outcomes that gate nothing; manual leaves enforced checks certifying under a superseded policy until a maintainer acts.

`policy_change` defaults to `enforced` when the policy omits it: only published outcomes in categories under enforcement are rescreened after a policy change. An unpublished run superseded by a policy change is always replaced, regardless of this setting.

### Consequences

- [Architecture §8](../architecture.md) (Policy change row: `enforced` is the default).
- [Architecture §6.4](../architecture.md) and [SP01](../processes.md) step 3 state that unpublished superseded runs are always replaced, independent of this setting.
- [Configuration reference](../user-manual/configuration.md) (Defaults) lists `enforced` as the default.

## More Information

- The project owner decided this on September 26, 2026.
