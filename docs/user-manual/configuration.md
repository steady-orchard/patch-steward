# Configuration

[Manual contents](README.md) · [Command reference](commands.md) · [Troubleshooting](troubleshooting.md)

The policy file format is available: the core loads, validates, and resolves a
policy, and [`steward policy`](commands.md#steward-policy-available) checks one
from the command line. The deterministic submission contract check, which
`steward preflight` runs, reads the trusted and execution-sensitive paths,
categories, submission settings, modes, and GitHub and attachment limits.
[`steward screen`](commands.md#steward-screen-available) also applies the
policy at contract level and writes [local evidence](#local-evidence-and-reports-available).
No screening stage runs yet, so sections marked Proposed describe settings
whose effects are not implemented. [Policy keys](#policy-keys-available) lists every
key.

## Policy file and revision (Available)

The quality contract is a YAML file at:

```text
.github/patch-steward/policy.yml
```

Start from the [policy template](../../templates/policy/policy.yml), copy it to
that path on the default branch, and edit it: the template writes every key,
holds credential references only, and validates as shipped, but its `llm.model`
placeholder `replace-with-model-id` must be replaced. The [editor JSON
Schema](../../templates/policy/policy.schema.json) supports editor completion;
the runtime validation governs, cross-field rules are not expressible in it, and
it must not be copied into `.github/patch-steward/`, because every file there
changes the revision.

Official screening loads the policy from the default branch at run start. The
revision is the git tree id of `.github/patch-steward/` at the trusted commit,
read from git objects (`git rev-parse <commit>:.github/patch-steward`); it is
the same on every operating system, unchanged by commits outside the directory,
and changed by any content, file, or mode change inside it, including
`runner/`. The default-branch commit is recorded separately for traceability. A
local policy file named explicitly (for example with `steward policy --file`)
has the revision `local:<sha256 of the file bytes>` and is never authoritative.

Maintainers own the policy through CODEOWNERS and, where the repository's plan
and visibility offer rulesets, required code-owner review. On a Free-plan
organization's private repository GitHub refuses rulesets, so that review is
unavailable.
A PR proposing a policy change is screened under the existing trusted policy.
An explicit local policy experiment is non-authoritative, and replay pins an
explicit historical revision.

Sources: [architecture §8](../architecture.md#8-policy-the-quality-contract),
[SP01](../processes.md#sp01-policy-management),
[policy template](../../templates/policy/policy.yml).

## Policy validation (Available)

Validation runs these stages in order:

1. Size: the file is at most 262144 bytes.
2. UTF-8: the bytes must be valid UTF-8; one leading byte-order mark is ignored.
3. Strict YAML 1.2 core schema: one document; no anchors, aliases, explicit
   tags, `%YAML` or `%TAG` directives; unique string keys; no `__proto__`,
   `constructor`, or `prototype` key; at most 32 nesting levels and 20000
   nodes.
4. `version`: must be the integer `1`; a missing or other value stops
   validation.
5. Strict schema and credential scan.
6. Cross-field rules, evaluated only once the structure is otherwise valid.

Each reported error carries a code, a key path (segments joined by `.`, list
positions given as numbers), a message, and a line and column when known; an
excerpt is at most 80 characters, with credential-like text redacted and
control and Markdown characters escaped. At most 100 errors are reported. An
invalid trusted policy makes every run `inconclusive`, and no default is
substituted beyond the documented ones (see [Defaults](#defaults)).

| Code                          | Meaning                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `policy.version-missing`      | `version` is absent.                                                                                                                                                                                                                                                                    |
| `policy.version-unsupported`  | `version` is not `1`.                                                                                                                                                                                                                                                                   |
| `policy.unknown-key`          | A key the schema does not define.                                                                                                                                                                                                                                                       |
| `policy.missing-key`          | A required key is absent, including a provider-specific `llm` key.                                                                                                                                                                                                                      |
| `policy.invalid-value`        | Wrong type, enumeration value, or format; a container platform on a non-Linux OS or with a `ci_workflow`; a `ci-signal` platform without one.                                                                                                                                           |
| `policy.limit-out-of-bounds`  | A limit that is not an integer or lies outside its minimum and hard maximum.                                                                                                                                                                                                            |
| `policy.undeclared-reference` | An `execution.platforms[].commands` entry that names no declared command, or a git-loaded `runner.image.path` that is absent from the loaded tree or not a regular file.                                                                                                                |
| `policy.duplicate-id`         | A repeated id in a declaring list, or a repeated entry in one platform's `commands`.                                                                                                                                                                                                    |
| `policy.invalid-path`         | A path or glob that is not repository-relative POSIX (leading `/`, `..` segment, backslash, control character, over 512 characters), a `runner.image.path` outside `.github/patch-steward/runner/`, or a `ci_workflow` that is not a `.yml` or `.yaml` file under `.github/workflows/`. |
| `policy.llm-pairing`          | `auth.type`, `options`, or provider-specific limits that do not match the provider.                                                                                                                                                                                                     |
| `policy.llm-base-url`         | An unacceptable `llm.options.base_url`.                                                                                                                                                                                                                                                 |
| `policy.stage-conflict`       | `challenge` listed with `challenge_rounds: 0`, or `fix-verification` not matching `regression_test: required`.                                                                                                                                                                          |
| `policy.label-name`           | An invalid or colliding label name.                                                                                                                                                                                                                                                     |
| `policy.dismissal-code`       | An invalid, repeated, or built-in project code, an invalid definition, or too many codes.                                                                                                                                                                                               |
| `policy.redaction-pattern`    | A pattern outside the safe subset, or too many patterns.                                                                                                                                                                                                                                |
| `policy.credential-value`     | A key or string value that matches a built-in credential detector (the message names the key path, never the value).                                                                                                                                                                    |

| Code                  | Meaning                                              |
| --------------------- | ---------------------------------------------------- |
| `yaml.too-large`      | The input is over the size bound.                    |
| `yaml.invalid-utf8`   | The input is not valid UTF-8.                        |
| `yaml.syntax`         | A syntax error or parser warning occurred.           |
| `yaml.empty`          | The input contains no document.                      |
| `yaml.multi-document` | The input contains more than one document.           |
| `yaml.duplicate-key`  | A key is repeated in one mapping.                    |
| `yaml.directive`      | The input contains a `%YAML` or `%TAG` directive.    |
| `yaml.alias`          | The input contains an alias.                         |
| `yaml.anchor`         | The input contains an anchor.                        |
| `yaml.explicit-tag`   | The input contains an explicit tag.                  |
| `yaml.non-string-key` | A key is not a string.                               |
| `yaml.forbidden-key`  | A key is `__proto__`, `constructor`, or `prototype`. |
| `yaml.too-deep`       | The input nests more than 32 levels deep.            |
| `yaml.too-many-nodes` | The input has more than 20000 nodes.                 |

Loading the policy file itself can also fail before validation runs: local
files report `file.not-found`, `file.not-a-file`, `file.unreadable`, or
`file.too-large`; a git-loaded policy reports `git.policy-directory-missing`
(no `.github/patch-steward/` at the commit), `git.entry-missing` (no
`policy.yml`), `git.entry-not-regular`, `git.blob-too-large`, or a git
environment failure such as `git.ref-unresolvable` or `git.not-a-repository`.
[`steward policy`](commands.md#steward-policy-available) maps every code to its
exit status.

The warning `policy.llm-model-placeholder` fires when `llm.model` is still the
template placeholder `replace-with-model-id`; it never changes validity.

Sources: [architecture §8](../architecture.md#8-policy-the-quality-contract),
[SP01](../processes.md#sp01-policy-management).

## Policy keys (Available)

Every key below is required unless the [Defaults](#defaults) table lists a default
for it. The [policy template](../../templates/policy/policy.yml) writes every key
explicitly and validates as shipped; copy it and edit the values rather than
composing a policy from scratch. Ids match `^[a-z0-9][a-z0-9._-]*$` and are at
most 64 characters. Paths and globs are repository-relative POSIX paths: no
leading `/`, no `..` segment, no backslash, no control character, at most 512
characters (`policy.invalid-path`). Lists hold at most 1000 items; free-form
strings are at most 16384 characters. Every integer limit lies within a minimum
and hard maximum fixed by the steward; a value outside them is rejected
(`policy.limit-out-of-bounds`), never clamped — see
[architecture §12](../architecture.md#12-resource-cost-and-failure-controls) for
the bounds. Template values shown below are what the template writes, not
defaults. `version` must be the integer `1`.

### Defaults

| Key                                      | Default               |
| ---------------------------------------- | --------------------- |
| `llm.admission`                          | `all`                 |
| `submission.unrequested_change`          | `propose-first`       |
| `submission.free_form`                   | `false`               |
| `runner.network`                         | `none`                |
| `policy_change`                          | `enforced`            |
| `labels.status.<state>`                  | see [Labels](#labels) |
| `labels.classification.<classification>` | see [Labels](#labels) |

Every other key is required; no other default is substituted. The resolved
policy records the effective value of every key.

### Supported behavior

| Key                                          | Value                        | Notes                                                                                     |
| -------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `supported_behavior.description`             | text                         | Text claim validation and challenge sessions read to decide whether a report is a defect. |
| `supported_behavior.environments`            | list of strings              |                                                                                           |
| `supported_behavior.platforms`               | list of strings              |                                                                                           |
| `supported_behavior.compatibility`           | list of strings              |                                                                                           |
| `supported_behavior.versions[].version`      | release line name            |                                                                                           |
| `supported_behavior.versions[].supported`    | boolean                      |                                                                                           |
| `supported_behavior.versions[].branch`       | maintenance or target branch |                                                                                           |
| `supported_behavior.versions[].support_ends` | `YYYY-MM-DD` or `null`       |                                                                                           |
| `supported_behavior.components[].id`         | unique id                    | `policy.duplicate-id` on repeats.                                                         |
| `supported_behavior.components[].paths`      | list of globs                |                                                                                           |
| `supported_behavior.documents[].id`          | unique id                    | `policy.duplicate-id` on repeats.                                                         |
| `supported_behavior.documents[].path`        | path                         |                                                                                           |
| `supported_behavior.decisions[].id`          | unique id                    | `policy.duplicate-id` on repeats.                                                         |
| `supported_behavior.decisions[].path`        | path                         |                                                                                           |
| `supported_behavior.design_rules[].id`       | unique id                    | `policy.duplicate-id` on repeats.                                                         |
| `supported_behavior.design_rules[].rule`     | text                         |                                                                                           |

Ids are unique within each list. No version-1 policy key references these ids.

### Trusted and execution-sensitive paths

| Key                                    | Value         | Notes                                                                                                       |
| -------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `trusted_paths.additional`             | list of globs | Added to the [built-in trusted paths](#built-in-trusted-paths), which always apply.                         |
| `execution_sensitive_paths.additional` | list of globs | Added to the [built-in execution-sensitive paths](#built-in-execution-sensitive-paths), which always apply. |

#### Glob syntax

Every glob in the policy and in the built-in lists below uses one syntax. Paths
are repository-relative POSIX paths, compared case-sensitively. A pattern
without `/` matches the last path segment at any depth; a pattern with `/` is
anchored at the repository root. `**` as a whole segment matches zero or more
segments; `*` matches any run of characters except `/`, including a leading
`.`; `?` matches one character except `/`; every other character is literal, so
there are no braces, brackets, or negation. Matching never builds a regular
expression from pattern text.

#### Built-in trusted paths

A changed path that matches one of these patterns, or a
`trusted_paths.additional` entry, prevents reliance on PR-controlled CI: it sets
the submission's trusted-path flag and adds the advisory finding
`submission.trusted-path-change`.

`.github/workflows/**`, `.github/actions/**`, `action.yml`, `action.yaml`,
`.github/patch-steward/**`, `CODEOWNERS`, `.github/scripts/**`,
`.gitlab-ci.yml`, `.gitlab/ci/**`, `.circleci/**`, `.travis.yml`,
`azure-pipelines.yml`, `azure-pipelines.yaml`, `.azure-pipelines/**`,
`.buildkite/**`, `Jenkinsfile`, `.drone.yml`, `.woodpecker.yml`,
`.woodpecker/**`, `appveyor.yml`, `.appveyor.yml`, `bitbucket-pipelines.yml`,
`cloudbuild.yaml`, `cloudbuild.yml`, `ci/**`, `.ci/**`

#### Built-in execution-sensitive paths

A changed path that matches one of these patterns, or an
`execution_sensitive_paths.additional` entry, adds the finding
`submission.execution-sensitive-change` (`uncertain`): maintainer triage is
required even when container runs pass. A path may match both lists. A diff of
more than 3000 changed paths cannot be checked path by path; it sets both flags
and adds `submission.diff-too-large` (`uncertain`). Known false positives, which
cost triage and never a rejection: `scripts/**` and `**/harness/**` can hold
product code, and `.clang-format` and `.prettierrc*` affect formatting only.

| Group                                                                             | Patterns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript and TypeScript manifests, lockfiles, and package-manager configuration | `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.pnpmfile.cjs`, `yarn.lock`, `.yarnrc`, `.yarnrc.yml`, `.npmrc`, `bun.lock`, `bun.lockb`, `deno.json`, `deno.jsonc`, `deno.lock`                                                                                                                                                                                                                                                          |
| JavaScript and TypeScript build and test configuration                            | `tsconfig*.json`, `jsconfig*.json`, `vitest.config.*`, `vitest.workspace.*`, `vite.config.*`, `jest.config.*`, `babel.config.*`, `.babelrc`, `.babelrc.*`, `karma.conf.*`, `.mocharc*`, `playwright.config.*`, `cypress.config.*`, `webpack.config.*`, `rollup.config.*`, `esbuild.config.*`, `.swcrc`, `nx.json`, `turbo.json`, `lerna.json`, `.nycrc*`, `eslint.config.*`, `.eslintrc*`, `prettier.config.*`, `.prettierrc*`                                                                  |
| Rust                                                                              | `Cargo.toml`, `Cargo.lock`, `build.rs`, `rust-toolchain`, `rust-toolchain.toml`, `**/.cargo/**`, `clippy.toml`, `.clippy.toml`, `deny.toml`, `rustfmt.toml`, `.rustfmt.toml`, `.config/nextest.toml`                                                                                                                                                                                                                                                                                            |
| C and C++                                                                         | `CMakeLists.txt`, `*.cmake`, `CMakePresets.json`, `CMakeUserPresets.json`, `vcpkg.json`, `vcpkg-configuration.json`, `conanfile.py`, `conanfile.txt`, `meson.build`, `meson_options.txt`, `meson.options`, `Makefile`, `makefile`, `GNUmakefile`, `*.mk`, `configure`, `configure.ac`, `Makefile.am`, `Makefile.in`, `.clang-tidy`, `.clang-format`, `*.vcxproj`, `*.vcxproj.filters`                                                                                                           |
| Go                                                                                | `go.mod`, `go.sum`, `go.work`, `go.work.sum`, `.golangci.*`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Python                                                                            | `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements*.txt`, `constraints*.txt`, `Pipfile`, `Pipfile.lock`, `poetry.lock`, `uv.lock`, `pdm.lock`, `tox.ini`, `noxfile.py`, `pytest.ini`, `conftest.py`, `mypy.ini`, `.mypy.ini`, `ruff.toml`, `.ruff.toml`, `.pylintrc`, `pylintrc`, `.flake8`                                                                                                                                                                                               |
| Ruby                                                                              | `Gemfile`, `Gemfile.lock`, `*.gemspec`, `Rakefile`, `.rspec`, `.rubocop.yml`, `spec_helper.rb`, `rails_helper.rb`, `test_helper.rb`                                                                                                                                                                                                                                                                                                                                                             |
| JVM                                                                               | `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle`, `settings.gradle.kts`, `gradle.properties`, `gradlew`, `gradlew.bat`, `gradle/**`, `.mvn/**`                                                                                                                                                                                                                                                                                                                                  |
| .NET                                                                              | `*.csproj`, `*.fsproj`, `*.vbproj`, `*.sln`, `*.props`, `*.targets`, `global.json`, `nuget.config`, `NuGet.Config`, `packages.lock.json`, `.config/dotnet-tools.json`                                                                                                                                                                                                                                                                                                                           |
| PHP and Elixir                                                                    | `composer.json`, `composer.lock`, `phpunit.xml`, `phpunit.xml.dist`, `mix.exs`, `mix.lock`                                                                                                                                                                                                                                                                                                                                                                                                      |
| Bazel                                                                             | `BUILD`, `BUILD.bazel`, `WORKSPACE`, `WORKSPACE.bazel`, `MODULE.bazel`, `*.bzl`, `.bazelrc`, `.bazelversion`                                                                                                                                                                                                                                                                                                                                                                                    |
| Containers                                                                        | `Dockerfile`, `Dockerfile.*`, `*.dockerfile`, `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`                                                                                                                                                                                                                                                                                                                                                                        |
| Repository mechanics                                                              | `.gitmodules`, `.gitattributes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Reporters                                                                         | `**/reporters/**`, `**/reporter/**`, `*reporter.config.*`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Shared test helpers and harness code                                              | `**/test/helpers/**`, `**/tests/helpers/**`, `**/test/support/**`, `**/tests/support/**`, `**/spec/support/**`, `**/spec/helpers/**`, `**/test-utils/**`, `**/test_utils/**`, `**/testutils/**`, `**/test-helpers/**`, `**/test_helpers/**`, `**/tests/common/**`, `**/cypress/support/**`, `**/harness/**`, `**/test-harness/**`, `setupTests.*`, `test-setup.*`, `test_setup.*`, `vitest.setup.*`, `jest.setup.*`, `global-setup.*`, `globalSetup.*`, `global-teardown.*`, `globalTeardown.*` |
| Scripts                                                                           | `scripts/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Categories

All six category keys are required under `categories`: `bugfix`, `feature`,
`refactor`, `docs`, `chore`, `security`.

| Key                                     | Value                                       | Notes                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories.<category>.required_fields` | list of PR field ids                        | Field ids: `category`, `problem`, `benefit`, `intended-behavior`, `acceptance-criteria`, `linked-issue`, `regression-test`, `test-scaffolding`, `reproduction-command`, `expected-result`, `references`. |
| `categories.<category>.linked_issue`    | `required` or `optional`                    |                                                                                                                                                                                                          |
| `categories.<category>.references`      | `required` or `optional`                    |                                                                                                                                                                                                          |
| `categories.<category>.reproduction`    | `required`, `optional`, or `not-applicable` |                                                                                                                                                                                                          |
| `categories.<category>.regression_test` | `required` or `not-applicable`              | Must match whether `fix-verification` is listed in `stages.per_category.<category>` (`policy.stage-conflict`).                                                                                           |

#### Category consistency

Screening checks a pull request's declared category against its changed paths
with built-in path classes; no policy key changes them. Each changed path,
including both sides of a rename or copy, gets exactly one class: the first of
these that matches.

| Class | Patterns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| test  | `**/test/**`, `**/tests/**`, `**/__tests__/**`, `**/spec/**`, `**/specs/**`, `**/testdata/**`, `**/test-data/**`, `**/fixtures/**`, `**/__fixtures__/**`, `**/__snapshots__/**`, `**/__mocks__/**`, `**/testing/**`, `*.test.*`, `*.spec.*`, `*_test.*`, `*_tests.*`, `*_unittest.*`, `test_*.py`, `*_spec.rb`, `*Test.java`, `*Tests.java`, `*Test.kt`, `*Tests.kt`, `*Test.cs`, `*Tests.cs`, `conftest.py`                                                                                                 |
| docs  | `*.md`, `*.mdx`, `*.markdown`, `*.rst`, `*.adoc`, `*.asciidoc`, `*.rdoc`, `docs/**`, `doc/**`, `documentation/**`, `man/**`, `README`, `README.*`, `CHANGELOG`, `CHANGELOG.*`, `CHANGES`, `CHANGES.*`, `HISTORY`, `HISTORY.*`, `NEWS`, `NEWS.*`, `CONTRIBUTING`, `CONTRIBUTING.*`, `CODE_OF_CONDUCT`, `CODE_OF_CONDUCT.*`, `SECURITY.*`, `SUPPORT.*`, `AUTHORS`, `AUTHORS.*`, `CONTRIBUTORS`, `CONTRIBUTORS.*`, `LICENSE`, `LICENSE.*`, `LICENCE`, `LICENCE.*`, `COPYING`, `COPYING.*`, `NOTICE`, `NOTICE.*` |
| infra | Every built-in trusted and execution-sensitive pattern, plus `.github/**`, `.*` (dotfiles at any depth), `**/.*/**` (anything inside a dot-directory), `*.yml`, `*.yaml`, `*.toml`, `*.ini`, `*.cfg`, `*.conf`, `*.properties`, `*.lock`, `scripts/**`, `script/**`, `tools/**`, `tooling/**`                                                                                                                                                                                                                |
| code  | Any path that no earlier class matches                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

A declared category is consistent with the changed paths when:

- `docs`: every path is docs or test, and at least one is docs.
- `chore`: no path is code, and at least one is docs or infra.
- `bugfix`, `feature`, `refactor`, `security`: at least one path is code.
- An empty diff is consistent with no category.

A declared category that is not consistent is `submission.category-mismatch`
(`uncertain`). The plausible categories are the consistent ones plus a valid
declared one. When the declaration is absent, invalid, or mismatched, and any
plausible category (every category when none is plausible) is in `enforce`, the
result also carries `submission.category-enforced-ambiguity` (`uncertain`,
enforced). The effective mode of a pull request is the strictest mode over its
plausible categories (every category when none is plausible); an issue uses
`modes.default`. A mismatch is never a
rejection. Known limits: JSON files fall to code, so a docs change that touches
only `*.json` files is a mismatch; `*.yml`, `*.yaml`, and `*.toml` files are
infra even where a project treats them as product source; `tools/**` may hold
product code; `.github/CONTRIBUTING.md` is docs, because docs comes before infra.

### Submission

| Key                                    | Value                       | Notes                                                                                                                                                                                      |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `submission.issue_fields.defect`       | list of defect field ids    | Field ids: `expected-behavior`, `authoritative-basis`, `actual-behavior`, `affected-version`, `reproduction-command`, `expected-result`, `proposed-scope`, `references`, `security-claim`. |
| `submission.issue_fields.proposal`     | list of proposal field ids  | Field ids: `problem`, `benefit`, `existing-decision`, `proposed-scope`, `references`.                                                                                                      |
| `submission.reference_hosts.mode`      | `any-public` or `allowlist` |                                                                                                                                                                                            |
| `submission.reference_hosts.allowlist` | list of hostnames           | Used when `mode` is `allowlist`.                                                                                                                                                           |
| `submission.attachments.destinations`  | list of hostnames           | Approved public HTTPS attachment destinations; see [Attachments](#attachments).                                                                                                            |
| `submission.attachments.formats`       | list of file extensions     |                                                                                                                                                                                            |

`submission.free_form` (default `false`): an unstructured submission is
`needs-changes` (`submission.unstructured`) with a link to the template. With
`true`, an unstructured body raises no template or field finding, its category
comes from the diff alone, and attachment, path, shared-head, and linkage rules
still apply; a free-form pull request whose plausible categories require a linked
issue gets `submission.linked-issue-missing`, because it has no `Linked issue`
field.
`submission.unrequested_change` (default `propose-first`): `propose-first`
returns an unaccepted feature/design PR as `needs-changes` with
`proposal-required`; `triage` routes the missing intent decision to a
maintainer as `uncertain`.

#### Field mapping

Screening finds fields by their rendered labels and headings, never by form
element ids, which GitHub omits from submitted bodies; the ids equal the field
ids and serve only URL prefilling. Version 1 of the mapping:

Defect issue form "Defect report",
[`templates/issue-forms/steward-defect.yml`](../../templates/issue-forms/steward-defect.yml),
installed as `.github/ISSUE_TEMPLATE/steward-defect.yml`:

| Field id               | Rendered label         | Form element                                                   | Required in the form |
| ---------------------- | ---------------------- | -------------------------------------------------------------- | -------------------- |
| `expected-behavior`    | `Expected behavior`    | textarea                                                       | yes                  |
| `authoritative-basis`  | `Authoritative basis`  | textarea                                                       | yes                  |
| `actual-behavior`      | `Actual behavior`      | textarea                                                       | yes                  |
| `affected-version`     | `Affected version`     | input                                                          | yes                  |
| `reproduction-command` | `Reproduction command` | textarea                                                       | yes                  |
| `expected-result`      | `Expected result`      | textarea                                                       | yes                  |
| `proposed-scope`       | `Proposed scope`       | textarea                                                       | no                   |
| `references`           | `References`           | textarea                                                       | no                   |
| `security-claim`       | `Security claim`       | checkboxes, one option `This report claims a security problem` | no                   |

Proposal issue form "Change proposal",
[`templates/issue-forms/steward-proposal.yml`](../../templates/issue-forms/steward-proposal.yml),
installed as `.github/ISSUE_TEMPLATE/steward-proposal.yml`:

| Field id            | Rendered label      | Form element | Required in the form |
| ------------------- | ------------------- | ------------ | -------------------- |
| `problem`           | `Problem`           | textarea     | yes                  |
| `benefit`           | `Benefit`           | textarea     | yes                  |
| `existing-decision` | `Existing decision` | textarea     | no                   |
| `proposed-scope`    | `Proposed scope`    | textarea     | yes                  |
| `references`        | `References`        | textarea     | no                   |

The forms have no `labels:` key and no severity field. A leading note, which is
not part of the submitted body, says that maintainers assess severity, that
security vulnerabilities go to the project's private reporting channel, and, on
the defect form, that reproduction files go into the `Reproduction command`
field as fenced code blocks or attachments. The forms' required flags equal the
policy template's `submission.issue_fields` lists; the policy, not the form,
governs screening.

Pull request template,
[`templates/pull-request/pull_request_template.md`](../../templates/pull-request/pull_request_template.md),
installed as `.github/pull_request_template.md`. Its first line is the version
marker `<!-- patch-steward:pr-template v1 -->`, followed by a comment explaining
drafts: where the repository screens drafts with feedback, open a draft and
request review after the screening report; in observe mode, follow the
repository's ordinary readiness and review process. Each field is a `##`
heading followed by a hint comment:

| Field id               | Heading                | Hint (summary)                                                                   |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `category`             | `Category`             | exactly one of `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`      |
| `problem`              | `Problem`              | the problem the change addresses                                                 |
| `benefit`              | `Benefit`              | why the change is worth adopting and maintaining                                 |
| `intended-behavior`    | `Intended behavior`    | the behavior after the change                                                    |
| `acceptance-criteria`  | `Acceptance criteria`  | checkable conditions                                                             |
| `linked-issue`         | `Linked issue`         | one issue in this repository, such as `#123`, optionally after a closing keyword |
| `regression-test`      | `Regression test`      | the test file and test name that fail before and pass after                      |
| `test-scaffolding`     | `Test scaffolding`     | non-test files the regression test needs                                         |
| `reproduction-command` | `Reproduction command` | the exact command; files as fenced code blocks or attachments                    |
| `expected-result`      | `Expected result`      | the exit status or output text                                                   |
| `references`           | `References`           | documents, specifications, or decisions                                          |

Keep labels, headings, and the marker line unchanged when installing the
templates: a changed label or heading makes submissions unstructured. A later
template version adds its own mapping, and older versions stay supported.

#### Parsing

Headings inside fenced code blocks and HTML comments are ignored. An issue body
is structured when every label of a mapping version appears in it as a `###`
heading; versions are tried newest first and the defect form before the
proposal form, and any other heading is field content. Issue-form labels are
compared case-sensitively, because GitHub renders them verbatim. A pull request
body names its version only in the marker line; without a marker, or with two
markers naming different versions, it is unstructured. Each known `##` heading
starts a field, compared case-insensitively; an unknown `##` heading ends the
current field, and deeper headings are content. Labels and headings are
compared after Unicode normalization, trimming, and collapsing whitespace. A
mapped heading that appears twice is `submission.field-duplicate`.

A field's value is the text up to the next field heading. Before any rule reads
it, the value is normalized: CRLF and lone CR become LF, HTML comments are
removed, the text is put in Unicode NFC, trailing spaces and tabs are removed
from each line, and leading and trailing empty lines are removed. A normalized
value is trivial when it is empty or, in any letter case, `_No response_`,
`N/A`, `NA`, `none`, `-`, `TBD`, `TODO`, or `...`; a required field that is
absent or trivial is `submission.field-missing`. The `Security claim` checkbox
is claimed only when its option line is `- [X]` or `- [x]` followed by the
option label. Severity wording in any field never changes a finding.

The `Category` value, with comments removed, must be one category id,
optionally in backticks, in any letter case: an empty value is
`submission.category-missing`, anything else `submission.category-invalid`.
The `Linked issue` value must be exactly one issue in the same repository:
`#123`, `owner/name#123`, or `https://github.com/owner/name/issues/123`,
optionally after one closing keyword (`close`, `closes`, `closed`, `fix`,
`fixes`, `fixed`, `resolve`, `resolves`, `resolved`, with an optional colon).
No reference where the category requires one is
`submission.linked-issue-missing`; several references, another repository,
extra text, or a number that is not an existing issue (a pull request number
included) is `submission.linked-issue-invalid`. The issue's open or closed state
is not checked.

#### Attachments

An attachment is a URL in a field, as a Markdown link, image, autolink, or bare
URL, that has one of GitHub's attachment shapes:
`https://github.com/user-attachments/files/<id>/<name>`,
`https://github.com/user-attachments/assets/<id>`,
`https://github.com/<owner>/<repo>/files/<id>/<name>`, or any URL on
`user-images.githubusercontent.com` or
`private-user-images.githubusercontent.com`. A URL on a destination the project
added beyond these hosts is also an attachment; other `github.com` URLs are
references. URLs inside HTML comments are ignored, and a URL listed twice is one
attachment. An attachment is required when its field is one the policy
requires for the submission (`categories.<category>.required_fields` for pull
requests, `submission.issue_fields.<kind>` for issues); in an unstructured
free-form body every attachment is required.

The policy template approves these destinations: `github.com`,
`objects.githubusercontent.com`,
`github-production-user-asset-6210df.s3.amazonaws.com`,
`user-images.githubusercontent.com`, and
`private-user-images.githubusercontent.com`. It approves these formats: `txt`,
`log`, `md`, `json`, `patch`, `diff`, `zip`, `gz`, `png`, `jpg`, `jpeg`, and
`gif`. The format is the lowercase text after the last `.` of the URL's last
path segment or, when that segment has none, of the final redirect URL's last
path segment.

Screening fetches each attachment under these rules; `limits.attachments` sets
the numbers:

- Only `https`, only hosts in `submission.attachments.destinations`, no user
  information or explicit port in the URL, and at most 2048 characters.
- Every address the host resolves to must be public, and the connection uses the
  checked address; every redirect hop is checked the same way, and redirects are
  counted.
- No `Authorization` header, cookie, token, or proxy credential is sent, so an
  attachment that needs authentication, such as one in a private repository,
  cannot be fetched.
- Time, bytes per file, and total bytes per submission are bounded; bytes are
  hashed with SHA-256 as they arrive, before any other use.
- Images are hashed, never decoded. A `zip` archive may hold only stored or
  deflated entries: encrypted entries, ZIP64, multiple disks, symbolic links,
  and entry names that are absolute or contain `..`, backslashes, or control
  characters are violations, and it may hold at most 1000 entries with names of
  at most 512 bytes. A `gz` file may hold one or more gzip members. The
  decompressed size of either, declared and actual, must stay within
  `limits.attachments.decompressed_bytes`; archives are never extracted, and
  nested archives are not expanded.

More attachments than `limits.attachments.count`, a host outside the
destinations, a scheme other than `https`, user information, a format that is
not approved or cannot be determined, too many bytes, too many redirects, or an
archive violation is `submission.attachment-violation` (`needs-changes`); its
detail names the rule: `count`, `destination`, `scheme`, `userinfo`, `format`,
`file-bytes`, `total-bytes`, `redirects`, `archive`, or `decompressed-bytes`. A
fetch failure (DNS, a non-public address, TLS, a timeout, or a non-success
status) makes a required attachment an `inconclusive` cause
(`attachment-fetch-failed`) and an optional one the advisory finding
`submission.attachment-unavailable`. `steward preflight` checks count,
destination, scheme, user information, and format from the URL only and never
fetches; an attachment whose URL does not show its format gets the warning
`attachment.format-unverified`.

### Execution

| Key                                          | Value                                                     | Notes                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `execution.commands[].id`                    | unique id                                                 | `policy.duplicate-id` on repeats.                                                                                                                                                                    |
| `execution.commands[].kind`                  | `build`, `test`, `lint`, or `static-analysis`             |                                                                                                                                                                                                      |
| `execution.commands[].run`                   | non-empty argument vector                                 | Never interpreted by a shell.                                                                                                                                                                        |
| `execution.commands[].working_directory`     | path                                                      | `.` means the repository root.                                                                                                                                                                       |
| `execution.commands[].mandatory`             | boolean                                                   | Mandatory commands are never removed; impact analysis may add others.                                                                                                                                |
| `execution.commands[].result_files[].path`   | path                                                      |                                                                                                                                                                                                      |
| `execution.commands[].result_files[].format` | `junit-xml`                                               | The only accepted format so far.                                                                                                                                                                     |
| `execution.platforms[].id`                   | unique id                                                 | `policy.duplicate-id` on repeats.                                                                                                                                                                    |
| `execution.platforms[].os`                   | `linux`, `windows`, or `macos`                            |                                                                                                                                                                                                      |
| `execution.platforms[].required`             | boolean                                                   |                                                                                                                                                                                                      |
| `execution.platforms[].source`               | `container` or `ci-signal`                                | `container` runs in the runner container (Linux only); `ci-signal` reads coverage from a project CI workflow.                                                                                        |
| `execution.platforms[].ci_workflow`          | `.yml`/`.yaml` path under `.github/workflows/`, or `null` | Required (non-null) for `ci-signal`; must be `null` for `container`, else `policy.invalid-value`.                                                                                                    |
| `execution.platforms[].commands`             | non-empty list of declared command ids, each at most once | Each platform lists the ids of the declared commands it runs, or whose coverage its CI workflow stands for; an undeclared id is `policy.undeclared-reference`, a repeated one `policy.duplicate-id`. |

> **[NEEDS INPUT]** Result-file parsing (only `junit-xml` is accepted as a format so far) and the rules for platform coverage beyond Linux containers are not specified.

### Runner

| Key                                        | Value                                                 | Notes                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `runner.image.source`                      | `registry` or `dockerfile`                            |                                                                                                               |
| `runner.image.reference`                   | image reference                                       | Registry only; template value `docker.io/library/debian:stable-slim`.                                         |
| `runner.image.path`                        | Dockerfile path under `.github/patch-steward/runner/` | Dockerfile only; must exist there as a regular file when loaded from git, else `policy.undeclared-reference`. |
| `runner.dependency_step`                   | `null` or an object                                   | The only step with egress.                                                                                    |
| `runner.dependency_step.run`               | argument vector                                       |                                                                                                               |
| `runner.dependency_step.working_directory` | path                                                  |                                                                                                               |
| `runner.resources.cpus`                    | bounded integer (vCPU)                                | Template `2`.                                                                                                 |
| `runner.resources.memory_mb`               | bounded integer (MiB)                                 | Template `4096`.                                                                                              |
| `runner.resources.pids`                    | bounded integer (processes)                           | Template `512`.                                                                                               |

`runner.network` (default `none`, the only value): egress is limited to the
declared dependency step.

> **[NEEDS INPUT]** How the runner image is provided or generated, and the network and service policy for the dependency step, are not specified.

### Inference

The whole `llm` section is optional; without it the policy is valid,
deterministic stages run, and a run that reaches a model stage ends
`inconclusive`.

| Key                                           | Value                                                                   | Notes                                                                                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `llm.provider`                                | `copilot-sdk` or `openai-compatible`                                    |                                                                                                                                                                                                                                     |
| `llm.model`                                   | model id, printable ASCII                                               | No default. The template writes the placeholder `replace-with-model-id`, which validates but makes `steward policy` warn `policy.llm-model-placeholder`, and a run that reaches a model stage with it ends `inconclusive`.          |
| `llm.auth.type`                               | `github-token` (with `copilot-sdk`) or `env` (with `openai-compatible`) | `env` reads the fixed variable `STEWARD_LLM_API_KEY`. Other pairings are `policy.llm-pairing`.                                                                                                                                      |
| `llm.options.base_url`                        | HTTPS URL, or HTTP only for `localhost`, `127.x.x.x`, or `[::1]`        | Required for `openai-compatible`, not allowed for `copilot-sdk`; no user name or password; `models.github.ai` and `models.inference.ai.azure.com` (retired GitHub Models) rejected; at most 512 characters (`policy.llm-base-url`). |
| `llm.generation.temperature`                  | number 0 to 2, or `null`                                                | `null`: the adapter sends no temperature.                                                                                                                                                                                           |
| `llm.required_capabilities.structured_output` | `any` or `native`                                                       |                                                                                                                                                                                                                                     |
| `llm.limits.model_calls_per_run`              | bounded integer (calls)                                                 | Template `40`.                                                                                                                                                                                                                      |
| `llm.limits.retries_per_call`                 | bounded integer (count)                                                 | Template `2`.                                                                                                                                                                                                                       |
| `llm.limits.repair_attempts_per_session`      | bounded integer (count)                                                 | Template `1`.                                                                                                                                                                                                                       |
| `llm.limits.call_seconds`                     | bounded integer (s)                                                     | Template `120`.                                                                                                                                                                                                                     |
| `llm.limits.daily_inference_runs`             | bounded integer (runs per UTC day)                                      | Counts runs that reach a model stage. Template `30`.                                                                                                                                                                                |
| `llm.limits.ai_credits_per_run`               | bounded integer (AI credits)                                            | `copilot-sdk` only: required there, rejected with `openai-compatible`; a soft cap. Template `90`.                                                                                                                                   |
| `llm.limits.tokens_per_run`                   | bounded integer (tokens)                                                | `openai-compatible` only: required there, rejected with `copilot-sdk`. Template `400000`.                                                                                                                                           |
| `llm.limits.output_tokens_per_call`           | bounded integer (tokens)                                                | `openai-compatible` only: required there, rejected with `copilot-sdk`. Template `4096`.                                                                                                                                             |

`llm.admission` (default `all`, otherwise `maintainer-approved`): the second
option holds inference for authors without prior merged work until a
maintainer admits the submission.

Inference admission controls spending, not quality. A maintainer's `/steward rerun`
admits a held submission; that admission persists for the submission until revoked
or closed. Labels do not grant it.

> **[NEEDS INPUT]** The command or procedure for revoking inference admission is
> not specified.

### Stages

| Key                                      | Value                                                 | Notes                                                                      |
| ---------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `stages.continue_after_blocking`         | boolean                                               |                                                                            |
| `stages.per_category.<category>`         | list of `fix-verification`, `regression`, `challenge` | Reference verification and claim validation always run and are not listed. |
| `stages.challenge_rounds`                | bounded integer (round pairs)                         | At least 1 when any category lists `challenge`. Template `2`.              |
| `stages.high_impact_paths`               | list of globs                                         |                                                                            |
| `stages.reproduction_as_before_evidence` | boolean                                               |                                                                            |

Every issue and pull request requires reference verification and claim
validation, a defect issue also requires reproduction, and a pull request
requires the stages `stages.per_category` lists for each plausible category
(every category when none is plausible). A required stage without a result
ends a run `inconclusive` with cause `stage-incomplete`. No stage is
implemented yet, so every local run whose contract check passes ends
`inconclusive`.

### Escalation

| Key                                 | Value               | Notes |
| ----------------------------------- | ------------------- | ----- |
| `escalation.sensitive_paths`        | list of globs       |       |
| `escalation.security_terms`         | list of strings     |       |
| `escalation.security_reporting_url` | HTTPS URL or `null` |       |

### Limits

Every `limits.*` key below is a bounded integer. `llm.limits`,
`runner.resources`, and `evidence.retention_days` are bounded the same way; see
their own subsections.

| Key                                        | Value                      | Notes               |
| ------------------------------------------ | -------------------------- | ------------------- |
| `limits.execution.execution_seconds`       | integer (s)                | template `1800`     |
| `limits.execution.run_execution_seconds`   | integer (s)                | template `7200`     |
| `limits.execution.executions_per_run`      | integer (count)            | template `40`       |
| `limits.execution.output_bytes`            | integer (bytes)            | template `1048576`  |
| `limits.execution.result_file_bytes`       | integer (bytes)            | template `5242880`  |
| `limits.execution.dependency_step_seconds` | integer (s)                | template `600`      |
| `limits.caps.daily_runs`                   | integer (runs per UTC day) | template `50`       |
| `limits.caps.per_author_concurrent_runs`   | integer (runs)             | template `2`        |
| `limits.github.requests_per_run`           | integer (requests)         | template `300`      |
| `limits.github.retries_per_request`        | integer (count)            | template `3`        |
| `limits.attachments.count`                 | integer (files)            | template `5`        |
| `limits.attachments.file_bytes`            | integer (bytes)            | template `1048576`  |
| `limits.attachments.total_bytes`           | integer (bytes)            | template `5242880`  |
| `limits.attachments.decompressed_bytes`    | integer (bytes)            | template `10485760` |
| `limits.attachments.redirects`             | integer (count)            | template `3`        |
| `limits.attachments.fetch_seconds`         | integer (s)                | template `20`       |
| `limits.references.count`                  | integer (references)       | template `50`       |
| `limits.references.fetches_per_run`        | integer (fetches)          | template `20`       |
| `limits.references.fetch_seconds`          | integer (s)                | template `10`       |
| `limits.references.fetch_bytes`            | integer (bytes)            | template `1048576`  |
| `limits.references.redirects`              | integer (count)            | template `3`        |
| `limits.evidence.run_bytes`                | integer (bytes)            | template `10485760` |
| `limits.evidence.write_retries`            | integer (count)            | template `5`        |
| `limits.stale_check_minutes`               | integer (min)              | template `1440`     |
| `limits.stage_seconds`                     | integer (s)                | template `3600`     |
| `limits.audit_samples_per_week`            | integer (runs)             | template `5`        |

In a local run, `limits.evidence.run_bytes` bounds all bytes of a run
directory plus its metrics file; `limits.evidence.write_retries` applies only
to the future branch or repository store, since local writes never retry;
`limits.stage_seconds` bounds each phase; `limits.github.*` bound the
submission reads; `hygiene.max_flagged` also caps the report's flagged items
(at most 10).

### Policy change and modes

| Key                             | Value                                       | Notes                                   |
| ------------------------------- | ------------------------------------------- | --------------------------------------- |
| `modes.default`                 | `observe`, `advise`, or `enforce`           |                                         |
| `modes.per_category.<category>` | `observe`, `advise`, or `enforce`, optional | Omitted categories use `modes.default`. |

`policy_change` (default `enforced`, otherwise `all` or `manual`): controls
rescreening of already published outcomes; unpublished superseded runs are
always replaced.

### Follow-through and hygiene

| Key                                       | Value                      | Notes                                          |
| ----------------------------------------- | -------------------------- | ---------------------------------------------- |
| `follow_through.max_follow_ups_per_cycle` | bounded integer (comments) | Template `1`.                                  |
| `hygiene.report_flagged`                  | boolean                    |                                                |
| `hygiene.allowlist`                       | list of GitHub logins      | May end in `[bot]`.                            |
| `hygiene.heuristics.automated_accounts`   | boolean                    |                                                |
| `hygiene.heuristics.near_duplicates`      | boolean                    |                                                |
| `hygiene.heuristics.unreferenced_reviews` | boolean                    |                                                |
| `hygiene.heuristics.automated_exchanges`  | boolean                    |                                                |
| `hygiene.max_flagged`                     | bounded integer (items)    | Template `10`. Flags never change the outcome. |

### Evidence

| Key                                       | Value                             | Notes                                                            |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `evidence.store.type`                     | `orphan-branch` or `repository`   | Template `orphan-branch`.                                        |
| `evidence.store.branch`                   | branch name                       | Used by both store types.                                        |
| `evidence.store.repository`               | `owner/name`                      | Repository store type only.                                      |
| `evidence.retention_days`                 | bounded integer (days)            | Template `365`.                                                  |
| `evidence.redaction_patterns[].id`        | unique id                         | `policy.duplicate-id` on repeats.                                |
| `evidence.redaction_patterns[].pattern`   | safe-subset regular expression    | See below.                                                       |
| `evidence.publication.pages`              | boolean                           |                                                                  |
| `evidence.publication.private_repository` | boolean                           | Also required, besides `pages`, for a private target repository. |
| `evidence.publication.exclude`            | list of public subset section ids | See below.                                                       |

Built-in credential detectors are always on, in this order: `private-key`,
`github-token`, `aws-access-key-id`, `provider-api-key`, `jwt`,
`authorization-header`, `bearer-token`, `url-credentials`, `npm-token`,
`pypi-token`, `gitlab-token`, `slack-token`, `slack-webhook`, `stripe-key`,
`stripe-webhook-secret`, `google-api-key`, `google-oauth-client-secret`,
`google-oauth-access-token`, `huggingface-token`, `docker-hub-token`,
`sendgrid-key`, `shopify-token`, `digitalocean-token` (23 detectors); matches
are replaced with the marker `[REDACTED:<detector id>]`. A policy key or
string value that matches one of them is rejected (`policy.credential-value`).
The safe subset for policy-supplied patterns forbids backreferences,
lookaround, named groups or other `(?` constructs except `(?:`, nested
quantifiers, a repeated group containing an alternation, and a pattern that
matches the empty string; patterns are at most 256 characters and at most 50
patterns are allowed (`policy.redaction-pattern`). Patterns run with flags `gu`
in a worker thread under size and time bounds; a timeout or oversize input
fails closed, so nothing unredacted is stored.

Besides the built-in detectors and the policy's safe-subset patterns, every
credential the process resolved (today the GitHub token `steward screen` uses)
is replaced as `[REDACTED:known-secret]` (detector id `known-secret`) in three
forms: the raw value, its base64, and the base64 of `x-access-token:<value>`;
values shorter than 8 characters are skipped. No keyword or entropy heuristics
are used.

When `steward screen` writes evidence, redaction covers every string value of
every stored record (including metrics events), `report.md` and the report
record's rendered report and check summary, every log file, and the manifest,
in batches under the redaction size and time bounds; every record is validated
again after redaction. A redaction failure, an oversize input, a timeout, or a
record a redaction marker invalidates (for example an attachment URL with
credentials inside the snapshot) fails the evidence write: no run directory,
no report, exit status 2.

The public subset section ids for `evidence.publication.exclude` are
`categories`, `evidence_requirements`, `unrequested_change`, `modes`,
`attachment_caps`, `dismissal_codes`, `supported_versions`,
`inference_admission`.

> **[NEEDS INPUT]** Retention-pruning mechanics for the evidence store, including whether pruning rewrites history, are not specified.

### Dismissal codes

| Code                     | Definition                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-reproduction`        | The claimed behavior did not reproduce with the supplied reproduction in the claimed supported environment.                                           |
| `intended-behavior`      | The reported behavior is what the project intends, as shown by a cited document, test, or recorded decision.                                          |
| `not-applicable-version` | The claim affects only versions the project does not support, and no supported version or target reproduces it.                                       |
| `unsupported-claim`      | The claim is not backed by the evidence it cites or that the policy requires, so it cannot be validated.                                              |
| `fabricated-reference`   | The submission cites a file, symbol, quotation, issue, pull request, document section, or version that is definitively absent at the stated revision. |
| `duplicate`              | The submission repeats an existing issue or pull request, or a previously dismissed claim, without new evidence.                                      |
| `out-of-scope`           | The submission concerns behavior outside the project's components or supported behavior, such as vendored or third-party code or another application. |
| `insufficient-benefit`   | Maintainers decided that the stated benefit does not justify adopting and maintaining the change.                                                     |
| `proposal-required`      | The pull request implements a feature or design change without an accepted proposal, a maintainer's acceptance of its claim, or a waiver.             |

Projects may add codes. `dismissal_codes[].code` matches
`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, is at most 64 characters, is unique, and is
not a built-in code (`policy.dismissal-code`). `dismissal_codes[].definition`
is 1 to 300 characters. At most 100 project codes are allowed
(`policy.dismissal-code`). The resolved policy and the public subset list
built-ins plus additions.

### Labels

`labels` is optional.

| Key                                       | Default name                | Description                                                            |
| ----------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `labels.status.queued`                    | `steward:queued`            | Waiting for screening capacity; screening restarts automatically.      |
| `labels.status.awaiting-approval`         | `steward:awaiting-approval` | Waiting for a maintainer to admit model-based screening.               |
| `labels.status.screening`                 | `steward:screening`         | Screening is in progress.                                              |
| `labels.status.pass`                      | `steward:pass`              | Screening requirements are met; maintainers decide acceptance.         |
| `labels.status.awaiting-author`           | `steward:awaiting-author`   | Waiting for the author to address the numbered requests in the report. |
| `labels.status.triage`                    | `steward:triage`            | Needs a maintainer decision; see the report's open questions.          |
| `labels.classification.supported-defect`  | `claim:supported-defect`    | Claim validated as a defect in supported behavior.                     |
| `labels.classification.intended-behavior` | `claim:intended-behavior`   | Reported behavior matches documented intended behavior.                |
| `labels.classification.feature-request`   | `claim:feature-request`     | Describes new behavior rather than a defect.                           |
| `labels.classification.accepted-proposal` | `claim:accepted-proposal`   | Proposal accepted by a recorded maintainer decision.                   |
| `labels.classification.proposal-pending`  | `claim:proposal-pending`    | Well-formed proposal waiting for a maintainer decision.                |
| `labels.classification.duplicate`         | `claim:duplicate`           | Duplicates an existing issue or a previously dismissed claim.          |
| `labels.classification.uncertain`         | `claim:uncertain`           | Classification needs a maintainer decision.                            |

Names are unique across all 13 case-insensitively, 1 to 50 characters, with no
leading or trailing whitespace or control characters (`policy.label-name`).
Colors and descriptions are fixed by the steward. The generic key forms are
`labels.status.<state>` and `labels.classification.<classification>`.

Sources: [architecture §8](../architecture.md#8-policy-the-quality-contract), [SP01](../processes.md#sp01-policy-management), [SP06](../processes.md#sp06-intake-and-submission-contract-check), [SP19](../processes.md#sp19-resource-control-and-failure-handling), [policy template](../../templates/policy/policy.yml), [built-in path lists](../../packages/core/src/submission/path-lists.ts), [issue forms](../../templates/issue-forms/), [pull request template](../../templates/pull-request/pull_request_template.md).

## Credentials and deployment (Proposed)

| Credential                    | Actions screening                                                                                                                                                                                               | Local use                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GitHub App id and private key | Default-branch-only publication Environment; only `gate` and `publish` receive App credentials.                                                                                                                 | CLI never holds the App private key.                                                  |
| GitHub access                 | Job-specific `GITHUB_TOKEN`; scoped App tokens for writes and authorized separate-evidence-repository access.                                                                                                   | User's own token through `gh` authentication or a fine-grained personal access token. |
| Copilot inference             | Model jobs use `GITHUB_TOKEN` with `copilot-requests: write`. Organization use requires the documented policy, "Allow use of Copilot CLI billed to the organization" (unverified; `probes/findings.md` PA08.7). | User's Copilot login or token with Copilot Requests permission.                       |
| OpenAI-compatible inference   | `STEWARD_LLM_API_KEY`, supplied from the separate model Environment only to `intake` and `assess` jobs.                                                                                                         | The same fixed variable in the user's shell.                                          |

No job holds both App and model credentials. Execution jobs run submitted code
inside credential-free containers. Environment branch rules restrict privileged
jobs to the default branch.

The design assigns Copilot usage in organization-owned repositories to the
organization and in personal repositories to the owner's seat. This organization
billing path is unverified: no probe has run in an organization with Copilot
(`probes/findings.md`, PA08.7). Local login/token
usage bills the authenticated user's seat. Provider-side spending controls
supplement per-run limits; Copilot credit limits are soft and may be exceeded by
one response. Observe mode does not reduce inference work. Unavailable usage or
cost is recorded as unknown.

For private repositories, administrator authorization must cover the context
sent to the selected provider. Redaction alone does not authorize disclosure.

The Copilot adapter's isolation settings are implementation controls, not
user-selectable policy keys: a fresh `COPILOT_HOME`, unset
`COPILOT_CUSTOM_INSTRUCTIONS_DIRS`, `COPILOT_AUTO_UPDATE=false`, and refusal of
`COPILOT_CLI_PATH` in Actions. Its runtime works outside checkouts, with no MCP
servers and every tool denied.

> **[NEEDS INPUT]** Reuse of the user's Copilot login for local `github-token`
> inference, App-secret names, Environment names, the default model per
> adapter, and credential-provisioning commands are not specified.

Sources: [architecture §6.3](../architecture.md#63-adapters),
[§6.4](../architecture.md#64-github-action-and-reusable-workflows),
[§6.5](../architecture.md#65-command-line-interface-packagescli),
[§12](../architecture.md#12-resource-cost-and-failure-controls),
[§15](../architecture.md#15-open-implementation-decisions),
[SP02](../processes.md#sp02-adoption-and-installation).

## Local evidence and reports (Available)

[`steward screen`](commands.md#steward-screen-available) writes a local run
directory and its report, and [`steward report`](commands.md#steward-report-available)
reads and verifies one.

### Store location

`--evidence-dir <dir>` overrides the default; otherwise the store lives in the
user data directory, never inside the checkout by default:

| OS          | Default store root                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Windows     | `%LOCALAPPDATA%\patch-steward\evidence` (or `<home>\AppData\Local\patch-steward\evidence` when `LOCALAPPDATA` is unset or relative). |
| macOS       | `<home>/Library/Application Support/patch-steward/evidence`.                                                                         |
| Other (XDG) | `$XDG_DATA_HOME/patch-steward/evidence` when `XDG_DATA_HOME` is absolute, else `<home>/.local/share/patch-steward/evidence`.         |

### Layout

```text
<store root>/<owner>/<repo>/
  runs/<pr|issue>-<number>/<run-id>/
    manifest.json                         written last; its presence marks a complete run directory
    run.json  submission.json  policy-revision.json  decision.json
    report.json                           rendered report and check summary
    report.md                             same text as report.json "rendered"
    findings/finding-0001.json            one per finding, decision order (absent when none)
    executions/execution-0001.json        (absent when none; always absent at contract level)
    maintainer-actions/action-0001.json   (absent when none; always absent in local runs)
    logs/steward.txt                      redacted, bounded run log
  metrics/<YYYY-MM>/<run-id>.json         the run's metrics events (UTC month of the run start)
```

Local run id: `local-<YYYYMMDDTHHMMSSZ>-<8 lowercase hex>`.

### File format and manifest

Every record file is UTF-8 JSON, with keys in RFC 8785 order, two-space
indentation, LF line endings, and one final LF; parsing and canonicalizing a
record file yields its content hash. The manifest (`manifest_version` 1) lists
`run_id`, `run_attempt`, `store_path`, `created_at`, `files` (path, bytes,
`sha256`, `record_type`, `content_hash`), `metrics` (path, bytes, `sha256`),
and `redaction` (detector ids, policy pattern ids, number of exact values,
replacements per id).

### Write protocol and size caps

Files are created exclusively, never overwritten, in `runs/.staging/<run-id>/`;
the metrics file is created at its final path; the manifest is written last;
then the staging directory is renamed into place as the commit point. A
failure before the rename removes the staging directory and the metrics file,
so no partial run directory remains.

Size caps: logs are truncated first (head and tail kept) to at most 1048576
bytes per file and at most 16 files; at most 4096 files per run directory;
records and the report over `limits.evidence.run_bytes` fail the write.
`steward report` verifies a run directory against its manifest.

### Report layout and report caps

The report has sections in this order: Classification, Blockers, Uncertainties
for maintainers, Executed commands and results, References, Flagged automated
activity, What would change the outcome, Provenance, after a header with
outcome, causes, submission, snapshot, commits, policy revision, run, and
notices. Every section is a list; an empty section reads `- None.`; values
from the submission or GitHub appear as code spans.

Report caps are hard-only constants:

| Cap                          | Value                               |
| ---------------------------- | ----------------------------------- |
| Report                       | 60000 characters                    |
| Check-run summary            | 8000 characters                     |
| Blockers                     | 20 items                            |
| Uncertainties                | 10 items                            |
| Executed commands            | 10 items                            |
| References                   | 20 items                            |
| Flagged items                | 10 items                            |
| What-would-change items      | 10 items                            |
| Classification notes         | 10 items                            |
| Item header                  | 3000 characters                     |
| Classification line          | 300 characters                      |
| Note                         | 300 characters                      |
| Blocker                      | 1000 characters                     |
| Uncertainty                  | 800 characters                      |
| Executed command             | 600 characters                      |
| Reference                    | 250 characters                      |
| Flagged item                 | 300 characters                      |
| What-would-change item       | 500 characters                      |
| Provenance                   | 1500 characters                     |
| Overflow line                | 300 characters                      |
| Derived value per occurrence | 200 characters, then ` (truncated)` |
| Subjects per item            | 10, then `and <n> more`             |

A longer section ends with
`- <n> more <items> are recorded in the evidence: <location>.`; a report or
summary over its maximum fails the run's evidence write instead of being
truncated.

Sources: [architecture §11](../architecture.md#11-evidence-store-and-publication),
[§12.1](../architecture.md#121-hard-bounds),
[SP13](../processes.md#sp13-decision-report-and-admission),
[SP18](../processes.md#sp18-evidence-retention-and-publication),
[`steward screen`](commands.md#steward-screen-available),
[`steward report`](commands.md#steward-report-available).

## Evidence and visibility (Proposed)

See [Local evidence and reports](#local-evidence-and-reports-available) for the
local store that exists today; the branch or repository store described below
is not implemented.

The evidence store is append-only except for retention pruning. It holds run
records, findings, reports, redacted bounded logs, maintainer actions, and metrics.
A separate repository requires an App installation there too. Both store types
restrict pushes to the App and maintainers where the plan and visibility of
the repository that holds the store offer rulesets; where GitHub refuses
rulesets, the restriction is unavailable.

An evidence branch in a public repository is public. Excluding a record from the
Pages subset does not make that branch record private. No subset is published
while `evidence.publication.pages` is `false`; for a private target repository
none is published unless `evidence.publication.private_repository` is also
`true`. Records referenced by maintainer
actions, appeals, audits, or evaluation datasets are retained; metrics events
are kept.

The maintenance workflow generates the static dashboard data:

| Path                  | Content                                                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/policy.json`    | Public policy subset: at most the sections `categories`, `evidence_requirements`, `unrequested_change`, `modes`, `attachment_caps`, `dismissal_codes`, `supported_versions`, and `inference_admission`, minus those in `evidence.publication.exclude` (see [Evidence](#evidence)). |
| `data/index.json`     | Recent runs, states/outcomes, revisions, and changed-input markers.                                                                                                                                                                                                                |
| `data/runs/<id>.json` | Report, evidence references, usage, and cost where available.                                                                                                                                                                                                                      |
| `data/queues.json`    | Triage, author-response, approval, appeal, queued, audit, and proposal-backlog views.                                                                                                                                                                                              |
| `data/metrics.json`   | Calibration and operating metrics.                                                                                                                                                                                                                                                 |

These are generated outputs, not configuration files. The core derives the
policy subset and validates it against its own schema; publishing it to Pages
is not implemented. The browser cannot read
private evidence stores directly in version 1. Actions summaries and private
evidence remain available when no public dashboard is authorized.

Sources: [architecture §6.6](../architecture.md#66-browser-application-packagesweb),
[§11](../architecture.md#11-evidence-store-and-publication),
[SP18](../processes.md#sp18-evidence-retention-and-publication).

## Scaffold configuration (Available)

These files configure development of Patch Steward itself.

### Package and automation

The root `package.json` pins `pnpm@10.20.0`, sets `type` to `module`, marks the
root `private: true`, and declares the [development scripts](commands.md#development-commands-available).
Its recorded version is `0.0.2`. `pnpm-workspace.yaml` lists `packages/*` as the
workspace members: `@patch-steward/core`, `@patch-steward/cli`,
`@patch-steward/action`, and `@patch-steward/web`, all private and versioned in
lockstep with the root manifest, which stays the file the CD workflow reads.
`fixtures/` and `templates/` are plain root directories, not workspace packages.
The CLI package declares `engines.node >=24`, depends on the core package as
`workspace:*`, and maps the `steward` executable (`bin`) to `./dist/main.js`;
the core package depends on `zod` and `yaml`, and its `exports` map resolves
`@patch-steward/core` to its compiled `dist/` output at Node runtime.

| File                       | Current settings                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` | Node 24; build, typecheck, and test on Ubuntu and Windows for PRs and pushes to `master`, `develop`, and `release/**`; lint/format for PRs; Codecov upload from `develop` using `CODECOV_TOKEN`.                                                                                                                                |
| `.github/workflows/cd.yml` | Runs when the root `package.json` changes on `master`; builds/tests, creates absent `v<version>` tag, then merges `master` into `develop` only when that new tag was created.                                                                                                                                                   |
| `vitest.config.ts`         | Test tiers by filename suffix: unit (`*.test.ts`) and fixture (`*.fixture.test.ts`) projects run under `pnpm test`; container and live suffixes are excluded. Coverage merges to the root `coverage/lcov.info`.                                                                                                                 |
| `vitest.live.config.ts`    | Live-probe tier: `pnpm test:live` runs `packages/*/src/**/*.live.test.ts` one file at a time with 60-second timeouts. The tests read only the public test-bed repository `steady-orchard/patch-steward-testbed-public`, use `GH_TOKEN` when it is set, and skip with a message when GitHub is unreachable. It never runs in CI. |
| `eslint.config.mjs`        | ESLint and TypeScript ESLint recommended configurations; ignores `**/dist/`, `docs/`, and `coverage/`.                                                                                                                                                                                                                          |
| `.prettierignore`          | Excludes `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, and `development-artifacts/`.                                                                                                                                                                                                                                 |

The CD workflow requires both remote branches and permissions/rules allowing its
tag and merge operations. Scaffold automation does not implement screening or
configure Pages.

### TypeScript

Shared compiler options live in the root `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "types": ["node"],
    "declaration": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

Each package's `tsconfig.json` adds only the package-local layout:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts"]
}
```

Each package also has a `tsconfig.test.json` check configuration. It extends the
package's `tsconfig.json`, so it checks with the build's compiler options, emits
nothing, and clears the test exclusion. `pnpm typecheck` runs
`tsc --noEmit -p packages/<name>/tsconfig.test.json` for each package in turn:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "exclude": []
}
```

The CLI package's check configuration also maps `@patch-steward/core` to the core
sources, as Vitest does, so type-checking needs no prior build:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "..",
    "paths": { "@patch-steward/core": ["../core/src/index.ts"] }
  },
  "exclude": []
}
```

Relative TypeScript imports use `.js` extensions under this ESM configuration.
Every package build excludes tests; `pnpm typecheck` type-checks sources and
tests, while Vitest strips types without checking them. Vitest resolves
`@patch-steward/core` to `packages/core/src`, so `pnpm test` needs no prior build.

### Formatting example

The complete supplied `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 132,
  "endOfLine": "auto"
}
```

These are explicit repository settings, not Patch Steward screening-policy defaults.

Sources: [package manifest](../../package.json), [workspace file](../../pnpm-workspace.yaml),
[CI](../../.github/workflows/ci.yml), [CD](../../.github/workflows/cd.yml),
[Vitest](../../vitest.config.ts), [Vitest live tier](../../vitest.live.config.ts), [ESLint](../../eslint.config.mjs),
[Prettier exclusions](../../.prettierignore), [TypeScript base](../../tsconfig.base.json),
[Prettier](../../.prettierrc.json), [repository guidance](../../CLAUDE.md#toolchain-constraints).
