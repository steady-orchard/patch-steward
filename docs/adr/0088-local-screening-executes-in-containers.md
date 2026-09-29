# ADR-0088: Local screening executes the plan in containers

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §6.2, §6.5; `docs/processes.md` SP20; `docs/user-manual/commands.md` "`steward screen`"; `docs/user-manual/usage.md` "Local screening"

## Context and Problem Statement

[ADR-0067](0067-steward-screen-and-report-commands.md) made `steward screen` a contract-level command; its consequence was that it runs no model and no execution. With the local container runner delivered, whether and how `steward screen` executes repository commands was open: the runtime choice, the plan, the budgets, the effect on outcomes, and the host processes the command may start.

## Considered Options

- `steward screen --pr` executes the head-commit plan in local containers, with `--container-runtime auto|docker|podman`, and the outcome rules unchanged
- Keeping `steward screen` at contract level until stages exist
- A separate command for local execution

## Decision Outcome

Chosen option: "`steward screen --pr` executes the head-commit plan in local containers, with `--container-runtime auto|docker|podman`, and the outcome rules unchanged", because a maintainer can already use execution evidence and the existing command already owns submission capture, policy binding, snapshot, and evidence handling. Keeping the command at contract level was rejected because it withholds execution evidence that the container runner can produce today. A separate command was rejected because it would duplicate submission capture, policy binding, the snapshot, and evidence handling.

The syntax is:

```text
steward screen (--issue <number> | --pr <number>) [--repo owner/name] [--policy-file <path>] [--evidence-dir <dir>] [--container-runtime auto|docker|podman] [--json]
```

`--container-runtime` defaults to `auto`; an invalid value is a usage error (exit 2). Under `--policy-file` a `dockerfile` runner image is unavailable (`runner.image-source-unavailable`); registry images work.

For a pull request whose contract check did not fail, the plan runs against the snapshot head commit: the declared `runner.dependency_step` (if any), then every `mandatory: true` command named by any `execution.platforms[]` entry with `source: container`, deduplicated, in `execution.commands` order, each expected to exit zero. Entry ids are `head-dependency-step` and `head-<command id>`. Issues get an empty plan; a contract failure ends `needs-changes` before any execution; an empty plan starts no runtime command at all.

A plan larger than `limits.execution.executions_per_run` executes nothing (cause `budget-exhausted`, code `execution.over-budget`). Exhausting `limits.execution.run_execution_seconds` mid-plan skips the rest (`budget-exhausted`, `execution.time-exhausted`). The executor stops at the first environment failure and after a failed dependency step. The execute phase is still bounded by `limits.stage_seconds`.

Outcomes are unchanged. Because no screening stage exists, a run ends `needs-changes` (contract failure) or `inconclusive` with cause `stage-incomplete`, plus `environment-unavailable` or `budget-exhausted` when they occur; `steward screen` and `steward report` exit 3 for such a run. A command's non-zero exit status is recorded, never classified or turned into a finding.

The phases are `intake` (plans), `execute` (runs the plan in containers), `assess` (a pass-through), and `publish` (redacts and stores). Plan and results travel between phases as validated transport records bound to the run.

The submission is read through the GitHub REST API with GET requests only, and the head commit is fetched by id over HTTPS git. Nothing is written to GitHub and no check is created. The host processes the command starts are `git` (read-only remote reads and the inert fetch), the selected container runtime binary, and `gh auth token --hostname github.com` for credential resolution only (at most once, before any execution, and only when `GH_TOKEN` and `GITHUB_TOKEN` are unset or empty); never a repository command on the host.

Stored evidence gains `executions/execution-NNNN.json` per execution record in plan order, `executions/execution-NNNN/output.txt` per record, stored result files `executions/execution-NNNN/result-<k>.xml`, and the Dockerfile build log `logs/image-build.txt`. The run record gains `runner_identity`, and the run budget gains `executions` and `container_seconds`. `steward report` verifies all of it. Every output still states that the run is local and not the repository's official result.

### Consequences

- This record supersedes ADR-0067, whose status becomes `superseded by ADR-0088`; its syntax, policy, evidence-location, and exit-status decisions carry over unchanged except the added `--container-runtime` option and the execution.
- Runs still end `needs-changes` or `inconclusive` with `stage-incomplete` because no screening stage exists (see [ADR-0069](0069-required-stages-never-pass-incomplete.md)).
- Golden reports cover an executed pull request and an execution plan that ended in an environment failure.
- A test proves the exact host process set.
- [Architecture §6.5](../architecture.md) and [SP20](../processes.md) describe the command; the command reference and the usage guide document the option and the evidence.

## More Information

- The project owner decided this on September 28, 2026.
- Execution records and result files: [ADR-0087](0087-execution-records-result-files-and-claim-admissibility.md).
- Image sources and the build cache: [ADR-0079](0079-runner-image-sources-and-local-build-cache.md).
