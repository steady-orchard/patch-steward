# Scenario results: org-public

Test-bed `steady-orchard/patch-steward-testbed-public`. Verbatim evidence from the test-bed scenario suite described in
`../README.md`; command output is copied unchanged inside `text` fences. Sections appear in the order the scenarios ran.

## S17 publication Environment delivers the App secrets only to Environment jobs

Date (UTC): 2026-09-28. Run: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36409896857.

```text
$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=organization-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok
```

```text
$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-public
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=master existed=yes
DEPLOY commit=39d3426736d1e497675c8884cf16e1fbe3858fc5 message=scenario: deploy secret-scope pair
DEPLOY push=ok attempt=1 head=39d3426736d1e497675c8884cf16e1fbe3858fc5
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=9020f1a58702ee33bab4f83555a6e5ba9fb00168
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE repo=steady-orchard/patch-steward-testbed-public run=36409896857 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36409896857 result=pass
```

Result: pass

## S09 pull requests that change the wrapper and the policy

Date (UTC): 2026-09-28. A same-repository pull request and a fork pull request each changed
`.github/workflows/steward-pr.yml` and `.github/patch-steward/policy.yml` on a scenario branch; both were screened
under the default-branch workflow definition and the trusted default-branch policy (tree `d997b1e362c75af03942da0e7a1e8902ca5dbe51`).
Pull requests: https://github.com/steady-orchard/patch-steward-testbed-public/pull/32 (same-repository),
https://github.com/steady-orchard/patch-steward-testbed-public/pull/33 (fork). Runs:
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36410834391 (same-repository),
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36411709793 (fork).

```text
$ M=$(gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'); echo "M=$M"
M=d997b1e362c75af03942da0e7a1e8902ca5dbe51
```

```text
$ bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s09-same "scenario: S09 change the wrapper and the policy" scenarios/fixtures/pull-requests/steward-pr-modified.yml:.github/workflows/steward-pr.yml scenarios/fixtures/policies/caps-daily.yml:.github/patch-steward/policy.yml
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=scenario-s09-same existed=yes
DEPLOY identical dest=.github/workflows/steward-pr.yml blob=85fe99a69b4a731fd2bcc4f8e3abf59cad747d30
DEPLOY identical dest=.github/patch-steward/policy.yml blob=756c706810fa43e1c6eab4a654b405130441be70
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=scenario-s09-same" --jq '.[] | select(.name=="patch-steward") | .sha'
b1916b8f26073a908208c9e5afa66fdd067f68a8
$ gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s09-same --title "[scenario S09] same-repository pull request changing the wrapper and the policy" --body-file fixtures/submissions/pr-chore.txt
https://github.com/steady-orchard/patch-steward-testbed-public/pull/32
```

