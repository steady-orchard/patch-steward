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

| ADR                                                                | Title                                                               | Status   | Date       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | -------- | ---------- |
| [ADR-0001](0001-browser-code-role.md)                              | Browser code role                                                   | accepted | 2026-09-15 |
| [ADR-0002](0002-browser-secrets.md)                                | Browser secrets                                                     | accepted | 2026-09-16 |
| [ADR-0003](0003-submission-types.md)                               | Submission types                                                    | accepted | 2026-09-15 |
| [ADR-0004](0004-security-reports.md)                               | Security reports                                                    | accepted | 2026-09-16 |
| [ADR-0005](0005-deployment-and-triggers.md)                        | Deployment and triggers                                             | accepted | 2026-09-15 |
| [ADR-0006](0006-sandbox-model.md)                                  | Sandbox model                                                       | accepted | 2026-09-15 |
| [ADR-0007](0007-local-cli-scope.md)                                | Local CLI scope                                                     | accepted | 2026-09-15 |
| [ADR-0008](0008-llm-provider.md)                                   | LLM provider                                                        | accepted | 2026-09-16 |
| [ADR-0009](0009-evidence-store.md)                                 | Evidence store                                                      | accepted | 2026-09-15 |
| [ADR-0010](0010-automated-participation.md)                        | Automated participation                                             | accepted | 2026-09-15 |
| [ADR-0011](0011-distribution.md)                                   | Distribution                                                        | accepted | 2026-09-15 |
| [ADR-0012](0012-repository-layout.md)                              | Repository layout                                                   | accepted | 2026-09-15 |
| [ADR-0013](0013-orchestration.md)                                  | Orchestration                                                       | accepted | 2026-09-15 |
| [ADR-0014](0014-llm-authentication.md)                             | LLM authentication                                                  | accepted | 2026-09-16 |
| [ADR-0015](0015-preflight-inference.md)                            | Preflight inference                                                 | accepted | 2026-09-16 |
| [ADR-0016](0016-inference-admission.md)                            | Inference admission                                                 | accepted | 2026-09-16 |
| [ADR-0017](0017-first-ecosystems-for-result-parsing.md)            | First ecosystems for result parsing and anti-gaming fixtures        | accepted | 2026-09-17 |
| [ADR-0018](0018-self-screening-of-this-repository.md)              | Self-screening of this repository                                   | accepted | 2026-09-17 |
| [ADR-0019](0019-lockstep-versioning-and-cd-manifest.md)            | One lockstep version with root package.json as the CD manifest      | accepted | 2026-09-17 |
| [ADR-0020](0020-node-24-only.md)                                   | Node.js 24 only                                                     | accepted | 2026-09-17 |
| [ADR-0021](0021-test-tiers-and-ci-placement.md)                    | Test tiers and their CI placement                                   | accepted | 2026-09-17 |
| [ADR-0022](0022-shared-fixture-corpus-home.md)                     | Shared fixture corpus in root fixtures/                             | accepted | 2026-09-17 |
| [ADR-0023](0023-probe-suite-location.md)                           | Platform-assumption probe suite in root probes/                     | accepted | 2026-09-18 |
| [ADR-0024](0024-platform-assumption-identifiers.md)                | PA01–PA09 platform-assumption identifiers                           | accepted | 2026-09-18 |
| [ADR-0025](0025-ruleset-dependent-controls-limitation.md)          | Ruleset-dependent controls where rulesets are not offered           | accepted | 2026-09-25 |
| [ADR-0026](0026-ownership-artifact-ordering.md)                    | Ownership artifact ordering by created_at                           | accepted | 2026-09-25 |
| [ADR-0027](0027-wrapper-permission-ceiling.md)                     | Wrapper permissions equal the pinned reusable workflow's            | accepted | 2026-09-25 |
| [ADR-0028](0028-publish-after-cancellation.md)                     | Publication after cancellation                                      | accepted | 2026-09-25 |
| [ADR-0029](0029-copilot-organization-policy-limitation.md)         | Copilot organization policy on organization-owned repositories      | accepted | 2026-09-25 |
| [ADR-0030](0030-per-submission-concurrency-after-commitment.md)    | Per-submission concurrency only after commitment                    | accepted | 2026-09-25 |
| [ADR-0031](0031-merge-queue-relay-membership.md)                   | Merge-queue relay membership and echo filtering                     | accepted | 2026-09-25 |
| [ADR-0032](0032-organization-billing-unverified-marker.md)         | Unverified marker for the organization billing path                 | accepted | 2026-09-25 |
| [ADR-0033](0033-explicit-secrets-mapping.md)                       | Explicit per-name secrets mapping into the pinned reusable workflow | accepted | 2026-09-25 |
| [ADR-0034](0034-policy-schema-covers-every-area.md)                | Policy schema covers every policy area in version 1                 | accepted | 2026-09-26 |
| [ADR-0035](0035-integer-schema-versions.md)                        | Integer schema versions and the rule for evolving schemas           | accepted | 2026-09-26 |
| [ADR-0036](0036-zod-single-schema-source.md)                       | Zod as the single schema source                                     | accepted | 2026-09-26 |
| [ADR-0037](0037-strict-yaml-policy-subset.md)                      | Strict YAML subset for the policy file                              | accepted | 2026-09-26 |
| [ADR-0038](0038-policy-revision-git-tree-id.md)                    | Policy revision is the git tree id of the policy directory          | accepted | 2026-09-26 |
| [ADR-0039](0039-optional-inference-section.md)                     | Optional inference section and provider pairing                     | accepted | 2026-09-26 |
| [ADR-0040](0040-required-keys-and-documented-defaults.md)          | Required policy keys and documented defaults                        | accepted | 2026-09-26 |
| [ADR-0041](0041-policy-change-default-enforced.md)                 | `policy_change` defaults to `enforced`                              | accepted | 2026-09-26 |
| [ADR-0042](0042-free-form-submissions-off-by-default.md)           | Free-form submissions are off by default                            | accepted | 2026-09-26 |
| [ADR-0043](0043-default-label-names.md)                            | Default label names                                                 | accepted | 2026-09-26 |
| [ADR-0044](0044-built-in-dismissal-code-catalog.md)                | Built-in dismissal-code catalog                                     | accepted | 2026-09-26 |
| [ADR-0045](0045-public-policy-subset.md)                           | Public policy subset                                                | accepted | 2026-09-26 |
| [ADR-0046](0046-hard-bounds-are-steward-constants.md)              | Hard bounds are steward constants                                   | accepted | 2026-09-26 |
| [ADR-0047](0047-redaction-patterns.md)                             | Redaction patterns                                                  | accepted | 2026-09-26 |
| [ADR-0048](0048-steward-policy-command.md)                         | `steward policy` command                                            | accepted | 2026-09-26 |
| [ADR-0049](0049-separate-type-check-pass-for-tests.md)             | Tests are type-checked by a separate compiler pass                  | accepted | 2026-09-26 |
| [ADR-0050](0050-versioned-field-mapping.md)                        | Versioned field mapping by rendered labels and a PR template marker | accepted | 2026-09-26 |
| [ADR-0051](0051-one-glob-syntax.md)                                | One glob syntax for repository paths                                | accepted | 2026-09-26 |
| [ADR-0052](0052-built-in-path-classes.md)                          | Built-in path classes for category consistency                      | accepted | 2026-09-26 |
| [ADR-0053](0053-built-in-trusted-and-execution-sensitive-paths.md) | Built-in trusted and execution-sensitive path lists                 | accepted | 2026-09-26 |
| [ADR-0054](0054-attachment-destinations-formats-and-fetching.md)   | Attachment destinations, formats, and fetching                      | accepted | 2026-09-26 |
| [ADR-0055](0055-snapshot-composition-and-hashing.md)               | Snapshot composition and hashing                                    | accepted | 2026-09-26 |
| [ADR-0056](0056-canonical-claim-scope-text.md)                     | Canonical claim-scope text                                          | accepted | 2026-09-26 |
| [ADR-0057](0057-deterministic-contract-result.md)                  | Deterministic contract result                                       | accepted | 2026-09-26 |
| [ADR-0058](0058-github-read-adapter-without-sdk.md)                | GitHub read adapter without an SDK dependency                       | accepted | 2026-09-26 |
| [ADR-0059](0059-cli-github-authentication.md)                      | CLI GitHub authentication                                           | accepted | 2026-09-26 |
| [ADR-0060](0060-steward-preflight-command.md)                      | `steward preflight` command                                         | accepted | 2026-09-26 |
| [ADR-0061](0061-live-probe-test-runner.md)                         | Live-probe test runner                                              | accepted | 2026-09-26 |
