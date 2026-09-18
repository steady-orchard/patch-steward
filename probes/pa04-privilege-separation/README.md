# PA04 — Job privilege separation

Probes docs/architecture.md §6.4 job privilege separation: Environment secret isolation, the reusable-workflow
permission ceiling, `publish`'s dependency/condition semantics, and cancellation.

## Sub-claims

- PA04.1: an Environment secret reaches only jobs that declare that `environment`; sibling jobs in the same run
  read an empty value; this holds for jobs inside a called reusable workflow, including one hosted in another
  repository, which resolve the CALLER repository's Environment.
- PA04.2: a called workflow's job cannot hold more `GITHUB_TOKEN` permissions than the caller grants; record the
  exact behavior when the called job requests a permission the caller omits, for `copilot-requests: write` and
  for one ordinary scope.
- PA04.3: a job that `needs` every pipeline job with the `publish` condition
  (`if: ${{ always() && needs.gate.result == 'success' && needs.gate.outputs.committed == 'true' }}`) runs after
  failed and after skipped upstream jobs, and does not run when `gate` fails or `committed` is not `'true'`; job
  outputs cross `needs` inside a reusable workflow.
- PA04.4: cancellation — whether `publish` still runs when the run is cancelled while an upstream job executes,
  and the final states of the other jobs.

## Fixtures

- Environment `probe-pa04-env` per test-bed, each holding one DUMMY secret `PROBE_PA04_ENV_MARKER` whose value
  names the test-bed: `probe-pa04-marker-org-public` (steady-orchard/patch-steward-testbed-public),
  `probe-pa04-marker-org-private` (steady-orchard/patch-steward-testbed-private, later step),
  `probe-pa04-marker-personal` (jambolo/patch-steward-testbed-personal).
- probe-pa04-callee.yml is hosted on two repositories so probe-pa04-envs.yml can call it cross-repository:
  - steady-orchard/patch-steward-testbed-public @ 3f20e849eeacc02ecde6465401871c4e8da8efa9
  - jambolo/patch-steward-testbed-personal @ fbe1cdac3812bf69540d6c4a494911bc0b3bb4b8
- probe-pa04-callee-secrets.yml (Q4 re-probe) hosted and pinned on
  steady-orchard/patch-steward-testbed-public @ a521cf08fea17e7fdc3b71bb40116f8ea901b059 and
  jambolo/patch-steward-testbed-personal @ 822fd3ef8b345ebce0e862e71ce8e294cb089575; no repository- or
  organization-level PROBE_PA04_ENV_MARKER exists, so W1's mapping passes an empty value.

## Deployment list

- probe-pa04-callee.yml: org-public, org-private, personal
- probe-pa04-envs.yml: org-public, org-private, personal
- probe-pa04-callee-perms.yml: org-public, org-private, personal
- probe-pa04-ceiling-omit-issues.yml: org-public, org-private, personal
- probe-pa04-ceiling-omit-copilot.yml: org-public, org-private, personal
- probe-pa04-ceiling-grant.yml: org-public, org-private, personal
- probe-pa04-pipeline.yml: org-public
- probe-pa04-publish.yml: org-public
- probe-pa04-callee-secrets.yml: org-public, personal
- probe-pa04-w1-host-org-public.yml: org-private, personal
- probe-pa04-w2-host-org-public.yml: org-private, personal
- probe-pa04-w1-host-personal.yml: org-public, org-private
- probe-pa04-w2-host-personal.yml: org-public, org-private

## Procedure

Placeholders: `<tb>` one of steady-orchard/patch-steward-testbed-public, steady-orchard/patch-steward-testbed-private,
jambolo/patch-steward-testbed-personal; `<W>` the worktree root; `<id>` the step id running this procedure.
org-private and personal run PA04.1 and PA04.2 only (Environment with their own marker, deploy the six shared
files, dispatch envs and the three ceiling callers); org-public additionally runs PA04.3 and PA04.4.

1. `bash probes/smoke/tools/environment.sh <tb> probe-pa04-env PROBE_PA04_ENV_MARKER <marker-for-tb>`
2. Deploy the callee to every host that runs it cross-repository:
   `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA04): deploy probe-pa04-callee.yml" <W>/probes/pa04-privilege-separation/workflows/probe-pa04-callee.yml`
3. Pin the cross-repository calls: read each host's latest commit touching
   `.github/workflows/probe-pa04-callee.yml` on master
   (`gh api "repos/<tb>/commits?path=.github/workflows/probe-pa04-callee.yml&sha=master&per_page=1" --jq '.[0].sha'`),
   verify its content blob equals `git hash-object <W>/probes/pa04-privilege-separation/workflows/probe-pa04-callee.yml`,
   then edit probe-pa04-envs.yml replacing the two 40-`1`/40-`2` placeholder SHAs with the two hosts' commit SHAs.
4. Deploy the remaining shared files in one call:
   `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA04): deploy PA04 workflows" <W>/probes/pa04-privilege-separation/workflows/probe-pa04-envs.yml <W>/probes/pa04-privilege-separation/workflows/probe-pa04-callee-perms.yml <W>/probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-issues.yml <W>/probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-copilot.yml <W>/probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-grant.yml`
   (org-public additionally deploys probe-pa04-pipeline.yml and probe-pa04-publish.yml in the same call).
