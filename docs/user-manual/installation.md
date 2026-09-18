# Installation

[Manual contents](README.md) · [Overview](overview.md) · [Usage](usage.md)

## Prerequisites

For the existing development scaffold:

- A local checkout of this repository.
- Node.js 24. The CI workflows pin Node 24; the CLI package declares `engines.node >=24`.
- pnpm **10.20.0**, as pinned in `package.json`.

The scaffold's CI runs builds and tests on Windows and Linux. Its packages are
marked private and contain no CLI executable declaration.

> **[NEEDS INPUT]** The sources do not specify Node.js/pnpm installation
> commands or a canonical clone URL. They also do not supply a published
> screening CLI package name, installation command, or release compatibility
> matrix.

Sources: [README development section](../../README.md#development),
[package manifest](../../package.json), [CI workflow](../../.github/workflows/ci.yml).

## Set up the development scaffold

Run these commands from the repository root:

1. Install the locked dependencies.

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Compile the workspace packages into their `dist/` directories.

   ```sh
   pnpm build
   ```

3. Run the sample test.

   ```sh
   pnpm test
   ```

These steps set up the toolchain. They do not install an issue or PR screening
service.

Sources: [README](../../README.md#development), [TypeScript configuration](../../tsconfig.base.json).

## Verify the installation

The sample test checks that calling `greet('world')` returns `Hello, world!`:

```typescript
expect(greet('world')).toBe('Hello, world!');
```

This assertion is from `packages/core/src/index.test.ts`. A successful build and passing test
verify the scaffold's compilation and test execution. Then run the documented
quality checks:

```sh
pnpm lint
pnpm format:check
pnpm coverage
```

Coverage uses the LCOV reporter. The CI workflow reads `coverage/lcov.info` for
its Codecov upload. `CODECOV_TOKEN` is needed for that upload from `develop`, not
for the local coverage command.

Sources: [sample test](../../packages/core/src/index.test.ts), [package scripts](../../package.json),
[CI workflow](../../.github/workflows/ci.yml).

## Target-repository installation (Proposed)

The following is the documented adoption sequence. None of its screening
components or templates exists yet.

### Required resources

- Administrator access to the target GitHub repository and an administrator's GitHub token.
- A pinned Patch Steward version providing the CLI, templates, action, and reusable workflows.
- A GitHub App identity for writes, with checks, issues, pull requests, and contents
  write permissions, plus metadata and Actions read access; job tokens narrow these permissions.
- The selected inference adapter, model, and credential.
- An evidence store: an orphan branch in the target repository by default, or a separate repository.
- GitHub Pages if an authorized public dashboard is wanted.
- Docker or Podman for maintainer local screening or replay.

### Setup sequence

1. Initialize from a clone of the target repository. The proposed command name is:

   ```text
   steward init
   ```

   It is designed to install a policy skeleton, issue forms, a PR template, four
   wrapper workflows, CODEOWNERS entries, and labels. It asks for the adapter,
   model, and authentication method. Existing-file changes are shown as a diff
   and require confirmation before overwriting.

2. Register or install the GitHub App. Store its id and private key as secrets in
   a GitHub Environment restricted to the default branch. Only the `gate` and
   `publish` jobs receive these App credentials.

3. Configure inference according to [the credential reference](configuration.md#credentials-and-deployment-proposed).
   Copilot uses the model jobs' `GITHUB_TOKEN` with `copilot-requests: write`.
   The OpenAI-compatible adapter uses a provider key from a separate,
   default-branch-only Environment. Only `intake` and `assess` jobs receive it.
   For private repositories, record administrator authorization for the selected
   context to be sent to the provider.

4. Create the evidence branch or repository. If separate, install the App there
   too. Where the plan and visibility of the repository that holds the store
   offer rulesets, restrict evidence-store pushes to the App and repository
   maintainers. On a Free-plan organization's private repository GitHub
   refuses rulesets, so this restriction is unavailable; `steward init` is
   designed to report that.

5. Configure the policy and begin in `observe` mode.

6. For public repositories, enable Pages with Actions as its deployment source.
   Private repositories keep public publication disabled unless an explicit
   public subset is approved. Private evidence and Actions summaries provide
   visibility without Pages.

7. Run the installation self-test through the maintenance workflow's
   `workflow_dispatch` entry point. It is designed to screen a synthetic
   submission, probe inference capabilities, confirm that an unusable model
   credential produces `inconclusive`, and verify fresh-check, neutral-check,
   and merge-queue relay behavior.

8. Before enabling `enforce` for any category, require the stable steward check
   from the designated App, enable strict up-to-date branches or a merge queue,
   and require code-owner review of policy and wrapper paths. Verify mixed-mode
   behavior and same-commit reruns with the self-test before enabling the ruleset.
   GitHub offers rulesets and merge queue only for some plans and visibility
   settings. On a Free-plan organization's private repository they are
   refused, so `enforce` stays off and the repository runs `observe` or
   `advise` without a required check. The same refusal makes required
   code-owner review of policy and wrapper paths unavailable, and the
   installation is designed to report that as well.

> **[NEEDS INPUT]** Completing these steps requires the CLI distribution,
> version/commit to pin, App registration or installation details, Environment and
> secret names, stable check name, valid policy template, runner image setup, and
> exact self-test inputs. The sources describe their roles but do not provide a
> runnable installation recipe.

Sources: [installation process SP02](../processes.md#sp02-adoption-and-installation),
[architecture §6.4](../architecture.md#64-github-action-and-reusable-workflows),
[installed paths §6.7](../architecture.md#67-files-installed-in-a-target-repository).