```text
$ gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/36410834391 --jq '[.name, .path, .event, .display_title] | join(" | ")'
steward pr 32 author 2095171 event pull_request_target opened sender 2095171 User | .github/workflows/steward-pr.yml | pull_request_target | steward pr 32 author 2095171 event pull_request_target opened sender 2095171 User
$ gh run view 36410834391 -R steady-orchard/patch-steward-testbed-public --json workflowName --jq .workflowName
steward-pr
$ gh run view 36410834391 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36410834391 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |- )'
LOG job=gate ts=2026-09-28T10:39:03.7093102Z text=event pull_request_target opened pr 32 sender User
LOG job=gate ts=2026-09-28T10:39:03.7093651Z text=policy trusted-branch revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=gate ts=2026-09-28T10:39:03.7094147Z text=listing none
LOG job=gate ts=2026-09-28T10:39:03.7094376Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T10:39:03.7094603Z text=caps within daily 2 of 50 author 1 of 2
LOG job=gate ts=2026-09-28T10:39:03.7094603Z text=disposition runnable
LOG job=gate ts=2026-09-28T10:39:03.7217965Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `32`
LOG job=gate ts=2026-09-28T10:39:03.7218806Z text=- Run: `36410834391-1`
LOG job=gate ts=2026-09-28T10:39:03.7219100Z text=- Status: `runnable`
LOG job=gate ts=2026-09-28T10:39:03.7219535Z text=- Snapshot: `sha256:0e51951fbff418a8e2ed1bdf6e44649166b942ac7c625dbb210ce8b353044d2c`
LOG job=gate ts=2026-09-28T10:39:03.7219923Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=gate ts=2026-09-28T10:39:03.7220345Z text=- Owner: committed `36410834391-1`
LOG job=gate ts=2026-09-28T10:39:03.7220750Z text=- Caps: daily `2` of `50`, author `1` of `2`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36410834391 1 publish | grep -E 'text=(policy |evidence commit |freshness |- )'
LOG job=publish ts=2026-09-28T10:39:27.4709997Z text=policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=publish ts=2026-09-28T10:39:27.4711812Z text=evidence commit 9e54a5140f1440cf901cbb7cceb1fd8f4d546390 rebuilds 0
LOG job=publish ts=2026-09-28T10:39:27.4712569Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T10:39:27.4713140Z text=freshness listing ok
LOG job=publish ts=2026-09-28T10:39:27.4713674Z text=freshness current
LOG job=publish ts=2026-09-28T10:39:27.4852165Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `32`
LOG job=publish ts=2026-09-28T10:39:27.4852926Z text=- Run: `36410834391-1`
LOG job=publish ts=2026-09-28T10:39:27.4853536Z text=- Status: `inconclusive`
LOG job=publish ts=2026-09-28T10:39:27.4854950Z text=- Snapshot: `sha256:0e51951fbff418a8e2ed1bdf6e44649166b942ac7c625dbb210ce8b353044d2c`
LOG job=publish ts=2026-09-28T10:39:27.4856464Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=publish ts=2026-09-28T10:39:27.4859312Z text=- Evidence: commit `9e54a5140f1440cf901cbb7cceb1fd8f4d546390` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-32/36410834391-1`
LOG job=publish ts=2026-09-28T10:39:27.4860801Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T10:39:27.4861341Z text=- Ownership artifact retention: `90` days
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 32
RECORD run=36410834391-1 kind=outcome outcome=inconclusive run_id=36410834391 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:0e51951fbff418a8e2ed1bdf6e44649166b942ac7c625dbb210ce8b353044d2c findings=submission.policy-change,submission.trusted-path-change
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=pr-32 runs=1 supersessions=0
```

```text
$ bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-public scenario-s09-fork "scenario: S09 change the wrapper and the policy" scenarios/fixtures/pull-requests/steward-pr-modified.yml:.github/workflows/steward-pr.yml scenarios/fixtures/policies/caps-daily.yml:.github/patch-steward/policy.yml
DEPLOY repo=jambolo/patch-steward-testbed-public branch=scenario-s09-fork existed=no
DEPLOY commit=ba1d0db651485288926b737ed17b9ed77de345f7 message=scenario: S09 change the wrapper and the policy
DEPLOY push=ok attempt=1 head=ba1d0db651485288926b737ed17b9ed77de345f7
DEPLOY identical dest=.github/workflows/steward-pr.yml blob=85fe99a69b4a731fd2bcc4f8e3abf59cad747d30
DEPLOY identical dest=.github/patch-steward/policy.yml blob=756c706810fa43e1c6eab4a654b405130441be70
$ gh api "repos/jambolo/patch-steward-testbed-public/contents/.github?ref=scenario-s09-fork" --jq '.[] | select(.name=="patch-steward") | .sha'
b1916b8f26073a908208c9e5afa66fdd067f68a8
$ gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head jambolo:scenario-s09-fork --title "[scenario S09] fork pull request changing the wrapper and the policy" --body-file fixtures/submissions/pr-chore.txt
https://github.com/steady-orchard/patch-steward-testbed-public/pull/33
```

```text
$ gh api repos/steady-orchard/patch-steward-testbed-public/actions/runs/36411709793 --jq '[.name, .path, .event, .display_title] | join(" | ")'
steward pr 33 author 2095171 event pull_request_target opened sender 2095171 User | .github/workflows/steward-pr.yml | pull_request_target | steward pr 33 author 2095171 event pull_request_target opened sender 2095171 User
$ gh run view 36411709793 -R steady-orchard/patch-steward-testbed-public --json workflowName --jq .workflowName
steward-pr
$ gh run view 36411709793 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36411709793 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |- )'
LOG job=gate ts=2026-09-28T10:47:16.3640155Z text=event pull_request_target opened pr 33 sender User
LOG job=gate ts=2026-09-28T10:47:16.3641283Z text=policy trusted-branch revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=gate ts=2026-09-28T10:47:16.3641971Z text=listing none
LOG job=gate ts=2026-09-28T10:47:16.3642480Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T10:47:16.3643069Z text=caps within daily 3 of 50 author 1 of 2
LOG job=gate ts=2026-09-28T10:47:16.3643668Z text=disposition runnable
LOG job=gate ts=2026-09-28T10:47:16.3816189Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `33`
LOG job=gate ts=2026-09-28T10:47:16.3821384Z text=- Run: `36411709793-1`
LOG job=gate ts=2026-09-28T10:47:16.3822074Z text=- Status: `runnable`
LOG job=gate ts=2026-09-28T10:47:16.3822832Z text=- Snapshot: `sha256:a7eb7bbc45572b55267ebf6be33e079409ccc65c1f3a1992e4bc20cf18d6cad1`
LOG job=gate ts=2026-09-28T10:47:16.3823717Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=gate ts=2026-09-28T10:47:16.3824364Z text=- Owner: committed `36411709793-1`
LOG job=gate ts=2026-09-28T10:47:16.3824958Z text=- Caps: daily `3` of `50`, author `1` of `2`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36411709793 1 publish | grep -E 'text=(policy |evidence commit |freshness |- )'
LOG job=publish ts=2026-09-28T10:47:38.7897177Z text=policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=publish ts=2026-09-28T10:47:38.7899263Z text=evidence commit 2a6121dbdd6b2e074bb9637f0a275c3c9f5e602d rebuilds 0
LOG job=publish ts=2026-09-28T10:47:38.7899986Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T10:47:38.7900475Z text=freshness listing ok
LOG job=publish ts=2026-09-28T10:47:38.7900929Z text=freshness current
LOG job=publish ts=2026-09-28T10:47:38.8053476Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `33`
LOG job=publish ts=2026-09-28T10:47:38.8054481Z text=- Run: `36411709793-1`
LOG job=publish ts=2026-09-28T10:47:38.8055120Z text=- Status: `inconclusive`
LOG job=publish ts=2026-09-28T10:47:38.8056319Z text=- Snapshot: `sha256:a7eb7bbc45572b55267ebf6be33e079409ccc65c1f3a1992e4bc20cf18d6cad1`
LOG job=publish ts=2026-09-28T10:47:38.8057754Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=publish ts=2026-09-28T10:47:38.8060291Z text=- Evidence: commit `2a6121dbdd6b2e074bb9637f0a275c3c9f5e602d` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-33/36411709793-1`
LOG job=publish ts=2026-09-28T10:47:38.8061436Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T10:47:38.8061860Z text=- Ownership artifact retention: `90` days
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 33
RECORD run=36411709793-1 kind=outcome outcome=inconclusive run_id=36411709793 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:a7eb7bbc45572b55267ebf6be33e079409ccc65c1f3a1992e4bc20cf18d6cad1 findings=submission.policy-change,submission.trusted-path-change
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=pr-33 runs=1 supersessions=0
```

```text
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 33
EVIDENCE append_only=yes
EVIDENCE run=36411709793-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=pr-33 runs=1 verified=1 result=ok
```

Result: pass
