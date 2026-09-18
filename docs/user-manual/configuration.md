# Configuration

[Manual contents](README.md) · [Command reference](commands.md) · [Troubleshooting](troubleshooting.md)

Patch Steward has no implemented runtime configuration yet. This page inventories
the documented policy settings and configuration areas, followed by the existing
scaffold's settings. A conceptual area is not a supported YAML key.

## Policy format and precedence (Proposed)

The quality contract is a YAML file at:

```text
.github/patch-steward/policy.yml
```

Official screening loads it from the repository's default branch at run start.
The revision is the content hash of `.github/patch-steward/`, including the
optional runner directory. The default-branch commit is recorded separately;
unrelated commits do not change the policy revision.

Maintainers own the policy through CODEOWNERS and, where the repository's plan
and visibility offer rulesets, required code-owner review. On a Free-plan
organization's private repository GitHub refuses rulesets, so that review is
unavailable.
A PR proposing a policy change is screened under the existing trusted policy.
An explicit local policy experiment is non-authoritative, and replay pins an
explicit historical revision.

The proposed validator rejects unknown keys, limits above hard bounds, and
undeclared referenced paths or commands. Invalid trusted policy makes runs
`inconclusive`; the steward does not silently substitute defaults.

> **[NEEDS INPUT]** The policy schema, required keys, types, nesting, template,
> validation diagnostics, and hard upper bounds are not supplied. There is no
> complete valid policy file to copy or executable validator to verify one.

