# ADR-0078: Test-bed scenario suite

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `scenarios/README.md`

## Context and Problem Statement

The GitHub-hosted behaviors (ownership, deduplication, supersession, caps, evidence first, an append-only store,
Environment-only secrets, observe mode writing nothing) depend on platform behavior that fixture tests cannot show.
They must be demonstrated live without ever running in this repository or in a real repository. Where do the
procedures, tools, and results live, and what may they touch?

## Considered Options

- A persistent top-level scenario suite
- Place the suite under probes/

## Decision Outcome

Chosen option: "A persistent top-level scenario suite", because `probes/` holds platform-assumption probes, while
the scenarios verify the steward itself and stay as a regression procedure.

Layout: `scenarios/README.md` (procedure per scenario, safety rules, budgets), `scenarios/tools/*.sh` (bash and
`gh`, reusing the probe suite's deploy, dispatch, and wait tools by path), `scenarios/workflows/` (the test-bed
wrapper copies and helper workflows), `scenarios/fixtures/` (test-bed policies and submission bodies), and
`scenarios/results/<test-bed key>.md` (verbatim evidence per test-bed); not a workspace package; never runs in CI;
checked by Prettier; no planning identifiers.

Test-beds: an organization-owned public repository, a personally owned public repository, and an
organization-owned private repository whose evidence goes to a separate private evidence repository, plus a fork
used only as a pull request head. Issue and pull request titles start `[scenario S<nn>]` and branches
`scenario-s<nn>-*`.

Safety: steward and scenario workflows run only for allowlisted senders (a guard on the test-bed wrapper copies,
never in the templates); no pull request head is checked out or executed; no event text reaches a `run:` step
through an expression; only `actions/*` actions pinned by full commit SHA; secrets are never printed; repositories,
issues, and Deployments are never deleted; a test-bed's default branch changes only through the deploy tools.
Budgets: poll at most every 20 s, wait at most 15 minutes per run, stop below 500 remaining core requests, and
spend at most 30 billed Actions minutes on the private test-bed.

Secret-scope pair (scenario S17): a called workflow with a job `outside` that declares no Environment and a job
`inside` that declares `steward-publication` as the mapping with `deployment: false`, each printing only whether
each App secret is empty; the caller passes the secrets with a mapping byte-identical to the wrapper template's.
Every scenario workflow job that declares the Environment uses the mapping form.

Deployment audit (scenario S13): `scenarios/tools/audit.sh` counts App comments, labels, App check runs, requested
reviewers, and Deployments on scenario pull request heads; Deployments that GitHub Actions created for
`steward-publication` for the allowlisted user or the App's bot user before the wrappers with `deployment: false`
were deployed are listed as before-fix and are not writes; any other Deployment counts. On the organization-owned
public test-bed 40 such Deployments remain on five pull requests from before the change.

Ambiguous and unavailable ownership or snapshot reads cannot be forced live without manipulating the platform;
fixture-tier tests with recorded responses prove them.

Steady state and what stays: the steward and scenario workflows disabled, no open scenario submission; the
evidence branches, the evidence repository, the policy, the Environment, the disabled wrapper files, closed
scenario submissions, every Deployment and deployment status, and a one-off check workflow with its branch stay.

### Consequences

- `scenarios/README.md` holds the procedures and tools, and `scenarios/results/` records every scenario as passing
  on the three test-beds; the suite is persistent and follows the documentation rules of the persistent documents;
  the probe suite's tools stay in `probes/` and are reused by path.

## More Information

- The project owner decided this on September 27, 2026; the Deployment audit, the declaration rule for scenario
  workflows, and what stays on the test-beds on September 28, 2026.
