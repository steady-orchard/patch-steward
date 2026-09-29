# ADR-0081: Test result evidence: exit status and JUnit XML

- Status: accepted
- Date: 2026-09-28
- Deciders: project owner
- Source: `docs/architecture.md` §8, §9, §12.1; `docs/processes.md` SP17; `docs/user-manual/configuration.md` "Execution"

## Context and Problem Statement

[ADR-0017](0017-first-ecosystems-for-result-parsing.md) left test result parsing open: policy-declared result formats versus exit-code-only evidence (architecture §15). Sandboxed execution now produces output, an exit status, and optionally files written by the test runner. Baselines and anti-gaming comparisons need test identities and counts, but result files come from submitted code and are hostile input to the steward.

## Considered Options

- "Exit status always, plus declared JUnit XML result files parsed by a bounded, entity-free parser"
- "Exit status only"
- "Several result formats, for example TAP and JUnit XML"
- "A third-party XML parser"

## Decision Outcome

Chosen option: "Exit status always, plus declared JUnit XML result files parsed by a bounded, entity-free parser", because it keeps the exit status as primary evidence and adds the test identities and counts that later comparisons need, with the smallest hostile-input surface. Exit status alone was rejected because it loses the test identities and counts that baselines and anti-gaming comparisons need. More formats were rejected because each one multiplies the hostile-input surface while JUnit XML already covers the reporters of the first ecosystems. A third-party parser was rejected because it adds a runtime dependency and usually supports DTDs and entity expansion.

The exit status is always recorded. A command declares result files in `execution.commands[].result_files[]` with format `junit-xml`; paths are relative to the repository root, not to the command's working directory. Each file is copied out of the container as a tar stream that must hold exactly one regular file of at most `limits.execution.result_file_bytes`. At most `limits.execution.result_files` files are declared per command. Each declared file gets one status:

- `not-regular`: the entry is a symlink, directory, or other type; it is never followed.
- `missing`: the file is absent.
- `too-large`: the file exceeds the bound; reading stops at the bound.
- `malformed`: the file cannot be parsed.
- `parsed`: otherwise.

JUnit XML is the only version-1 format. It is written by the Vitest and Jest reporters, cargo-nextest, CTest `--output-junit`, GoogleTest, and Node's test runner. The steward's own bounded, entity-free parser accepts UTF-8 with one byte-order mark stripped. The XML declaration, comments, CDATA, and processing instructions are skipped. Any `<!DOCTYPE` or `<!ENTITY` makes the file malformed (`junit.doctype-forbidden`). Only the five predefined entities and numeric character references are decoded; nothing is ever resolved. The bounds are nesting depth 64, 200000 elements per file, 64 attributes per element, attribute values of 65536 characters, and test case identities of 4096 characters; longer identities are cut and flagged `identity_truncated`.

The model reads a root `testsuites` or `testsuite`, with nested suites allowed. Each test case's status comes from its children: error, then failure, then skipped, else pass. `time` in seconds becomes integer milliseconds; an invalid or negative value gives null. The identity is `<classname>::<name>`, cases stay in document order, and duplicates are kept. Counts (tests, passed, failed, errored, skipped, duration) are computed from the cases, never from suite attributes. The record lists the first `limits.execution.result_test_cases` cases and flags `cases_truncated` when more exist.

Version 1 does not classify results: it records statuses and counts only. A missing or malformed declared file is recorded as such, and interpreting it belongs to later stages. A command's non-zero exit is never turned into a finding.

### Consequences

- [ADR-0017](0017-first-ecosystems-for-result-parsing.md) stays accepted and its open item is settled here.
- Version 1 does not classify results; later stages interpret the recorded statuses and counts.
- Counts are computed from test cases, never from suite attributes, so a result file cannot report counts that disagree with its cases.
- The parser bounds are hard-only constants, not policy keys ([ADR-0083](0083-execution-limits-as-policy-keys.md)); the file size, file count, and listed case count are policy keys.
- The integrity limitation stands: submitted code can still control the test runner, the exit status, and the result files. Parsing bounds protect the steward, not the honesty of results.
- The architecture no longer lists test result parsing as open.

## More Information

- The project owner decided this on September 28, 2026.
- Related records: [ADR-0017](0017-first-ecosystems-for-result-parsing.md) and [ADR-0087](0087-execution-records-result-files-and-claim-admissibility.md).