Sources: [architecture §8](../architecture.md#8-policy-the-quality-contract),
[SP01](../processes.md#sp01-policy-management).

## Named settings and defaults (Proposed)

Only the spellings below are explicitly named in the sources. This table does
not establish their complete placement in a future schema.

| Setting              | Documented values or format                                         | Documented default / behavior when absent                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `llm.provider`       | `copilot-sdk`, `openai-compatible`                                  | No default. Missing or unknown provider ends the run `inconclusive`.                                                                                                                 |
| `llm.model`          | Model identifier for the selected adapter                           | No model is selected in the documentation; default model per adapter remains open. The core does not substitute a model.                                                             |
| `llm.auth.type`      | `github-token` for Copilot; `env` for the OpenAI-compatible adapter | Default not specified. Must resolve to a usable credential.                                                                                                                          |
| `llm.admission`      | `all`, `maintainer-approved`                                        | `all`. The second option holds inference for authors without prior merged work until a maintainer admits the submission.                                                             |
| `base_url`           | Policy-declared endpoint used by the OpenAI-compatible adapter      | Default and exact YAML nesting not specified. The provider-options schema remains open.                                                                                              |
| `unrequested_change` | `propose-first`, `triage`                                           | `propose-first`. Unaccepted feature/design PRs receive `needs-changes` with `proposal-required`; `triage` instead routes the missing intent decision to a maintainer as `uncertain`. |
| `policy_change`      | `all`, `enforced`, `manual`                                         | Default not specified. Controls rescreening already published outcomes; unpublished policy-superseded runs always need replacement.                                                  |

Additional documented defaults and initial choices whose YAML keys are not defined:

| Area                             | Documented choice                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating mode                   | Start adoption in `observe`; modes may be global and per category. This is an installation instruction, not a documented missing-key fallback. |
| Execution network                | `none` by default; egress is limited to a policy-declared dependency step.                                                                     |
| Evidence store                   | Orphan branch in the target repository by default; separate repository optional.                                                               |
| Pages export for private targets | Disabled unless an explicit public subset is approved.                                                                                         |
| Status labels                    | Configurable names; documented family `steward:<state>`.                                                                                       |
| Issue classification labels      | Configurable names; documented family `claim:<classification>`.                                                                                |

Inference admission controls spending, not quality. A maintainer's `/steward rerun`
admits a held submission; that admission persists for the submission until revoked
or closed. Labels do not grant it.

> **[NEEDS INPUT]** The command or procedure for revoking inference admission is
> not specified.

Sources: [architecture §8](../architecture.md#8-policy-the-quality-contract),
[architecture §10](../architecture.md#10-submission-states-and-their-github-representation),
[SP19](../processes.md#sp19-resource-control-and-failure-handling).

## Example policy fragment (Proposed)

This is the illustrative inference section from architecture §8. It is **not a
complete or validated configuration file**. `<model-id>` is a placeholder, not a
documented usable model.

```yaml
llm:
  provider: copilot-sdk # or openai-compatible
  model: '<model-id>'
  auth:
    type: github-token # or env, which reads the adapter's fixed variable
  admission: all # or maintainer-approved
```

The documented adapter pairings are `copilot-sdk` with `github-token`, and
`openai-compatible` with `env`; the comments do not imply arbitrary combinations.
Secret values never belong in the policy.

> **[NEEDS INPUT]** A complete example requires the final schema, a supported model
> identifier, and project-specific commands, platforms, runner image, and limits.
> The sources do not provide these, so the fragment cannot be expanded safely into
> an installable policy.

Source: [architecture §8](../architecture.md#8-policy-the-quality-contract).

## Documented policy areas (Proposed)

The following covers every content area listed in architecture §8. Unless a
default is listed above, its values and defaults remain unspecified.

| Area                      | What maintainers configure                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported behavior        | Supported behavior; release/support windows and maintenance-branch mappings; platforms; compatibility guarantees; project components; authoritative documents and decisions.                                                      |
| Trusted paths             | Workflow definitions, wrappers, policy and runner directories, CI scripts, and project additions. Changes prevent reliance on PR-controlled CI.                                                                                   |
| Execution-sensitive paths | Package scripts, build/test configuration, reporters, shared test helpers, harness code, and project additions. Changes require triage.                                                                                           |
| Categories                | `bugfix`, `feature`, `refactor`, `docs`, `chore`, `security`; evidence required per category.                                                                                                                                     |
| Submission                | Required issue/PR fields, validated-issue linkage, reference requirements, and `unrequested_change`. SP06 also permits a policy choice about free-form submissions.                                                               |
| Execution                 | Mandatory build, test, lint, and static-analysis commands; platform matrix; result formats; additional checks that impact analysis may add without removing mandatory checks.                                                     |
| Runner                    | Image source, execution network setting, dependency step, and resource limits. The image may be defined under `.github/patch-steward/runner/` on the trusted branch.                                                              |
| Inference                 | Provider, model, authentication reference, endpoint options, generation settings, required capabilities, and admission rule.                                                                                                      |
| Stages                    | Stages per category, challenge rounds, and whether to continue after the first blocking finding. Policy may lower the pinned workflow's maximum round count.                                                                      |
| Escalation                | Routing of sensitive paths, ambiguous requirements, and security-claimed issues to maintainer triage. SP08 also describes policy-listed security terms.                                                                           |
| Limits                    | Call and retry limits; timeouts; CPU, memory, process and output bounds; adapter inference limits; approximate daily run/inference caps; per-author concurrency; attachment count/byte/decompression bounds; stale-check timeout. |
| Policy change             | Rescreening of already published outcomes using `policy_change`.                                                                                                                                                                  |
| Modes                     | `observe`, `advise`, or `enforce`, globally and per category.                                                                                                                                                                     |
| Follow-through            | Maximum follow-ups per cycle.                                                                                                                                                                                                     |
| Hygiene                   | Passive automated-activity heuristics, automated-account allowlist, and whether flagged activity appears in reports. Flags never change the outcome.                                                                              |
| Evidence                  | Store type, retention period, redaction patterns, and Pages publication subset.                                                                                                                                                   |
| Dismissal codes           | Catalog of stable reason identifiers and definitions, including `proposal-required`; projects may extend it.                                                                                                                      |

Additional policy controls described in the processes include an optional public
reference-host allowlist, approved reproduction-attachment destinations,
policy-permitted CI coverage, high-impact paths for additional tests, and an
optional project-board triage view. The steward
does not manage the board. Exact schema keys and defaults are absent.

SP01 lists example dismissal codes:

```text
no-reproduction
intended-behavior
not-applicable-version
unsupported-claim
fabricated-reference
duplicate
out-of-scope
insufficient-benefit
proposal-required
```

> **[NEEDS INPUT]** The complete dismissal catalog with definitions, field/template
> mappings, all numeric limits, platform rules beyond Linux, result
> parsing formats, dependency-network/service policy, and retention-pruning
> mechanics remain undefined. These conceptual controls must not be converted
> into guessed YAML keys.

Sources: [architecture §8](../architecture.md#8-policy-the-quality-contract),
[open decisions §15](../architecture.md#15-open-implementation-decisions),
[SP01](../processes.md#sp01-policy-management), [SP06](../processes.md#sp06-intake-and-submission-contract-check),
[SP07](../processes.md#sp07-reference-verification), [SP08](../processes.md#sp08-claim-validation),
[SP11](../processes.md#sp11-independent-challenge), [SP15](../processes.md#sp15-maintainer-triage-override-and-appeal).

## Credentials and deployment (Proposed)

| Credential                    | Actions screening                                                                                                                                                                                               | Local use                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GitHub App id and private key | Default-branch-only publication Environment; only `gate` and `publish` receive App credentials.                                                                                                                 | CLI never holds the App private key.                                                  |
| GitHub access                 | Job-specific `GITHUB_TOKEN`; scoped App tokens for writes and authorized separate-evidence-repository access.                                                                                                   | User's own token through `gh` authentication or a fine-grained personal access token. |
| Copilot inference             | Model jobs use `GITHUB_TOKEN` with `copilot-requests: write`. Organization use requires the documented policy, "Allow use of Copilot CLI billed to the organization" (unverified; `probes/findings.md` PA08.7). | User's Copilot login or token with Copilot Requests permission.                       |
| OpenAI-compatible inference   | `STEWARD_LLM_API_KEY`, supplied from the separate model Environment only to `intake` and `assess` jobs.                                                                                                         | The same fixed variable in the user's shell, according to architecture §6.3.          |

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

> **[NEEDS INPUT]** Architecture §6.3 names `STEWARD_LLM_API_KEY`, while §15 still
> lists per-adapter environment variable names and local Copilot credential
> conventions as open decisions. Confirm the final credential contract before
> implementation. App-secret names, Environment names, provider/model defaults,
> and credential-provisioning commands are also missing.

Sources: [architecture §6.3](../architecture.md#63-adapters),
[§6.4](../architecture.md#64-github-action-and-reusable-workflows),
[§6.5](../architecture.md#65-command-line-interface-packagescli),
[§12](../architecture.md#12-resource-cost-and-failure-controls),
[§15](../architecture.md#15-open-implementation-decisions),
[SP02](../processes.md#sp02-adoption-and-installation).

## Evidence and visibility (Proposed)

The evidence store is append-only except for retention pruning. It holds run
records, findings, reports, redacted bounded logs, maintainer actions, and metrics.
A separate repository requires an App installation there too. Both store types
restrict pushes to the App and maintainers where the plan and visibility of
the repository that holds the store offer rulesets; where GitHub refuses
rulesets, the restriction is unavailable.

An evidence branch in a public repository is public. Excluding a record from the
Pages subset does not make that branch record private. Private target
repositories default to no public export. Records referenced by maintainer
actions, appeals, audits, or evaluation datasets are retained; metrics events
are kept.

The maintenance workflow generates the static dashboard data:

| Path                  | Content                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `data/policy.json`    | Public policy subset and contributor requirements.                                    |
| `data/index.json`     | Recent runs, states/outcomes, revisions, and changed-input markers.                   |
| `data/runs/<id>.json` | Report, evidence references, usage, and cost where available.                         |
| `data/queues.json`    | Triage, author-response, approval, appeal, queued, audit, and proposal-backlog views. |
| `data/metrics.json`   | Calibration and operating metrics.                                                    |

These are generated outputs, not configuration files. The browser cannot read
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
The CLI package declares `engines.node >=24` and depends on the core package as
`workspace:*`; the core package's `exports` map resolves `@patch-steward/core`
to its compiled `dist/` output at Node runtime.

| File                       | Current settings                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` | Node 24; build/test on Ubuntu and Windows for PRs and pushes to `master`, `develop`, and `release/**`; lint/format for PRs; Codecov upload from `develop` using `CODECOV_TOKEN`.                                |
| `.github/workflows/cd.yml` | Runs when the root `package.json` changes on `master`; builds/tests, creates absent `v<version>` tag, then merges `master` into `develop` only when that new tag was created.                                   |
| `vitest.config.ts`         | Test tiers by filename suffix: unit (`*.test.ts`) and fixture (`*.fixture.test.ts`) projects run under `pnpm test`; container and live suffixes are excluded. Coverage merges to the root `coverage/lcov.info`. |
| `eslint.config.mjs`        | ESLint and TypeScript ESLint recommended configurations; ignores `**/dist/`, `docs/`, and `coverage/`.                                                                                                          |
| `.prettierignore`          | Excludes `pnpm-lock.yaml`, `dist/`, `coverage/`, `node_modules/`, and `development-artifacts/`.                                                                                                                 |

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

Relative TypeScript imports use `.js` extensions under this ESM configuration.
Tests are excluded from every package build, so build success alone does not
verify them; Vitest resolves `@patch-steward/core` to `packages/core/src`, so
`pnpm test` needs no prior build.

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
[Vitest](../../vitest.config.ts), [ESLint](../../eslint.config.mjs),
[Prettier exclusions](../../.prettierignore), [TypeScript base](../../tsconfig.base.json),
[Prettier](../../.prettierrc.json), [repository guidance](../../CLAUDE.md#toolchain-constraints).
