# ADR-0083: Execution limits as policy keys with documented defaults

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §8, §12.1; `docs/user-manual/configuration.md` "Limits" and "Defaults"

## Context and Problem Statement

Sandboxed execution needed 17 new limits: `runner.resources.scratch_mb`, `limits.execution.output_head_bytes`, `output_tail_bytes`, `output_stream_bytes`, `result_files`, `result_test_cases`, `checkout_bytes`, `checkout_files`, `prepared_checkout_bytes`, `overlay_files`, `overlay_bytes`, `materialize_seconds`, `image_pull_seconds`, `image_build_seconds`, `image_bytes`, `build_context_bytes`, and `container_start_seconds`. [ADR-0046](0046-hard-bounds-are-steward-constants.md) makes hard bounds steward constants, and [ADR-0040](0040-required-keys-and-documented-defaults.md) makes keys required unless a default is documented. [ADR-0035](0035-integer-schema-versions.md) lets an optional addition keep the schema version. Policies already exist, including those published on test-bed repositories.

## Considered Options

- "Every new execution limit a policy key, optional, with a default equal to its template value"
- "Hard-only steward constants for the new execution limits"
- "Required policy keys"

## Decision Outcome

Chosen option: "Every new execution limit a policy key, optional, with a default equal to its template value", because maintainers can fit execution limits to their own builds while every existing policy stays valid. Hard-only constants were rejected because they leave maintainers no way to fit execution limits to their own builds. Required keys were rejected because they would invalidate every existing policy, including the policies published on test-bed repositories.

All 17 keys are optional and default to their template value. Policy `version: 1` is unchanged. The template writes every key, and the resolved policy records every effective value. Every value is an integer; an out-of-bounds value is `policy.limit-out-of-bounds` and is never clamped.

| Key                                        | Unit                       | Template value and default | Minimum   | Hard maximum |
| ------------------------------------------ | -------------------------- | -------------------------- | --------- | ------------ |
| `runner.resources.scratch_mb`              | MiB                        | 1024                       | 64        | 8192         |
| `limits.execution.output_head_bytes`       | bytes                      | 262144                     | 1024      | 4194304      |
| `limits.execution.output_tail_bytes`       | bytes                      | 786432                     | 1024      | 4194304      |
| `limits.execution.output_stream_bytes`     | bytes                      | 268435456                  | 65536     | 4294967296   |
| `limits.execution.result_files`            | files per execution        | 5                          | 0         | 20           |
| `limits.execution.result_test_cases`       | test cases per result file | 1000                       | 1         | 1000         |
| `limits.execution.checkout_bytes`          | bytes                      | 536870912                  | 1048576   | 4294967296   |
| `limits.execution.checkout_files`          | files                      | 100000                     | 100       | 1000000      |
| `limits.execution.prepared_checkout_bytes` | bytes                      | 2147483648                 | 1048576   | 8589934592   |
| `limits.execution.overlay_files`           | files                      | 200                        | 1         | 3000         |
| `limits.execution.overlay_bytes`           | bytes                      | 10485760                   | 1024      | 104857600    |
| `limits.execution.materialize_seconds`     | s                          | 300                        | 10        | 1800         |
| `limits.execution.image_pull_seconds`      | s                          | 600                        | 30        | 3600         |
| `limits.execution.image_build_seconds`     | s                          | 1800                       | 60        | 3600         |
| `limits.execution.image_bytes`             | bytes                      | 4294967296                 | 104857600 | 21474836480  |
| `limits.execution.build_context_bytes`     | bytes                      | 10485760                   | 1024      | 104857600    |
| `limits.execution.container_start_seconds` | s                          | 120                        | 5         | 600          |

What each new key enforces:

