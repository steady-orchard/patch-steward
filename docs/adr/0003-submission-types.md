# ADR-0003: Submission types

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Submission types", commit `0da65aa`

## Context and Problem Statement

The [problem statement](../problem-statement.md) covers pull requests, issues, security reports, and review comments. Which kinds of submission does version 1 screen?

## Considered Options

- Issues and pull requests — GitHub issues and pull requests are the submission types

No other option was recorded.

## Decision Outcome

Chosen option: "Issues and pull requests".

Issues and pull requests.

### Consequences

- [Architecture §1.1](../architecture.md) scopes version 1 to GitHub issues and pull requests in public or private repositories; [architecture §10](../architecture.md) defines their states and their GitHub representation.
- Intake of both types follows [SP06](../processes.md).
- Security reports are handled by [ADR-0004](0004-security-reports.md), and automated activity in review exchanges by [ADR-0010](0010-automated-participation.md).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