5. PA04.1: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa04-envs.yml master`; collect facts and jobs.
6. PA04.2: for each of probe-pa04-ceiling-omit-issues.yml, probe-pa04-ceiling-omit-copilot.yml,
   probe-pa04-ceiling-grant.yml: `bash probes/smoke/tools/dispatch.sh <tb> <file> master`. On exit 1, fall back to
   `gh run list -R <tb> --workflow <file> --limit 3 --json databaseId,displayTitle,status,conclusion,createdAt` and
   `gh run view <id> -R <tb>` for the newest run. Collect facts, jobs, and each ran job's
   `GITHUB_TOKEN Permissions` block.
7. org-public only, PA04.3/PA04.4: for s in A B C D E F:
   `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa04-publish.yml master scenario=<s>`;
   collect facts and jobs for each (job names appear as `pipeline / <job>`).
8. Write `results/<key>.md` (org-public, org-private, or personal) per the decision rules below, plus this README.

### Decision rules

- PA04.1 (run of probe-pa04-envs): confirmed iff caller/with-env origin=org-public, caller/sibling length 0, every
  callee/with-env line (legs local, xrepo-org-public, xrepo-personal) origin=org-public, every callee/without-env
  origin=empty; refuted iff a job without the Environment got a non-empty value, or a callee with-env job printed
  the HOST's marker (e.g. origin=personal on leg xrepo-personal), or a with-env job got empty; if a
  cross-repository leg fails at startup with an access/policy error (not a probe defect) → undetermined / blocked
  quoting it.
- PA04.2 (the three ceiling runs): per omit run record which behavior occurred — run-level startup failure (no
  job ran, control did not run), job-level failure of the violating callee job, or silent downgrade (job ran; its
  `GITHUB_TOKEN Permissions` lack the omitted scope) — and whether the other callee job and control ran. The
  grant run is the positive control (both callee jobs list the requested scopes). Confirmed iff no omit run gave
  the violating job the omitted scope AND in both omit runs control still ran; refuted iff a violating job HELD
  the omitted scope (ceiling exceeded), or an omission failed the whole run at startup (control did not run: the
  design's `inconclusive` presumption fails — quote it); undetermined / ambiguous if the grant run did not show
  the requested scopes (the probe cannot discriminate).
- PA04.3 (runs A–E): confirmed iff publish ran (`job=publish ran=yes`) in A, B, C with committed=true in its line
  and intake logged gate_committed_seen=true in A, AND publish was skipped in D and E; refuted iff publish did not
  run in A, B, or C, or ran in D or E.
- PA04.4 (run F): record every job's final status/conclusion and whether `job=canceller cancel_request_utc=` was
  logged. Confirmed iff the cancellation landed while execute ran (execute concluded cancelled) and publish did
  not run to completion; refuted iff publish ran to completion after the cancellation (quote "A workflow
  cancellation can still prevent publication." and state what ran); undetermined / ambiguous if the run was not
  cancelled while execute ran.

### Q4 re-probe procedure

A drift re-run first enables each file (standalone):
`gh api repos/<owner>/<repo>/actions/workflows/<file>/enable -X PUT`

5. Deploy the callee to both its hosts:
   `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA04): deploy probe-pa04-callee-secrets.yml" <W>/probes/pa04-privilege-separation/workflows/probe-pa04-callee-secrets.yml`
6. Pin the callers: read the callee host's latest commit touching
   `.github/workflows/probe-pa04-callee-secrets.yml` on master
   (`gh api "repos/<tb>/commits?path=.github/workflows/probe-pa04-callee-secrets.yml&sha=master&per_page=1" --jq '.[0].sha'`),
   verify its content blob equals `git hash-object <W>/probes/pa04-privilege-separation/workflows/probe-pa04-callee-secrets.yml`
   (expect `<SHA_OP>` for steady-orchard/patch-steward-testbed-public, `<SHA_P>` for
   jambolo/patch-steward-testbed-personal), then replace the matching 40-`1`/40-`2` placeholder SHA in the
   corresponding `probe-pa04-w1-host-<host>.yml` / `probe-pa04-w2-host-<host>.yml` caller files.
7. Deploy the callers of a given host in one call:
   `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA04): deploy probe-pa04-w1-host-<host>.yml probe-pa04-w2-host-<host>.yml" <W>/probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-<host>.yml <W>/probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-<host>.yml`
8. Dispatch each caller: `bash probes/smoke/tools/dispatch.sh <tb> probe-pa04-w1-host-<host>.yml master` and
   `bash probes/smoke/tools/dispatch.sh <tb> probe-pa04-w2-host-<host>.yml master`. Exit 3 →
   `bash probes/smoke/tools/wait-run.sh <tb> <run-id>`; exit 1 → keep the output, then
   `gh run list -R <tb> --workflow <file> --limit 3 --json databaseId,displayTitle,status,conclusion,createdAt`.
9. Collect facts, jobs, and run conclusion per run; apply the STARTUP FAILURES classification. Per test-bed the
   legs are: org-public runs W1, W2 → host personal; org-private runs W1, W2 → host org-public and host personal;
   personal runs W1, W2 → host org-public. Write each leg's result to a `### E<n> — Q4 re-probe: ...` section of
   the test-bed's `results/<key>.md`.

### Q4 re-probe decision notes

PA04.1 rows keep `refuted` / `none`; the Evidence cell appends the re-probe evidence ids; Deviations from the
design stays unchanged. Per leg: `callee_with_env` equal to the CALLER's key means that wiring delivered the
caller's Environment secret to the called job; equal to the HOST's key means the called job resolved the host
repository's own Environment; `empty` means not delivered; `other` means an unknown value (record it verbatim).
`caller_sibling` or `callee_without_env` not `empty` means sibling isolation broke under that wiring. A run
conclusion of `startup_failure` (all origins `not-run`) while the other wiring to the same host ran to completion
means the platform refused that wiring. The owner's decision on the wiring is recorded in
[ADR-0033](../../docs/adr/0033-explicit-secrets-mapping.md); nothing in this README decides it.
