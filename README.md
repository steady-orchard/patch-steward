# Patch Steward

Patch Steward proposes local and GitHub-hosted tools to help contributors and
maintainers validate, verify, improve, and screen GitHub issues and pull
requests before substantive maintainer review.

## Goal

Alleviate the unsustainable review burden described in the
[problem statement](docs/problem-statement.md), preserving maintainer time and
motivation for development, credible security findings, and community growth.
Low-value submissions, unsupported claims, missing reproductions, unsuitable
patches, abandoned revisions, and noisy exchanges shift investigation and
completion work onto maintainers.

Patch Steward aims to:

- Establish that a reported problem is real, applicable, and worth addressing
  before investing in patch review.
- Check supporting evidence, reproduce failures, and assess fixes against project
  intent, existing design, and regression checks.
- Help contributors supply missing evidence, explain their choices, and finish
  revisions before handing work to maintainers.
- Keep reports and automated feedback concise, evidence-based, and actionable,
  with uncertainty and severity judgments left for appropriate maintainer triage.
- Reduce repeated investigation and queue pressure while preserving access for
  valid contributions, appeals, and maintainer overrides.

Success means a measured reduction in maintainer workload without systematically
excluding valid contributions. Screening assesses substance and contributor
support; AI assistance or ease of generation alone does not establish poor
quality. Passing checks does not establish project value or authorize merging.

## Status

This is a **WORK IN PROGRESS**

Project scaffold and design documentation. The screening core, CLI, GitHub
action and workflows, browser app, LLM and GitHub adapters, and sandboxed runner
are not implemented. The sample source and test only verify the development
toolchain. The probes/ directory holds the platform-assumption probe suite and
its findings for disposable test-bed repositories; it is not product code and
never runs in CI.

The [user manual](docs/user-manual/README.md) covers scaffold setup, proposed
workflows, configuration, and troubleshooting, with explicit documentation gaps.

The [whitepaper](docs/whitepaper.md) connects these problems to the proposed
methodology, requirements, architecture, and decisions. The
[architecture](docs/architecture.md) records the selected components, trust
boundaries, and GitHub features; the [processes](docs/processes.md) define
each screening, feedback, and calibration process (SP01–SP20). Version 1
screens GitHub issues and pull requests in public or private repositories.

## Local execution and integrations

The intended implementation is one TypeScript/Node.js screening core in a pnpm
monorepo, shared by a local CLI, a GitHub action with reusable workflows, and a
static browser app for contributors and maintainers on GitHub Pages. It uses
a provider-independent LLM adapter for inference (a Copilot SDK adapter
authenticated with the workflow's GitHub token, or an OpenAI-compatible
provider with a project-supplied key, selected in the project's policy), a
GitHub App identity for bot writes, GitHub Actions events as triggers, and
containers started by trusted jobs as the sandbox. It invokes existing Git, build, and test tools and can screen
repositories written in other languages.

No hosted backend exists. Continuous screening runs in GitHub Actions in the
target repository; the local CLI screens on demand with the user's own GitHub
token and inference credential and cannot receive events. TypeScript was selected by preference and fit; Python
has no demonstrated advantage for the established requirements.

## Development

Install Node.js 24 and pnpm. The exact pnpm version is recorded in package.json.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
pnpm format:check
pnpm coverage
```

- packages/: workspace packages core, cli, action, and web; toolchain smoke
  code only.
- fixtures/: shared corpus for fixture-tier tests.
- templates/: files that later milestones will install into target
  repositories via steward init; nothing is installed today.
- probes/: platform-assumption probes PA01–PA09 (sub-claims PA0N.M) against
  disposable test-bed repositories, with findings in probes/findings.md; not a
  workspace package and never run in CI.
- docs/problem-statement.md: review problems, evidence, and scope boundaries.
- docs/whitepaper.md: methodology, goals, and a summary of the design.
- docs/architecture.md: components, trust zones, topologies, GitHub features,
  policy, data model, states, security, and open implementation decisions.
- docs/processes.md: the processes SP01–SP20 with triggers, steps, controls,
  failure handling, and measures.
- docs/adr/: architecture decision records ADR-NNNN, one per design decision,
  recording why it was made; the design documents govern.
- docs/deferred.md: designs of features excluded from version 1 (DF01–DF09);
  the other documents assume they will not be implemented.
- .github/workflows/: scaffold CI and release automation.

## Automation

CI builds and tests on Node 24 on Windows and Linux for PRs targeting any
branch and for pushes to master, develop, and release branches. Lint and
formatting checks run for PRs. Coverage uploads from develop use the
CODECOV_TOKEN repository secret. GitHub Pages deployment
is omitted because this local project has no Pages configuration.

The scaffold CD workflow builds and tests package changes on master, creates a
version tag if absent, and merges master into develop only when that new tag
is created. Both branches must exist
on the remote and repository permissions/rules must allow these operations.
No GitHub remote or API credentials are configured by this scaffold.

These workflows validate this project's scaffold; they do not implement the
proposed issue and PR screening service.

## Trust boundaries

Submitted code and contributor-supplied reproductions run only inside
disposable containers that a trusted job starts without credentials, never
directly on a maintainer's host. Worktrees and subprocesses alone are not
security isolation. Results from project CI retain their signal provenance.
Container isolation protects hosts and credentials; it does not make test
results trustworthy. Submitted code can manipulate reporters, result files, and
exit status in either topology. Execution-sensitive changes require triage;
baseline comparisons and independent challenges add evidence without
guaranteeing integrity. Keep LLM and GitHub credentials in trusted orchestration;
each event is one default-branch workflow run, only its gate and publish jobs
hold scoped App tokens, and only its intake and assess jobs hold the model
credential and never execute submitted code. Challenge plans run in separate
execution jobs on fresh runners, followed by model-only assessment jobs.
Treat PR content, comments, logs, and model
output as untrusted data; a submission cannot modify its own active quality
policy.
Service failure, model refusal, malformed output, or missing evidence never
produce a pass.

## License

MIT. See [LICENSE](LICENSE).
