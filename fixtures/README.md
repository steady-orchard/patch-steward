# Fixtures

Shared fixture corpus for patch-steward tests: a root directory, not a workspace package (ADR-0022).

Test tiers are selected by filename suffix; every suffix ends in `.test.ts`, so the build exclusion `**/*.test.ts` covers all tiers:

- `*.test.ts` — unit
- `*.fixture.test.ts` — fixture (reads files from this directory)
- `*.container.test.ts` — container
- `*.live.test.ts` — live probe

Tests locate this corpus relative to the test file via `import.meta.url`. Corpus entries grow per milestone.

Current entries:

- `smoke/greeting.txt` — smoke entry proving the fixture-tier wiring.
- `policies/valid/` — valid policies: minimal without inference, Copilot SDK, OpenAI-compatible, and one whose free-text
  fields carry prompt-injection and shell text that must stay data.
- `policies/invalid/` — policies that each break one validation rule, among them the four cross-field execution-limit rules (output head plus tail above `output_bytes`, an output stream bound below `output_bytes`, a prepared-checkout bound below the checkout bound, and more declared result files than `result_files` allows); `.txt` so the formatter never rewrites them.
- `policies/hostile/` — hostile YAML: aliases, anchors, duplicate keys, custom tags, multiple documents, deep nesting,
  prototype keys, a catastrophic redaction pattern, non-string keys.
- `policies/expectations.json` — validity and failure codes per fixture; the fixture-tier test checks it both ways.
- `junit/` — JUnit XML result files: `samples/` hand-written in the documented shapes of the Vitest and Jest (`jest-junit`) reporters, cargo-nextest, CTest `--output-junit`, GoogleTest, and the Node.js test runner, plus a generic file with an error case; `hostile/` a DOCTYPE, internal and external entities, billion laughs, an unknown entity, nesting deeper than the parser bound, and an attribute flood; `expectations.json` holds the status, counts, total duration, and test identities or the failure code per file, and the fixture-tier test checks it both ways. Invalid UTF-8 is built in test code, never committed.
- `repositories/` — target repositories as JSON manifests (`description`; `commit` with message and epoch time; `entries` of regular files with `mode` and UTF-8 `content` or `base64`, symlinks with their target, and gitlinks with a commit id), built by test code into temporary bare repositories with git plumbing commands so their bytes never depend on line-ending settings: `hostile-materialization.json` carries an attribute filter and line-ending rules, export-subst, CRLF line endings, an LFS pointer, a submodule declaration with its gitlink, and escaping symlinks, all of which materialization must leave inert. Hostile host git configuration (hooks, filter drivers, fsmonitor, URL rewriting, template directories, submodule update commands), hostile tree entry names, and submodule declarations that git's object check rejects are generated in test code, never committed; no live `.gitattributes` or `.gitmodules` file is committed.
- `repositories/shell-sample.json` — a shell project for the container tier: it prints a line and the user id, writes one JUnit result file, and exits with status 3.
- `repositories/typescript-sample.json` — a zero-dependency TypeScript project for the container tier: Node's built-in test runner runs one passing and one failing test by type stripping and writes a JUnit result file.
- `repositories/hostile-limits.json` — resource-exhaustion probes for the container tier: a fork bomb, a memory hog, a sleeper, an output flood, an invalid UTF-8 output flood, and a scratch filler, each a shell script the sandbox limits must stop.
- `repositories/hostile-probes.json` — sandbox probes for the container tier: identity and capability, network, runtime socket, and mount probes, and a canary reader that searches the container environment, process environments, and filesystem for host canary values.
- `repositories/hostile-results.json` — result-file and injection probes for the container tier: a test script that writes a JUnit file whose test names and output carry shell, Markdown, mention, and workflow-expression text, a committed symlink to a system file, a result path that is a directory, a small binary result file, and a 2796203-byte 0xFF result file generated at run time; one declared result file is never written.
- `submissions/` — issue and pull request bodies, also used as preflight drafts, rendered in the issue-form and pull
  request template layouts as byte-exact `.txt`: complete, missing, duplicated, and unstructured cases, severity
  wording, and hostile or injection text that must stay data. Control and format characters are generated in test
  code, never committed.
