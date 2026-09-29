# ADR-0089: `steward preflight --run`: the unsandboxed claim runner

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §6.3, §6.5; `docs/processes.md` SP05; `docs/user-manual/commands.md` "`steward preflight`"; `docs/user-manual/usage.md` "Prepare a submission"

## Context and Problem Statement

SP05 CLI step 3 runs the mandatory commands and a before-and-after preview on the contributor's machine without a sandbox ([ADR-0007](0007-local-cli-scope.md)). How it is triggered, guarded, reported, and mapped to exit statuses ([ADR-0066](0066-uniform-cli-conventions.md)) was open.

## Considered Options

- An opt-in `--run` flag that runs the mandatory commands and the before-and-after preview on the contributor's own checkout without a sandbox, printing every argument vector first and marking results as claims
- Always running the mandatory commands
- An interactive confirmation prompt
- Running preflight commands in a local container

## Decision Outcome

Chosen option: "An opt-in `--run` flag that runs the mandatory commands and the before-and-after preview on the contributor's own checkout without a sandbox, printing every argument vector first and marking results as claims", because the contributor asks for the run explicitly and sees exactly what starts. Always running was rejected because it would start repository commands on a contributor's host without being asked. A prompt was rejected because it breaks non-interactive and `--json` use. A container was rejected because it needs a runtime on every contributor machine and would not make these results evidence anyway.

The syntax is:

```text
steward preflight (--issue defect|proposal | --pr) --draft <file.md> [--repo owner/name] [--base <ref>] [--run] [--json]
```

Without `--run` nothing changes: the contract check only, and no repository or policy command runs. With `--run` and a published valid policy, every `mandatory: true` command runs in `execution.commands` order in the contributor's own checkout (the working tree as it is; a dirty tree adds the warning `preflight.working-tree-dirty`), whatever the contract result. Without a published policy nothing runs, and the warning `preflight.run-without-policy` is printed.

The own-checkout guard requires the run directory's realpath to equal that of `git rev-parse --show-toplevel` from the working directory, or to be a preview worktree this invocation created under the OS temp directory whose git common directory is the checkout's. A bare repository, a directory outside any work tree, a command working directory that leaves the checkout, and any run under `GITHUB_ACTIONS=true` are refused (`runner.not-own-checkout`).

Commands get the process environment minus `GH_TOKEN`, `GITHUB_TOKEN`, `STEWARD_LLM_API_KEY`, and any variable whose value equals a credential the process resolved. They run as argument vectors without a shell, except that on Windows a command whose executable resolves to a `.cmd` or `.bat` shim (for example `pnpm.cmd`) runs as `cmd.exe /d /s /c <escaped command line>` with strict escaping of every argument, and the output says so (`ran through cmd.exe`). Time and output bounds are those of containers (`limits.execution.execution_seconds`, the output keys, `executions_per_run`, `run_execution_seconds`); the resource keys and the container constants do not apply. A timed-out or output-limited process tree is stopped, on Windows with `taskkill.exe /PID <pid> /T /F`.

For `--pr`, the preview runs when the draft's regression-test field is non-empty and at least one path changed between the merge base and `HEAD` is a test path. The steward creates a detached worktree of the merge base outside the checkout with `git -c core.hooksPath=<empty temp dir> worktree add --detach <temp dir> <merge base>` (the contributor's own filters and line-ending settings apply; only hooks are disabled), applies the `HEAD` versions of the test-class paths (overlay path rules plus host realpath checks; deletions and renames applied), runs the declared dependency step there if any, then every mandatory `kind: test` command ("before"). "After" is the result of the same commands in the checkout (no second run). Afterwards the worktree is removed with `git worktree remove --force` and `git worktree prune`. Otherwise the preview is skipped with the note `preflight.preview-skipped` and its reason. Preview failures are warnings `preflight.preview-unavailable` and never change the exit status. Entry ids are `head-<command id>` in the checkout and `base-dependency-step` and `base-<command id>` in the preview. Declared test scaffolding is not applied.

Before each execution, text mode prints `run <entry id>: <argument vector as a JSON array> in <directory>`; then the notice `Commands ran on this machine without a sandbox; their results are claims, not evidence.`; per result `result <entry id>: exit <code>[, timed out][, output limited]; <seconds> s[; JUnit <passed>/<tests> passed, <failed> failed, <errored> errors, <skipped> skipped][; ran through cmd.exe]`, and for a failed command its bounded, redacted output tail. With `--json` the command writes exactly one line on standard output and nothing on standard error; the object gains `run: {requested, notice, executions[], preview}`, where entries carry `id`, `argv`, and `directory`, and `preview` is `{base, overlay_paths[], before[], after[]}` or null.

The exit status is as before for the contract; a mandatory command with a non-zero exit, `timed_out`, or `output_limited` gives 1; a guard refusal or an environment failure (for example a command that cannot start) gives 2; precedence is 2, then 3, then 1, then 0. A plan above `limits.execution.executions_per_run` runs nothing (error `preflight.run-over-budget`, exit 3); exhausting `limits.execution.run_execution_seconds` marks the remaining commands skipped (`execution.time-exhausted`, exit 3).

Results are claims (admissibility `claim`). Nothing is written to GitHub or stored, there is no telemetry, and output is redacted (built-in detectors, policy patterns, exact values of the resolved GitHub token). Without `--run`, the host processes are read-only `git` and `gh auth token --hostname github.com` for credential resolution only. With `--run`, they additionally include the policy's commands (directly, or through `cmd.exe` for Windows batch shims), the preview worktree's `git worktree` commands with hooks disabled, and on Windows `taskkill.exe`.

### Consequences

- Results are claims and never evidence, and the run is refused under `GITHUB_ACTIONS=true`.
- The preview uses the contributor's own filters and line-ending settings with hooks disabled, and never changes the exit status.
- `--json` keeps the one-line convention.
- A test pins the exact host process sets without and with `--run`.
- [Architecture §6.3](../architecture.md) and [SP05](../processes.md) describe the behavior; the command reference documents the options, output, and exit statuses.

## More Information

- The project owner decided this on September 28, 2026.
- Claim admissibility: [ADR-0087](0087-execution-records-result-files-and-claim-admissibility.md).
