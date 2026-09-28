# ADR-0076: Reusable screening workflow, publication Environment, and App tokens

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §7, §12.1; `docs/user-manual/configuration.md` "Credentials and deployment"

## Context and Problem Statement

Architecture §6.4 has thin wrappers call a reusable workflow pinned by commit SHA and keeps the App key in a
default-branch-only publication Environment that only `gate` and `publish` declare, delivered by an explicit
secrets mapping ([ADR-0033](0033-explicit-secrets-mapping.md)). Open were the names, the job structure before
the stage jobs exist, the token scopes, the publish condition for closures, and the job summaries. A later
test-bed audit found that a job declaring the Environment in the string form `environment: steward-publication`
leaves a Deployment on the pull request head for every such job of a `pull_request_target` run (40 on five
test-bed pull requests), created by the run's triggering actor. What are the workflow, its Environment
declaration, and the token rules?

## Considered Options

- A reusable workflow with build, gate, and publish jobs, an Environment declared without deployments, and
  tokens minted by the core
- Declare the Environment in the string form
- Reuse the probe suite's App secret names
- Mint tokens with actions/create-github-app-token

## Decision Outcome

Chosen option: "A reusable workflow with build, gate, and publish jobs, an Environment declared without
deployments, and tokens minted by the core", because the string form leaves a Deployment on the pull request, a
write observe mode must not make; distinct secret names keep the product's secret path apart from the probe
configuration on shared test-beds; and minting in the core keeps the private key in the one step that runs the
steward, with every token naming exactly its repositories and permissions.

`.github/workflows/steward-screening.yml`: `on: workflow_call` only, so it never runs in this repository; input
`steward_ref` (the same 40-hex SHA the caller pins); secrets `PATCH_STEWARD_APP_ID` and
`PATCH_STEWARD_APP_PRIVATE_KEY`, both not required, delivered from the caller's Environment.

Jobs `build` -> `gate` -> `publish`; the stage jobs arrive later, so `publish` applies the decision to the gate
handoff and a runnable run ends `inconclusive` with cause `stage-incomplete`.

`permissions: {}` at the workflow and on every job; the wrappers grant `permissions: {}` too, equal to what the
jobs request ([ADR-0027](0027-wrapper-permission-ceiling.md)).

Environment: only `gate` and `publish` declare `steward-publication`, each as this mapping:

```yaml
environment:
  name: steward-publication
  deployment: false
```

With `deployment: false` the Environment secrets and the default-branch-only deployment branch policy still
apply and no Deployment is created; on a test-bed the same declaration delivered both secrets on the default
branch and was refused on another branch by the protection rule. The string form is never used, because every
Environment-declaring job of a `pull_request_target` run then leaves a Deployment on the pull request head. The
Deployments recorded before the change stay on the test-beds.

Names: Environment `steward-publication`, deployment branches restricted to the default branch; Environment
secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY`, set only as Environment secrets, never as
repository or organization secrets, so the wrapper-side expressions evaluate empty and only
Environment-declaring jobs receive values (proved on each test-bed by the secret-scope scenario S17). Only the
step of `gate` and `publish` that runs the steward references the secrets, under the same names, in its `env:`;
`build` declares no Environment and references no secret.

`publish` condition: `always()`, `gate` succeeded, and either the gate output `committed` or `record_only` is
`true`, so closures get a record-only publication.

Concurrency: only `publish` has a group, `steward-<repository id>-<pr|issue>-<number>` from the gate output, or
the per-run fallback `steward-<repository id>-run-<run id>` for closures, with `cancel-in-progress: false`; no
workflow-level concurrency.

Handoffs: same-run artifacts `steward-handoff` (the handoff record and the gate context record) and
`steward-closure` (the closure record), retained 1 day and uploaded before the ownership artifact; `publish`
validates and binds them before any evidence request and loads the gate's policy by its recorded tree id.

Job summaries: at most 65536 characters per job, derived values as escaped code spans, no title, body, login, or
report text; the `publish` summary is written only after the evidence read-back and states the ownership
artifact retention and the freshness.

Tokens: the core signs an RS256 JWT (540 s lifetime, issued 60 s in the past), looks up each repository's
installation, requests a token with explicit repositories and permissions, and revokes it when the job ends.
`gate`: a target token with actions, contents, issues, and pull requests read, and a contents-read token for a
separate store only for the deduplication fallback. `publish`: the same target reads plus contents write on the
store repository, merged into one token for an orphan-branch store; a store under another account uses that
account's installation. The key and every token are redacted as exact values and masked (one mask per line of
the key) before any other output, never written to files, outputs, artifacts, or logs, and never passed between
jobs. Each job's token requests and policy load spend a fixed bootstrap budget of 20 requests.

Job timeouts: `build` 15, `gate` 10, `publish` 20 minutes, on `ubuntu-latest`.

Wrapper templates `templates/workflows/steward-pr.yml` and `templates/workflows/steward-issues.yml`: the run
name, the accepted events, `permissions: {}`, and one job `screen` that calls the pinned workflow with
`steward_ref` and the explicit secrets mapping; the pin is the placeholder of forty zeros until a release
exists. Test-bed copies add a sender allowlist to the job; the templates carry none.

### Consequences

- [architecture §6.4](../architecture.md), the Environments row of [architecture §7](../architecture.md), and
  [architecture §12.1](../architecture.md) (job summary size, JWT lifetime, same-run retention) state the rules;
  the [configuration manual](../user-manual/configuration.md) names the Environment, its secrets, and the
  declaration; static workflow tests assert the declaration form, the pins, the empty permissions, the explicit
  secrets mapping, and a secret-free `build` job; on all three test-beds the deployed workflows passed the
  static check (S14) and the secret-scope check (S17), and a pull request screened after the change had no
  Deployment (S13) (`scenarios/README.md`).

## More Information

- The project owner decided this on September 27, 2026, and the declaration with `deployment: false` on
  September 28, 2026, after the test-bed audit.
