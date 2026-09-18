# ADR-0023: Platform-assumption probe suite in root probes/

- Status: accepted
- Date: 2026-09-18
- Deciders: project owner
- Source: `docs/architecture.md` §6.1; `probes/README.md`

## Context and Problem Statement

The design depends on GitHub and Copilot behaviors that were verified by probes run against disposable test-bed repositories: probe workflows are deployed to the test-beds and run there. The probe sources, their exact procedures, the results, the findings record, and the measured limits need a home, and the suite has to stay usable as a regression suite against platform drift. Where does the probe suite live?

## Considered Options

- Root probes/ directory in this repository — canonical probe sources, procedures, results, findings, and measured limits in `probes/`; the test-beds hold deployed copies
- A workspace package
- Probe workflows in this repository's `.github/workflows/`

## Decision Outcome

Chosen option: "Root probes/ directory in this repository", because the test-bed repositories are disposable and can be recreated from the canonical files in this repository.

Approved as planned: the root directory `probes/` of this repository, not a workspace package, holds the probe suite; nothing is added to this repository's `.github/workflows/`; the test-beds hold deployed copies that are checked against the canonical files by blob SHA. The suite is kept as a regression suite against platform drift.

### Consequences

- [Architecture §6.1](../architecture.md) places `probes/` in the repository layout, outside the workspace packages and outside CI.
- The [probe suite README](../../probes/README.md) defines the layout, the deployment of canonical files with the blob-identity check, and the drift re-run; each probe's README works from the canonical files already in its own directory.
- The suite is not product code and never runs in this repository's CI ([ADR-0021](0021-test-tiers-and-ci-placement.md)); its identifiers are decided in [ADR-0024](0024-platform-assumption-identifiers.md).

## More Information

- Workflow files under `probes/` are inert in this repository, because GitHub reads workflow definitions only from the root `.github/workflows/`.
- The project owner decided this on September 18, 2026.
