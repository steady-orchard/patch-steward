# Patch Steward User Manual

Patch Steward is a work in progress. This repository contains a development scaffold, design documents, the policy module (loading, validation, revision identity, defaults, and the public subset), shared vocabularies, version-1 record schemas, a redaction module, the submission module with its deterministic contract check, a GitHub adapter, the ownership module, the decision, report, and evidence modules with a local evidence store and the orphan-branch and repository stores, the issue forms, PR template, and wrapper workflow templates, the `steward policy`, `steward preflight`, `steward screen`, and `steward report` commands, and a GitHub-hosted skeleton. Preflight covers its deterministic checks only, and `steward screen` runs at contract level only (it checks the submission contract and records a local report and evidence, with no screening stage, container, model call, or publication). The GitHub-hosted skeleton runs the reusable screening workflow's `build`, `gate`, and `publish` jobs in observe mode at contract level and has run only on dedicated test-bed repositories; it creates no check run, report comment, or label. Not implemented: screening stages, check runs, report comments, labels, and review requests, the maintenance workflow, the browser app, the LLM adapters, the sandboxed runner, installation in a target repository, `steward init`, and `steward replay`.

The installation guide covers the runnable scaffold. Sections marked
**Available** describe what runs today; sections marked **Proposed** describe
the documented product design, not available functionality.

## Table of contents

1. [Overview](overview.md)
   - [Purpose and scope](overview.md#purpose-and-scope)
   - [Key concepts](overview.md#key-concepts)
   - [Execution options](overview.md#execution-options-proposed)
   - [Outcomes and waiting states](overview.md#outcomes-and-waiting-states-proposed)
   - [Operating modes](overview.md#operating-modes-proposed)
2. [Installation](installation.md)
   - [Prerequisites](installation.md#prerequisites)
   - [Set up the development scaffold](installation.md#set-up-the-development-scaffold)
   - [Verify the installation](installation.md#verify-the-installation)
   - [Install screening in a target repository](installation.md#target-repository-installation-proposed)
3. [Usage](usage.md)
   - [Work on the scaffold](usage.md#work-on-the-scaffold)
   - [Prepare a submission](usage.md#prepare-a-submission-available)
   - [Report a defect or propose a change](usage.md#report-a-defect-or-propose-a-change-proposed)
   - [Submit a pull request](usage.md#submit-a-pull-request-proposed)
   - [Read a report and respond](usage.md#read-a-report-and-respond-proposed)
   - [Maintainer triage](usage.md#maintainer-triage-proposed)
   - [Local screening](usage.md#local-screening-available)
   - [Historical replay](usage.md#historical-replay-proposed)
   - [Calibrate enforcement](usage.md#calibrate-enforcement-proposed)
4. [Command reference](commands.md)
   - [Development commands](commands.md#development-commands-available)
   - [CLI conventions](commands.md#cli-conventions-available)
   - [`steward policy`](commands.md#steward-policy-available)
   - [`steward preflight`](commands.md#steward-preflight-available)
   - [`steward screen`](commands.md#steward-screen-available)
   - [`steward report`](commands.md#steward-report-available)
   - [CLI commands](commands.md#cli-commands-proposed)
   - [GitHub conversation commands](commands.md#github-conversation-commands-proposed)
5. [Configuration](configuration.md)
   - [Policy file and revision](configuration.md#policy-file-and-revision-available)
   - [Policy validation](configuration.md#policy-validation-available)
   - [Policy keys](configuration.md#policy-keys-available)
   - [Credentials and deployment](configuration.md#credentials-and-deployment-proposed)
   - [Local evidence and reports](configuration.md#local-evidence-and-reports-available)
   - [Evidence and visibility](configuration.md#evidence-and-visibility-proposed)
   - [Scaffold configuration](configuration.md#scaffold-configuration-available)
6. [Troubleshooting](troubleshooting.md)
   - [Scaffold and availability](troubleshooting.md#scaffold-and-availability)
   - [Submission corrections](troubleshooting.md#submission-corrections-proposed)
   - [Waiting states and checks](troubleshooting.md#waiting-states-and-checks-proposed)
   - [Infrastructure and inference](troubleshooting.md#infrastructure-and-inference-proposed)
   - [Reports, commands, and dashboard](troubleshooting.md#reports-commands-and-dashboard-proposed)

## Sources and documentation gaps

This manual uses only repository material:

- [Project README](../../README.md): current status, development commands, and scaffold automation.
- [Problem statement](../problem-statement.md): the review burden and scope boundaries.
- [Whitepaper](../whitepaper.md): methodology and evaluation goals.
- [Architecture](../architecture.md): components, boundaries, configuration areas, and open decisions.
- [Processes](../processes.md): workflows, decisions, commands, and failure handling.
- [Policy template](../../templates/policy/policy.yml)
  and [policy module](../../packages/core/src/policy/): the implemented policy schema and validation.
- [Issue forms](../../templates/issue-forms/), [PR template](../../templates/pull-request/pull_request_template.md),
  and [submission module](../../packages/core/src/submission/): the implemented submission contract.
- [Package manifest](../../package.json), [sample source](../../packages/core/src/index.ts),
  [sample test](../../packages/core/src/index.test.ts), and [repository guidance](../../CLAUDE.md): development behavior.
- [CI](../../.github/workflows/ci.yml), [CD](../../.github/workflows/cd.yml),
  [TypeScript configuration](../../tsconfig.base.json), [ESLint configuration](../../eslint.config.mjs),
  and [Prettier configuration](../../.prettierrc.json): existing toolchain settings.

Where design documents differ, the architecture governs components and
boundaries, the processes govern steps and behavior, and the whitepaper defers
to both.

`[NEEDS INPUT]` callouts identify information absent or unresolved in the sources.
No published CLI installation command or project issue export was supplied.