- `submissions/diffs/` — changed-path lists (JSON arrays of change kind, path, and previous path) paired with pull
  request bodies: code, documentation only, documentation with a code path, a rename from code into documentation, a
  package manifest, a workflow, and the policy file changed or deleted.
- `submissions/proposed-policy-valid.yml` and `submissions/proposed-policy-invalid.txt` — policies a pull request
  proposes in its policy directory: one valid that enforces by default, unlike the policy template, and one with an
  unknown key (`.txt` so the formatter never rewrites it).
- `submissions/expectations.json` — one case per contract check: body, submission type, policy variant, diff, linked-
  issue and shared-head inputs, proposed policy, and the expected template match, finding codes, and disposition; the
  fixture-tier test checks it both ways.
- `github/testbed/` — REST responses recorded read-only with `gh api` from the public test-bed repository
  `steady-orchard/patch-steward-testbed-public` on 2026-09-26: the repository, issues 29 and 30, issue 26 read
  through the issues endpoint (it is a pull request), pull requests 26–28 and their files, the pull requests
  associated with one head commit, the `master` branch ref, the `.github` directory listing at that commit, and one
  issue comment. Repository `description` values are replaced with neutral text; everything else is as served.
  Tests read them through the GitHub adapter and check that no file matches a built-in credential detector.
- `github/hostile/` — hand-built malformed responses (a missing key, wrong types, an unknown file status);
  oversize bodies and broken pagination are generated in test code.
- `github/policy-directory/` — hand-built responses for a synthetic repository whose policy directory holds one
  `policy.yml` (a copy of `policies/valid/minimal-no-llm.yml`); tests check that the published-policy revision
  equals the git tree id.
- `github/hosted/` — REST responses recorded read-only with `gh api` from the public test-bed repository
  `steady-orchard/patch-steward-testbed-public` on 2026-09-28 for the hosted adapters: one page of the artifact listing, one
  page of the workflow run list and the in-progress run list (run items reduced to identifiers, name, display title, path,
  event, status, conclusion, timestamps, attempt, and head branch and commit), the `master` branch ref, its commit (reduced
  to the commit, tree, and parent ids and URLs), the comparison with its parent (reduced to status, counts, and per-file
  name, status, blob id, and line counts), the `.github` subtree read as `<commit>:.github`, the `README.md` contents
  response, the `.github` directory listing on the branch, and the App's bot user. Everything else is as served. Tests read
  them through the hosted adapters and check that no file matches a built-in credential detector; write responses, token
  responses, and artifact downloads are synthetic and built in test code.
- `events/` — hand-built webhook payloads in the shapes GitHub delivers to the two wrapper workflows (`issues` and
  `pull_request_target`), carrying the identifiers of the recorded test-bed issue 29 and pull request 26: opened, edited,
  edited by the App's bot user, edited with hostile title and body text, reopened, closed by the author and by another user,
  deleted, an issue event for a pull request, synchronize, a merged closure, and a pull request from a fork. The hosted gate
  and publish tests authenticate them against a matching runner environment; control and format characters are generated in
  test code, never committed.
- `reports/` — golden screening reports and check-run summaries as byte-exact `.txt`, one pair per case listed in
  `reports/cases.json`: an unstructured issue, a complete defect issue, a pull request with a missing field and an attachment
  violation, an execution-sensitive change, a shared head commit, a run under a local policy file, more blockers than a
  report lists, hostile derived text, a pull request whose head was executed in a container, and a pull request whose
  execution plan ended in an environment failure. The fixture-tier test builds each run in a temporary directory with a fixed
  clock, random source, and steward version and compares after CRLF-to-LF normalization; control and format characters
  and credential samples are generated in test code, and no run directory is committed.
- `screen/expectations.json` — local screening scenarios run end to end through the core screening path: each case
  names the recorded test-bed responses or a synthetic repository whose published policy comes from
  `github/policy-directory/`, an optional body from `submissions/` with literal replacements, changed files,
  shared-head and linked-issue variations, failing attachment fetches, the policy source, a resolved token, and the
  evidence directory, and pins the exit status, outcome, finding codes, causes, and whether a run directory exists;
  the fixture-tier test checks it both ways, builds responses in test code, writes runs only to temporary
  directories, and never commits a run directory.
