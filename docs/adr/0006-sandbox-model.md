# ADR-0006: Sandbox model

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Sandbox model", commit `0da65aa`

## Context and Problem Statement

Screening executes submitted code, contributor-supplied reproductions, and generated tests. Worktrees, virtual environments, and plain subprocesses are not sandboxes ([whitepaper §12](../whitepaper.md)), and projects may already run their own CI. Where do steward-controlled executions run, and what do their results and the results of project CI establish?

## Considered Options

- Containers without credentials — steward-controlled executions run in containers without credentials; project CI results stay signals with their provenance

No other option was recorded.

## Decision Outcome

Chosen option: "Containers without credentials", because isolation protects credentials and hosts, while the integrity of test results remains a stated limitation.

Steward-controlled executions run in containers without credentials. CI signals retain their provenance; neither topology guarantees honest test output. Execution-sensitive changes require triage.

### Consequences

- [Architecture §2](../architecture.md) invariant 3 and zone Z2 of [architecture §4](../architecture.md) define the sandbox; the §4 boundary rules for project CI and for execution integrity keep CI results as signals and route execution-sensitive changes to maintainer triage.
- [SP17](../processes.md) runs every steward-controlled execution in a container; project CI enters [SP12](../processes.md) only as a signal.
- The threat table of [architecture §13](../architecture.md) claims no isolation-based guarantee against manipulated test results.

## More Information

- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
