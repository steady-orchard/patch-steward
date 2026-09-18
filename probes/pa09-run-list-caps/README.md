# PA09 — run-list caps

Probes whether `gate`'s Actions run-list queries can bound today's runs and in-progress runs, attribute them to the
submission author rather than the triggering actor, and stay cheap and fresh enough for a per-admission cap check.

## Sub-claims

- PA09.1 (assumption): today's runs and in-progress runs of a workflow can be listed within bounded queries
  (`GET /repos/{owner}/{repo}/actions/runs` with `created`, `status`, `event`, and workflow filters), with pagination
  and the documented 1,000-result ceiling recorded.
- PA09.2 (assumption): those runs can be attributed to the submission author rather than the workflow actor within
  bounded queries, for PR-opened, PR-edited-by-another-identity, comment-by-another-identity, re-run-by-another-identity,
  `workflow_run`, and `schedule` events; and which mechanism restores author attribution without one API call per run.
- PA09.3 (measurement): requests and rate-limit units per cap evaluation for the job `GITHUB_TOKEN` and the App
  token, and the delay before a just-started run appears in the listing.

## Fixtures

- Branches: `probe-pa09-base` (base, org-public), `probe-pa09-head-1` (same-repo head, org-public),
  `probe-pa09-head-fork-1` (fork head, jambolo/patch-steward-testbed-public).
- PR titles: `[probe PA09] same-repo submission 1`, `[probe PA09] fork submission 1`.
- Issue title: `[probe PA09] issue submission 1`.

## Deployment list

- probe-pa09-listen.yml: org-public
- probe-pa09-follow.yml: org-public
- probe-pa09-act.yml: org-public
- probe-pa09-count.yml: org-public

## Procedure

```sh
bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public master "probe(PA09): deploy PA09 workflows" <W>/probes/pa09-run-list-caps/workflows/probe-pa09-listen.yml <W>/probes/pa09-run-list-caps/workflows/probe-pa09-follow.yml <W>/probes/pa09-run-list-caps/workflows/probe-pa09-act.yml <W>/probes/pa09-run-list-caps/workflows/probe-pa09-count.yml

bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public probe-pa09-base "probe(PA09): base branch" <W>/probes/pa09-run-list-caps/fixtures/marker.txt:probe-pa09/base.txt
bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public probe-pa09-head-<k> "probe(PA09): same-repo head" <W>/probes/pa09-run-list-caps/fixtures/marker.txt:probe-pa09/head-<k>.txt
bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-public probe-pa09-head-fork-<k> "probe(PA09): fork head" <W>/probes/pa09-run-list-caps/fixtures/marker.txt:probe-pa09/head-fork-<k>.txt

gh api repos/steady-orchard/patch-steward-testbed-public/pulls -X POST -f title='[probe PA09] same-repo submission <k>' -f head=probe-pa09-head-<k> -f base=probe-pa09-base -f body='Probe PA09 fixture PR.' --jq .number   # -> A
gh api repos/steady-orchard/patch-steward-testbed-public/pulls -X POST -f title='[probe PA09] fork submission <k>' -f head=jambolo:probe-pa09-head-fork-<k> -f base=probe-pa09-base -f body='Probe PA09 fixture PR.' --jq .number   # -> F
gh api repos/steady-orchard/patch-steward-testbed-public/issues -X POST -f title='[probe PA09] issue submission <k>' -f body='Probe PA09 fixture issue.' --jq .number   # -> I

# Read loop (every 20 s, <=5 min) until the listener run for pull_request_target sub=<A> is completed -> RA (its id)

bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa09-act.yml master action=edit-pr target=<A>
bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa09-act.yml master action=comment target=<A>
bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa09-act.yml master action=comment target=<I>
bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa09-act.yml master action=rerun target=<RA>

# Read loop (<=6 min) until no listener or follower run is queued or in progress. Then:
bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa09-count.yml master trigger_issue=<I>

# Collect: the listener runs for A, F, I (facts of each; RA attempt 1 and --attempt 2), the follower runs:
gh run list -R steady-orchard/patch-steward-testbed-public --workflow probe-pa09-follow.yml --limit 30 --json databaseId,displayTitle,event,conclusion
gh api -i "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" | tr -d '\r' | grep -iE '^(HTTP/|x-ratelimit-)'

gh api repos/steady-orchard/patch-steward-testbed-public/pulls/<A> -X PATCH -f state=closed --jq .state
gh api repos/steady-orchard/patch-steward-testbed-public/pulls/<F> -X PATCH -f state=closed --jq .state
gh api repos/steady-orchard/patch-steward-testbed-public/issues/<I> -X PATCH -f state=closed --jq .state
```

DECISION RULES:

- PA09.1 confirmed iff the count run obtained today's total and in-progress/queued counts for both tokens with the
  `created` filter and pagination (requests counted); refuted iff a filtered listing could not be obtained within
  bounded queries. The documented 1,000-result ceiling is recorded in a Measurements-free evidence line.
- PA09.2 evidence: one line per event kind with actor and triggering_actor: PR opened by jambolo; PR edited by
  the bot; comment by the bot on the PR; comment by the bot on the issue; re-run of the PR-opened run by the bot
  (attempt 2); a follower (workflow_run) run; a schedule run of probe-pa03-schedule.yml. Mechanisms: (m1) display_title
  `author=<id>` equal to jambolo's id for every listener run, including bot-triggered runs and the re-run; (m2) the
  follower's title copies it; (m3) `pull_requests` in the runs list for the same-repo PR and for the fork PR (empty
  for the fork). Confirmed iff m1 attributes every listener run to jambolo within the bounded list queries; refuted
  iff no candidate mechanism does (quote the design sentence).
- PA09.3 confirmed when requests per evaluation and the freshness delay were measured. Measurements rows: requests
  per cap evaluation (job token), (App token) (count lines' `requests=`); rate limit (job token), (App token)
  (x-ratelimit-limit from the headers lines); rate limit (user token) (from a local `gh api -i` read); listing
  freshness (Unit s, `after_s` of `fresh first_seen`; Method "App comment, then an immediate listing check and every
  20 s"; Samples 1).
