# PA07 — App-token writes

Checks whether writes made with the GitHub App installation token trigger workflow runs (and with which
platform-assigned identity), while the same writes with the job `GITHUB_TOKEN` trigger nothing.

## Sub-claims

- PA07.1 (assumption): writes made with the App installation token trigger workflows: issue comment create, edit,
  delete (`issue_comment`); issue create, edit, close, reopen (`issues`); PR body edit and ready-for-review
  (`pull_request_target`); record which events label changes and reactions fire. Control: the same writes with the
  job `GITHUB_TOKEN` trigger nothing.
- PA07.2 (assumption): identity fields — for each event in PA07.1 record the payload and context fields that identify
  the writer as this App (for example `sender.login`, `sender.id`, `sender.type`, `comment.performed_via_github_app`,
  `issue.performed_via_github_app`, `github.actor`, `github.actor_id`, `github.triggering_actor`), whether any field
  identifies the installation rather than only the App, and which fields a non-App user could imitate.
- PA07.3 (measurement): whether the platform applies any recursion guard to runs triggered by App-token writes (the
  design assumes none); latency from write to triggered run.

## Fixtures

- Branches `probe-pa07-base` (holds both workflows plus `probe-pa07/base.txt`); heads `probe-pa07-head-<k>-app` and
  `probe-pa07-head-<k>-github` branched from `probe-pa07-base`, each adding one file (`fixtures/marker.txt`).
- Draft PR titles `[probe PA07] app writes <k>` and `[probe PA07] github writes <k>`.
- Issue titles `[probe PA07] writes <token> <nonce>` (token one of `app`, `github`).
- Label `probe-pa07:x`, added and removed by the writer on both the issue and the PR.
- Writer's token permissions: job permissions `contents`, `issues`, `pull-requests` write; the App token is minted
  with `permission-contents`, `permission-issues`, `permission-pull-requests` write (attempt 1 omitted
  `permission-contents` and its `markPullRequestReadyForReview` GraphQL mutation was refused; see
  `results/org-public.md` E8).

## Deployment list

- probe-pa07-listen.yml: org-public, org-private, personal
- probe-pa07-write.yml: org-public, org-private, personal

## Procedure

`<tb>` = owner/repo of the test-bed, `<W>` = worktree root, `<k>` = attempt number, `<N>` = the nonce embedded in the
issue title by the writer, `<id>` = a PR or issue number. Run tools from the main repository root. org-private and
personal repeat the same steps for PA07.1 and PA07.2 (PA07.3's latency and recursion-guard measurements were taken
only on org-public).

5. `bash probes/smoke/tools/deploy.sh <tb> master "probe(PA07): deploy probe-pa07-listen.yml probe-pa07-write.yml" <W>/probes/pa07-app-token-writes/workflows/probe-pa07-listen.yml <W>/probes/pa07-app-token-writes/workflows/probe-pa07-write.yml`
6. Branches:
   - `bash probes/smoke/tools/deploy.sh <tb> probe-pa07-base "probe(PA07): base branch" <W>/probes/pa07-app-token-writes/fixtures/marker.txt:probe-pa07/base.txt`
   - `bash probes/smoke/tools/deploy.sh <tb> probe-pa07-head-<k>-app "probe(PA07): head for the app pass" <W>/probes/pa07-app-token-writes/fixtures/marker.txt:probe-pa07/head-<k>-app.txt`
   - `bash probes/smoke/tools/deploy.sh <tb> probe-pa07-head-<k>-github "probe(PA07): head for the github pass" <W>/probes/pa07-app-token-writes/fixtures/marker.txt:probe-pa07/head-<k>-github.txt`
7. Draft PRs:
   - `gh api repos/<tb>/pulls -X POST -f title='[probe PA07] app writes <k>' -f head=probe-pa07-head-<k>-app -f base=probe-pa07-base -f body='Probe PA07 fixture PR.' -F draft=true --jq .number`
   - `gh api repos/<tb>/pulls -X POST -f title='[probe PA07] github writes <k>' -f head=probe-pa07-head-<k>-github -f base=probe-pa07-base -f body='Probe PA07 fixture PR.' -F draft=true --jq .number`
   - → PA and PG.
8. `bash probes/smoke/tools/dispatch.sh <tb> probe-pa07-write.yml master token=app pr=<PA>` (on exit 3, `wait-run.sh <tb> <run-id>`); collect its `write=` and `write-refused=` lines (issue number I_app).
   Then `bash probes/smoke/tools/dispatch.sh <tb> probe-pa07-write.yml master token=github pr=<PG>`; collect (I_gh).
9. Wait until 3 min after the github pass ended and until no listener run is queued or in progress (read loop, at
   most 10 min); list listener runs; collect the facts of every app-pass listener run (numbers I_app and PA); confirm
   that no listener run carries I_gh or PG.
10. Close both PRs: `gh api repos/<tb>/pulls/<PA> -X PATCH -f state=closed --jq .state` (same for PG); read
    `gh api repos/<tb>/issues/<I_app> --jq .state` and the same for I_gh → `closed` (close any that is open with
    `gh api repos/<tb>/issues/<id> -X PATCH -f state=closed --jq .state`).

DECISION RULES.

- PA07.1 confirmed iff every App write of the claim's kinds (issue create, edit, close, reopen; comment create,
  edit, delete; PR body edit; ready-for-review) was performed (`write=` line) and produced a listener run within
  10 min AND no write of the github pass produced any listener run; refuted iff a performed App write of those kinds
  produced no run, or a github-pass write produced a run; undetermined / blocked iff every performed App write of
  those kinds produced a run and nothing refutes, but an App write of those kinds was refused by the platform
  (`write-refused=` with contents, issues, and pull-requests write granted): cite the refusal verbatim, the deployed
  writer's mint block, and attempt 1's refusal. Label and reaction outcomes are recorded in the evidence but do not
  decide the row.
- PA07.2 confirmed iff every App-triggered event carries platform-assigned fields identifying the App (e.g.
  `sender.login` `patch-steward-testbed[bot]` with `sender.type` `Bot`, `performed_via_github_app` where present);
  refuted iff an App-triggered event carries no platform-assigned field that identifies the App. The evidence gives,
  per field: value seen, platform-assigned or writer-chosen (imitable), and whether any field names the installation
  (the event JSON's `installation` value, compared with the installation id).
- PA07.3 confirmed when latencies were measured. Measurement rows: `recursion guard` (value `none observed` if App
  writes made from inside a workflow run triggered runs, else `observed`; method: the writer is itself a workflow
  run), `write to run latency min`, `median`, `max` (unit s; listener run createdAt minus the write's utc; samples =
  matched pairs).

EXPECTED EVENT PER APP WRITE (for matching):

| Write kind                          | Expected listener event                                |
| ----------------------------------- | ------------------------------------------------------ |
| issue-create                        | `issues` `opened`                                      |
| issue-edit                          | `issues` `edited`                                      |
| comment-create / -edit / -delete    | `issue_comment` `created` / `edited` / `deleted`       |
| issue-label-add / -remove           | `issues` `labeled` / `unlabeled`                       |
| issue-close, issue-close-final      | `issues` `closed`                                      |
| issue-reopen                        | `issues` `reopened`                                    |
| pr-convert-to-draft                 | `pull_request_target` `converted_to_draft`             |
| pr-ready-for-review                 | `pull_request_target` `ready_for_review`               |
| pr-body-edit                        | `pull_request_target` `edited`                         |
| pr-label-add                        | `pull_request_target` `labeled`                        |
| issue-reaction-add, pr-reaction-add | no workflow event exists for reactions (expected none) |
