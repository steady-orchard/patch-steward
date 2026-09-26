# ADR-0034: Policy schema covers every policy area in version 1

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8; `docs/user-manual/configuration.md` "Policy keys"

## Context and Problem Statement

The architecture listed the policy's content areas (supported behavior, trusted and
execution-sensitive paths, categories, submission, execution, runner, inference, stages,
escalation, limits, policy change, modes, follow-through, hygiene, evidence, dismissal
codes) without keys. Every later capability reads the policy, and the validator must reject
unknown keys and check that referenced commands are declared. The platform matrix also had
to say which declared commands each platform covers, and nothing before it referenced
commands. Two questions followed: how much of the schema to fix now, and how platforms and
commands relate to each other.

## Considered Options

- Full schema; platforms list their commands — every area keyed now, each key traced to a design statement; each `execution.platforms[]` entry lists in `commands` the ids of the declared `execution.commands[]` it runs, or whose coverage its CI workflow stands for
- Full schema; commands list their platforms — each `execution.commands[]` entry lists the ids of the platforms it runs on
- Full schema; no platform-command mapping — every declared command runs on every platform
- Minimal schema — only the keys the policy module reads now; each area keyed when the capability that reads it arrives

## Decision Outcome

Chosen option: "Full schema; platforms list their commands", because a complete key set
gives maintainers, the template, and editor tooling one stable contract, and unknown-key
rejection means something only against the complete set; later capabilities add keys only
additively instead of changing `version`. Platforms listing their commands keep a
platform's coverage in one place, which regression analysis needs to compare per platform
and command, lets a CI-signal platform name exactly the commands its workflow stands for,
and makes an undeclared-reference rule checkable: every entry must name a declared
`execution.commands[].id` (`policy.undeclared-reference`) and appear once per platform
(`policy.duplicate-id`). Commands listing platforms scatters a platform's coverage across
commands and leaves a CI workflow's coverage implicit; no mapping cannot express partial
coverage such as a Linux-only lint or a CI workflow that runs only the tests, and leaves
the undeclared-command rule nothing to check. The minimal schema would change the contract
with every capability.

Component, document, decision, and design-rule ids are declared, and unique within their
lists, but no version-1 key references them. Some keys exist before the capability that
reads them and carry conservative template values that later releases complete
additively: the built-in trusted and execution-sensitive path lists, attachment
destinations and formats, result-file formats, dependency-step network detail, the runner
image strategy, the default model (the template writes the placeholder
`replace-with-model-id`), and security-term and reference-host defaults.

### Consequences

- [architecture §8](../architecture.md) lists the keys of every area and the
  platform-command rule; the [configuration reference](../user-manual/configuration.md)
  lists every key.
- The template `templates/policy/policy.yml` writes every key.

## More Information

- The project owner decided this on September 26, 2026.
- The platform-command mapping (each platform lists its commands) was confirmed by the
  project owner on September 26, 2026, with commands listing platforms and no mapping as
  the alternatives considered.
- Related: [ADR-0035](0035-integer-schema-versions.md).