- `runner.resources.scratch_mb`: size of the `/tmp` tmpfs in every container; its pages count against `runner.resources.memory_mb`.
- `output_head_bytes` and `output_tail_bytes`: the first and the last output bytes kept per execution.
- `output_stream_bytes`: output bytes read before the execution is stopped (`output_limited`).
- `result_files`: declared result files per command (validation) and files copied out per execution.
- `result_test_cases`: test cases listed per result file in the record; all are counted.
- `checkout_bytes` and `checkout_files`: checkout archive bytes (an environment failure beyond) and checkout entries.
- `prepared_checkout_bytes`: the dependency step's exported copy.
- `overlay_files` and `overlay_bytes`: overlay entries and overlay content bytes.
- `materialize_seconds`: fetch, object reads, and archive build per commit.
- `image_pull_seconds`, `image_build_seconds`, `image_bytes`: registry pull, Dockerfile build, and image size after pull or build.
- `build_context_bytes`: the `runner/` build context archive.
- `container_start_seconds`: volume create, container create, copy-in, and start until attached.

Four cross-field rules fail with `policy.invalid-value`, reported at the key path of the second key named:

- `limits.execution.output_head_bytes + limits.execution.output_tail_bytes <= limits.execution.output_bytes`.
- `limits.execution.output_stream_bytes >= limits.execution.output_bytes`.
- `limits.execution.prepared_checkout_bytes >= limits.execution.checkout_bytes`.
- Every `execution.commands[].result_files` list has at most `limits.execution.result_files` entries.

Existing keys keep their meaning and bounds. `limits.execution.output_bytes` is the stored output per execution (head plus tail). `execution_seconds` is the wall clock of one execution from start to exit. `run_execution_seconds` is the sum of execution wall clock in a run, dependency steps included, pulls and builds excluded. `executions_per_run` counts dependency steps and commands. `result_file_bytes` bounds one result file, and `dependency_step_seconds` one dependency step. `limits.stage_seconds` (template 3600) still bounds the execute phase although `limits.execution.run_execution_seconds` has template 7200: the smaller bound applies.

These 13 constants stay hard-only. No policy can set them. They bound parser and protocol safety and runtime plumbing, not the work an execution may do.

| Constant                                  | Value                                     |
| ----------------------------------------- | ----------------------------------------- |
| JUnit XML nesting depth                   | 64                                        |
| JUnit XML elements per file               | 200000                                    |
| JUnit XML attributes per element          | 64                                        |
| JUnit XML attribute value length          | 65536 characters                          |
| Test case identity length                 | 4096 characters                           |
| Container runtime control command timeout | 120000 ms                                 |
| Container runtime control command output  | 1048576 bytes                             |
| Container kill-and-remove grace           | 30000 ms                                  |
| Sandbox user and group                    | `65532:65532`                             |
| Sandbox platform                          | `linux/amd64`                             |
| Sandbox paths                             | checkout `/work/checkout`, scratch `/tmp` |
| Checkout path and symlink target length   | 4096 bytes                                |
| Fetch depth                               | 1 commit                                  |

The control command timeout and output bound apply to `version`, `info`, `inspect`, `volume create`, `volume rm`, `kill`, `rm`, and `image inspect`. Test case identities count UTF-16 code units and are cut on a code point boundary. The sandbox user and group, the sandbox platform, the sandbox paths, and the fetch depth are fixed values, not maxima.

### Consequences

- The policy surface grows by 17 keys, and the template, editor schema, and reference grow with it, giving maintainers more knobs to misconfigure.
- Every future adjustment touches the bounds registry, schema, template, editor schema, documentation, and tests.
- Keys interact through the four cross-field rules.
- Per-repository values make execution evidence less comparable across repositories; a baseline key must include the effective limits.
- Compatibility is kept: the keys are optional with documented defaults and policy `version: 1` is unchanged, so every existing policy stays valid.
- The bounds registry stays the single source, and its test that every integer schema key is registered covers the new keys.
- Hard maxima follow GitHub-hosted Linux runner capacity (4 vCPU, 16 GiB memory, about 14 GB free disk).
- Too-low values fail closed as environment failures (`inconclusive`), never as wrong results.
- Each execution record records the limits applied, so stored evidence stays interpretable after a policy change.
- `limits.stage_seconds` still bounds the execute phase.

## More Information

- The project owner decided this on September 28, 2026.
- Related records: [ADR-0081](0081-test-result-evidence-exit-status-and-junit-xml.md) for the result file keys and the parser constants.
