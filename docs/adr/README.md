# Architecture Decision Records

Each record in this directory states one design decision of Patch Steward: the problem it answered, the options considered, the option chosen and why, and its consequences.

## Format

Records follow MADR. Each file starts with the heading `# ADR-NNNN: <title>` and the metadata lines `Status`, `Date`, `Deciders`, and `Source`, followed by these sections in this order:

- `## Context and Problem Statement`
- `## Decision Drivers` (optional)
- `## Considered Options`
- `## Decision Outcome`, with `### Consequences`
- `## Pros and Cons of the Options` (optional)
- `## More Information`

`Source` names the persistent location that states the decision, or says that none exists outside the record.

## Precedence

Records are record only: they record why a decision was made and govern nothing. [architecture.md](../architecture.md), [processes.md](../processes.md), and the [user manual](../user-manual/README.md) govern. When a record and a governing document disagree, the governing document wins, and the record's status becomes `superseded by <governing location or ADR-NNNN>`.

## Numbering

ADR-0001 to ADR-0016 record the decisions selected with the architecture, in the order the architecture listed them. Later records follow in chronological order of decision date.

## Records

| ADR                                                             | Title                                                               | Status   | Date       |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | -------- | ---------- |
| [ADR-0001](0001-browser-code-role.md)                           | Browser code role                                                   | accepted | 2026-09-15 |
| [ADR-0002](0002-browser-secrets.md)                             | Browser secrets                                                     | accepted | 2026-09-16 |
| [ADR-0003](0003-submission-types.md)                            | Submission types                                                    | accepted | 2026-09-15 |
| [ADR-0004](0004-security-reports.md)                            | Security reports                                                    | accepted | 2026-09-16 |
| [ADR-0005](0005-deployment-and-triggers.md)                     | Deployment and triggers                                             | accepted | 2026-09-15 |
| [ADR-0006](0006-sandbox-model.md)                               | Sandbox model                                                       | accepted | 2026-09-15 |
| [ADR-0007](0007-local-cli-scope.md)                             | Local CLI scope                                                     | accepted | 2026-09-15 |
| [ADR-0008](0008-llm-provider.md)                                | LLM provider                                                        | accepted | 2026-09-16 |
| [ADR-0009](0009-evidence-store.md)                              | Evidence store                                                      | accepted | 2026-09-15 |
| [ADR-0010](0010-automated-participation.md)                     | Automated participation                                             | accepted | 2026-09-15 |
| [ADR-0011](0011-distribution.md)                                | Distribution                                                        | accepted | 2026-09-15 |
| [ADR-0012](0012-repository-layout.md)                           | Repository layout                                                   | accepted | 2026-09-15 |
| [ADR-0013](0013-orchestration.md)                               | Orchestration                                                       | accepted | 2026-09-15 |
| [ADR-0014](0014-llm-authentication.md)                          | LLM authentication                                                  | accepted | 2026-09-16 |
| [ADR-0015](0015-preflight-inference.md)                         | Preflight inference                                                 | accepted | 2026-09-16 |
| [ADR-0016](0016-inference-admission.md)                         | Inference admission                                                 | accepted | 2026-09-16 |
| [ADR-0017](0017-first-ecosystems-for-result-parsing.md)         | First ecosystems for result parsing and anti-gaming fixtures        | accepted | 2026-09-17 |
| [ADR-0018](0018-self-screening-of-this-repository.md)           | Self-screening of this repository                                   | accepted | 2026-09-17 |
| [ADR-0019](0019-lockstep-versioning-and-cd-manifest.md)         | One lockstep version with root package.json as the CD manifest      | accepted | 2026-09-17 |
| [ADR-0020](0020-node-24-only.md)                                | Node.js 24 only                                                     | accepted | 2026-09-17 |
| [ADR-0021](0021-test-tiers-and-ci-placement.md)                 | Test tiers and their CI placement                                   | accepted | 2026-09-17 |
| [ADR-0022](0022-shared-fixture-corpus-home.md)                  | Shared fixture corpus in root fixtures/                             | accepted | 2026-09-17 |
| [ADR-0023](0023-probe-suite-location.md)                        | Platform-assumption probe suite in root probes/                     | accepted | 2026-09-18 |
| [ADR-0024](0024-platform-assumption-identifiers.md)             | PA01–PA09 platform-assumption identifiers                           | accepted | 2026-09-18 |
| [ADR-0025](0025-ruleset-dependent-controls-limitation.md)       | Ruleset-dependent controls where rulesets are not offered           | accepted | 2026-09-25 |
| [ADR-0026](0026-ownership-artifact-ordering.md)                 | Ownership artifact ordering by created_at                           | accepted | 2026-09-25 |
| [ADR-0027](0027-wrapper-permission-ceiling.md)                  | Wrapper permissions equal the pinned reusable workflow's            | accepted | 2026-09-25 |
| [ADR-0028](0028-publish-after-cancellation.md)                  | Publication after cancellation                                      | accepted | 2026-09-25 |
| [ADR-0029](0029-copilot-organization-policy-limitation.md)      | Copilot organization policy on organization-owned repositories      | accepted | 2026-09-25 |
| [ADR-0030](0030-per-submission-concurrency-after-commitment.md) | Per-submission concurrency only after commitment                    | accepted | 2026-09-25 |
| [ADR-0031](0031-merge-queue-relay-membership.md)                | Merge-queue relay membership and echo filtering                     | accepted | 2026-09-25 |
| [ADR-0032](0032-organization-billing-unverified-marker.md)      | Unverified marker for the organization billing path                 | accepted | 2026-09-25 |
| [ADR-0033](0033-explicit-secrets-mapping.md)                    | Explicit per-name secrets mapping into the pinned reusable workflow | accepted | 2026-09-25 |
