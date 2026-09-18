# ADR-0011: Distribution

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Distribution", commit `0da65aa`

## Context and Problem Statement

A target repository needs the steward's pipeline logic, the action that runs the core inside workflow jobs, a command-line tool, and the files that connect them to the repository. How is Patch Steward distributed?

## Considered Options

- Published from this repository — reusable workflows and a JavaScript action published from this repository, an npm CLI, and a `steward init` command that installs templates

No other option was recorded.

## Decision Outcome

Chosen option: "Published from this repository".

Reusable workflows and a JavaScript action published from this repository, an npm CLI, and a `steward init` command that installs templates.

### Consequences

- [Architecture §6.1](../architecture.md) places the reusable steward workflows, the action, the CLI, and the templates in this repository; [architecture §6.4](../architecture.md) has thin wrappers call the reusable workflows pinned by immutable commit SHA.
- [Architecture §6.5](../architecture.md) defines `steward init`, and [architecture §6.7](../architecture.md) the files it installs; [SP02](../processes.md) step 1 runs it.
- Pinning by commit SHA is the first control against a compromised steward release ([architecture §13](../architecture.md)).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
