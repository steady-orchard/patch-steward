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

## S01 unstructured pull request

Date (UTC): 2026-09-28. Opened an unstructured pull request whose body follows no pull request template against
`steady-orchard/patch-steward-testbed-public`: https://github.com/steady-orchard/patch-steward-testbed-public/pull/34.
Run: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36412442107.

```text
$ bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s01-head "scenario: S01 pull request change" scenarios/fixtures/submissions/unstructured.txt:scenario-s01.txt
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=scenario-s01-head existed=no
DEPLOY commit=1c00bc2cbcac33be01a05a5c63302e7467d600ac message=scenario: S01 pull request change
DEPLOY push=ok attempt=1 head=1c00bc2cbcac33be01a05a5c63302e7467d600ac
DEPLOY identical dest=scenario-s01.txt blob=416033bb79d1631d231a6d86791ea321223f1a5c
```

```text
$ A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
A=36411709793
$ gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s01-head --title "[scenario S01] unstructured pull request" --body-file scenarios/fixtures/submissions/unstructured.txt
https://github.com/steady-orchard/patch-steward-testbed-public/pull/34
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target opened sender 2095171 User" 36411709793 1
RUN id=36412442107 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T10:54:17Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36412442107 title=steward pr 34 author 2095171 event pull_request_target opened sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36411709793 count=1 completed=1 result=complete
```

```text
$ gh run view 36412442107 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36412442107 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
LOG job=gate ts=2026-09-28T10:54:53.9599979Z text=event pull_request_target opened pr 34 sender User
LOG job=gate ts=2026-09-28T10:54:53.9601049Z text=policy trusted-branch revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=gate ts=2026-09-28T10:54:53.9601776Z text=listing none
LOG job=gate ts=2026-09-28T10:54:53.9602283Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T10:54:53.9602834Z text=disposition early-exit
LOG job=gate ts=2026-09-28T10:54:53.9733413Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=gate ts=2026-09-28T10:54:53.9735045Z text=- Run: `36412442107-1`
LOG job=gate ts=2026-09-28T10:54:53.9736591Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T10:54:53.9737493Z text=- Snapshot: `sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1`
LOG job=gate ts=2026-09-28T10:54:53.9738447Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=gate ts=2026-09-28T10:54:53.9739213Z text=- Owner: committed `36412442107-1`
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36412442107 1 publish | grep -E 'text=(policy |ownership |evidence commit |freshness |steward job summary:|- )'
LOG job=publish ts=2026-09-28T10:55:16.0895393Z text=policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=publish ts=2026-09-28T10:55:16.0896370Z text=ownership retention 90 days
LOG job=publish ts=2026-09-28T10:55:16.0897150Z text=evidence commit 214529eff25d9a5c82c307add55c281cbe05ae61 rebuilds 0
LOG job=publish ts=2026-09-28T10:55:16.0897863Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T10:55:16.0898797Z text=freshness listing ok
LOG job=publish ts=2026-09-28T10:55:16.0899299Z text=freshness current
LOG job=publish ts=2026-09-28T10:55:16.1029961Z text=steward job summary:
LOG job=publish ts=2026-09-28T10:55:16.1036872Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=publish ts=2026-09-28T10:55:16.1037990Z text=- Run: `36412442107-1`
LOG job=publish ts=2026-09-28T10:55:16.1040941Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T10:55:16.1041756Z text=- Snapshot: `sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1`
LOG job=publish ts=2026-09-28T10:55:16.1042583Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=publish ts=2026-09-28T10:55:16.1044235Z text=- Evidence: commit `214529eff25d9a5c82c307add55c281cbe05ae61` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-34/36412442107-1`
LOG job=publish ts=2026-09-28T10:55:16.1045469Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T10:55:16.1045939Z text=- Ownership artifact retention: `90` days
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34
ARTIFACT id=10964952587 name=steward-ownership-pr-34 created_at=2026-09-28T10:54:56Z expires_at=2026-12-27T10:54:17Z expired=false run_id=36412442107 size=536
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=1 unexpired=1
```

```text
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34
RECORD run=36412442107-1 kind=outcome outcome=needs-changes run_id=36412442107 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1 findings=submission.unstructured
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=1 supersessions=0
```

Result: pass

## S02 title-only edit keeps the owner

Date (UTC): 2026-09-28. Edited only the title of pull request 34; the owner from the S01 run was kept and nothing was
committed: https://github.com/steady-orchard/patch-steward-testbed-public/pull/34.
Run: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36412957123.

```text
$ A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
A=36412442107
$ gh pr edit 34 -R steady-orchard/patch-steward-testbed-public --title "[scenario S01] unstructured pull request (title edited by the author)"
https://github.com/steady-orchard/patch-steward-testbed-public/pull/34
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User" 36412442107 1
RUN id=36412957123 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T10:59:33Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36412957123 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36412442107 count=1 completed=1 result=complete
```

```text
$ gh run view 36412957123 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=skipped
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36412957123 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
LOG job=gate ts=2026-09-28T11:00:13.0218093Z text=event pull_request_target edited pr 34 sender User
LOG job=gate ts=2026-09-28T11:00:13.0219858Z text=policy trusted-branch revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=gate ts=2026-09-28T11:00:13.0220692Z text=listing unique owner 36412442107-1
LOG job=gate ts=2026-09-28T11:00:13.0221358Z text=dedup duplicate owner-unchanged owner 36412442107-1
LOG job=gate ts=2026-09-28T11:00:13.0312431Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=gate ts=2026-09-28T11:00:13.0313576Z text=- Run: `36412957123-1`
LOG job=gate ts=2026-09-28T11:00:13.0314249Z text=- Status: `duplicate`
LOG job=gate ts=2026-09-28T11:00:13.0315127Z text=- Snapshot: `sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1`
LOG job=gate ts=2026-09-28T11:00:13.0315995Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=gate ts=2026-09-28T11:00:13.0316674Z text=- Owner: kept `36412442107-1`
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34
ARTIFACT id=10964952587 name=steward-ownership-pr-34 created_at=2026-09-28T10:54:56Z expires_at=2026-12-27T10:54:17Z expired=false run_id=36412442107 size=536
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=1 unexpired=1
```

```text
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34
RECORD run=36412442107-1 kind=outcome outcome=needs-changes run_id=36412442107 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1 findings=submission.unstructured
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=1 supersessions=0
```

Result: pass

## S03 title edit by the test App keeps the owner

Date (UTC): 2026-09-28. The test App edited the title of pull request 34 (event sender the App's bot user); the owner
from the S01 run was kept and nothing was committed: https://github.com/steady-orchard/patch-steward-testbed-public/pull/34.
Run: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36413617643.

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34
ARTIFACT id=10964952587 name=steward-ownership-pr-34 created_at=2026-09-28T10:54:56Z expires_at=2026-12-27T10:54:17Z expired=false run_id=36412442107 size=536
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=1 unexpired=1
```

```text
$ A=$(gh api "repos/steady-orchard/patch-steward-testbed-public/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
A=36412957123
```

```text
$ bash scenarios/tools/app-edit.sh steady-orchard/patch-steward-testbed-public pr 34 title "[scenario S01] unstructured pull request (title edited by the test App)"
DISPATCH run_id=36413596940 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36413596940
APP-EDIT log=app-edit installation status=200
APP-EDIT log=app-edit token status=201
APP-EDIT log=app-edit title status=200
APP-EDIT log=app-edit revoke status=204
APP-EDIT repo=steady-orchard/patch-steward-testbed-public kind=pr number=34 operation=title run=36413596940 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36413596940 result=ok
```

```text
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target edited sender 331019482 Bot" 36412957123 1
RUN id=36413617643 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T11:06:08Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36413617643 title=steward pr 34 author 2095171 event pull_request_target edited sender 331019482 Bot
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36412957123 count=1 completed=1 result=complete
```

```text
$ gh run view 36413617643 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=skipped
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36413617643 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
LOG job=gate ts=2026-09-28T11:06:41.8477261Z text=event pull_request_target edited pr 34 sender Bot
LOG job=gate ts=2026-09-28T11:06:41.8478341Z text=policy trusted-branch revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=gate ts=2026-09-28T11:06:41.8479070Z text=listing unique owner 36412442107-1
LOG job=gate ts=2026-09-28T11:06:41.8479724Z text=dedup duplicate owner-unchanged owner 36412442107-1
LOG job=gate ts=2026-09-28T11:06:41.8612518Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=gate ts=2026-09-28T11:06:41.8614089Z text=- Run: `36413617643-1`
LOG job=gate ts=2026-09-28T11:06:41.8614819Z text=- Status: `duplicate`
LOG job=gate ts=2026-09-28T11:06:41.8615910Z text=- Snapshot: `sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1`
LOG job=gate ts=2026-09-28T11:06:41.8617236Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=gate ts=2026-09-28T11:06:41.8617977Z text=- Owner: kept `36412442107-1`
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34
ARTIFACT id=10964952587 name=steward-ownership-pr-34 created_at=2026-09-28T10:54:56Z expires_at=2026-12-27T10:54:17Z expired=false run_id=36412442107 size=536
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=1 unexpired=1
```

```text
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34
RECORD run=36412442107-1 kind=outcome outcome=needs-changes run_id=36412442107 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1 findings=submission.unstructured
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=1 supersessions=0
```

Result: pass

## S04 body edit commits a new owner and supersedes the older run

Date (UTC): 2026-09-28. Tries 1 to 3 (older and newer runs 36414063591 and 36414211101, 36414463707 and 36414579082, 36414810059 and 36414986082) waited for the older run's gate by polling the run list, made the second edit after the older run had already published, and produced no overlap; try 4 (D 45 s) on pull request https://github.com/steady-orchard/patch-steward-testbed-public/pull/34 committed a new owner and superseded the older run, so tries 5 and 6 were not needed. Run URLs: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36416155582 (older) and https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36416239795 (newer).

```text
$ R=steady-orchard/patch-steward-testbed-public; P=34; T=4; D=45; BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; A=$(gh api "repos/$R/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"; gh pr edit "$P" -R "$R" --body "$(printf '%s\n\nScenario body edit: S04 try %s, first edit.\n' "$BASE" "$T")" > /dev/null && echo "edit1 utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; sleep "$D"; gh pr edit "$P" -R "$R" --body "$(printf '%s\n\nScenario body edit: S04 try %s, second edit.\n' "$BASE" "$T")" > /dev/null && echo "edit2 utc=$(date -u +%Y-%m-%dT%H:%M:%SZ) delay=$D after=$A"
A=36414986082
edit1 utc=2026-09-28T11:31:33Z
edit2 utc=2026-09-28T11:32:20Z delay=45 after=36414986082
```

```text
$ PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User" 36414986082 2
RUN id=36416155582 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T11:31:38Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36416155582 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
RUN id=36416239795 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T11:32:24Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36416239795 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36414986082 count=2 completed=2 result=complete
```

```text
$ R=steady-orchard/patch-steward-testbed-public; OLD=36416155582; NEW=36416239795; P=34; g1=$(bash scenarios/tools/run-log.sh $R $OLD 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); g2=$(bash scenarios/tools/run-log.sh $R $NEW 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); p1=$(bash scenarios/tools/run-log.sh $R $OLD 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness superseded (newer-owner [0-9]+-[0-9]+|snapshot-changed)|- Status: `superseded`)$'); p2=$(bash scenarios/tools/run-log.sh $R $NEW 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness current|- Status: `needs-changes`)$'); s=$(bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^SUPERSESSION file=$OLD-1.json run=$OLD-1 reason="); echo "S04 check old=$OLD new=$NEW gate_commits=$g1$g2 old_superseded=$p1 new_current=$p2 supersession_records=$s"; [ "$g1$g2$p1$p2$s" = "11221" ] && echo "S04 pass" || echo "S04 not met"
S04 check old=36416155582 new=36416239795 gate_commits=11 old_superseded=2 new_current=2 supersession_records=1
S04 pass
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36416155582 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T11:32:13.5271399Z text=listing unique owner 36414986082-1
LOG job=gate ts=2026-09-28T11:32:13.5272405Z text=dedup commit snapshot-changed
LOG job=gate ts=2026-09-28T11:32:13.5273195Z text=disposition early-exit
LOG job=gate ts=2026-09-28T11:32:13.5431767Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T11:32:13.5435329Z text=- Owner: committed `36416155582-1`
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36416239795 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T11:33:56.1924772Z text=listing unique owner 36416155582-1
LOG job=gate ts=2026-09-28T11:33:56.1925453Z text=dedup commit snapshot-changed
LOG job=gate ts=2026-09-28T11:33:56.1926078Z text=disposition early-exit
LOG job=gate ts=2026-09-28T11:33:56.2061909Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T11:33:56.2065592Z text=- Owner: committed `36416239795-1`
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36416155582 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence|- Freshness)'
LOG job=publish ts=2026-09-28T11:32:45.5684513Z text=evidence commit ac2b86e55c980ad1433c0b4c15b5aa2a8ef73e8d rebuilds 0
LOG job=publish ts=2026-09-28T11:32:45.5685141Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T11:32:45.5685587Z text=freshness listing ok
LOG job=publish ts=2026-09-28T11:32:45.5686092Z text=freshness superseded snapshot-changed
LOG job=publish ts=2026-09-28T11:32:45.5813010Z text=- Status: `superseded`
LOG job=publish ts=2026-09-28T11:32:45.5816248Z text=- Evidence: commit `ac2b86e55c980ad1433c0b4c15b5aa2a8ef73e8d` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-34/36416155582-1`
LOG job=publish ts=2026-09-28T11:32:45.5817189Z text=- Freshness: `superseded` (`snapshot-changed`)
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36416239795 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence|- Freshness)'
LOG job=publish ts=2026-09-28T11:34:30.5319420Z text=evidence commit b5d11cdbe2bf5c4176e1b543a83d133537b4450e rebuilds 0
LOG job=publish ts=2026-09-28T11:34:30.5320116Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T11:34:30.5320639Z text=freshness listing ok
LOG job=publish ts=2026-09-28T11:34:30.5321504Z text=freshness current
LOG job=publish ts=2026-09-28T11:34:30.5497173Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T11:34:30.5501346Z text=- Evidence: commit `b5d11cdbe2bf5c4176e1b543a83d133537b4450e` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-34/36416239795-1`
LOG job=publish ts=2026-09-28T11:34:30.5502506Z text=- Freshness: `current`
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34
ARTIFACT id=10964952587 name=steward-ownership-pr-34 created_at=2026-09-28T10:54:56Z expires_at=2026-12-27T10:54:17Z expired=false run_id=36412442107 size=536
ARTIFACT id=10966526873 name=steward-ownership-pr-34 created_at=2026-09-28T11:11:09Z expires_at=2026-12-27T11:10:31Z expired=false run_id=36414063591 size=535
ARTIFACT id=10966971918 name=steward-ownership-pr-34 created_at=2026-09-28T11:12:27Z expires_at=2026-12-27T11:11:59Z expired=false run_id=36414211101 size=534
ARTIFACT id=10966507675 name=steward-ownership-pr-34 created_at=2026-09-28T11:14:57Z expires_at=2026-12-27T11:14:25Z expired=false run_id=36414463707 size=538
ARTIFACT id=10967057695 name=steward-ownership-pr-34 created_at=2026-09-28T11:16:08Z expires_at=2026-12-27T11:15:31Z expired=false run_id=36414579082 size=538
ARTIFACT id=10966453372 name=steward-ownership-pr-34 created_at=2026-09-28T11:18:29Z expires_at=2026-12-27T11:17:50Z expired=false run_id=36414810059 size=537
ARTIFACT id=10966558634 name=steward-ownership-pr-34 created_at=2026-09-28T11:20:12Z expires_at=2026-12-27T11:19:39Z expired=false run_id=36414986082 size=538
ARTIFACT id=10967140629 name=steward-ownership-pr-34 created_at=2026-09-28T11:32:15Z expires_at=2026-12-27T11:31:38Z expired=false run_id=36416155582 size=535
ARTIFACT id=10967320747 name=steward-ownership-pr-34 created_at=2026-09-28T11:33:57Z expires_at=2026-12-27T11:32:24Z expired=false run_id=36416239795 size=537
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=9 unexpired=9
```

```text
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34
RECORD run=36416155582-1 kind=outcome outcome=needs-changes run_id=36416155582 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:0a3b9a99277166abbe81a99b65cd46258bd94aac08258881a15435501413db01 findings=submission.unstructured
RECORD run=36416239795-1 kind=outcome outcome=needs-changes run_id=36416239795 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:7a447cf2faf52026ae336bdf57be1b04f586922dda42517bc50e5add8e2a3230 findings=submission.unstructured
SUPERSESSION file=36416155582-1.json run=36416155582-1 reason=snapshot-changed successor=null successor_created_at=null recorded_snapshot=sha256:0a3b9a99277166abbe81a99b65cd46258bd94aac08258881a15435501413db01 live_snapshot=sha256:7a447cf2faf52026ae336bdf57be1b04f586922dda42517bc50e5add8e2a3230
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=9 supersessions=1
```

```text
$ bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36416155582-1
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36416155582-1.json kind=state-transition subject=run from=null to=screening
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36416155582-1.json kind=latency subject=run
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36416155582-1.json kind=latency subject=run
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36416155582-1.json kind=cost subject=run
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36416155582-1.json kind=state-transition subject=run from=screening to=needs-changes
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36416155582-1-supersession.json kind=state-transition subject=run from=needs-changes to=superseded
METRICS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public run=36416155582-1 files=2 events=6
```

```text
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34
EVIDENCE append_only=yes
EVIDENCE run=36416155582-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36416239795-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE supersession=36416155582-1.json
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=9 verified=9 result=ok
```

Result: pass

## S08 evidence is written before the job summary

Date (UTC): 2026-09-28. For the S01 run and the S04 newer run, the publish job log shows the evidence commit written and read back before the job summary that names it; the commit's committer date is not later than the summary timestamp. Run URLs: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36412442107 and https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36416239795.

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36412442107 1 publish | grep -E 'text=(evidence commit |freshness |steward job summary:|- )'
LOG job=publish ts=2026-09-28T10:55:16.0897150Z text=evidence commit 214529eff25d9a5c82c307add55c281cbe05ae61 rebuilds 0
LOG job=publish ts=2026-09-28T10:55:16.0897863Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T10:55:16.0898797Z text=freshness listing ok
LOG job=publish ts=2026-09-28T10:55:16.0899299Z text=freshness current
LOG job=publish ts=2026-09-28T10:55:16.1029961Z text=steward job summary:
LOG job=publish ts=2026-09-28T10:55:16.1036872Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=publish ts=2026-09-28T10:55:16.1037990Z text=- Run: `36412442107-1`
LOG job=publish ts=2026-09-28T10:55:16.1040941Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T10:55:16.1041756Z text=- Snapshot: `sha256:42947737e5cd63d5d6451df8952195498eab7d2d9f795b90b9cbfe7ad8bba4c1`
LOG job=publish ts=2026-09-28T10:55:16.1042583Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=publish ts=2026-09-28T10:55:16.1044235Z text=- Evidence: commit `214529eff25d9a5c82c307add55c281cbe05ae61` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-34/36412442107-1`
LOG job=publish ts=2026-09-28T10:55:16.1045469Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T10:55:16.1045939Z text=- Ownership artifact retention: `90` days
```

```text
$ gh api repos/steady-orchard/patch-steward-testbed-public/git/commits/214529eff25d9a5c82c307add55c281cbe05ae61 --jq '.committer.date'
2026-09-28T10:55:11Z
```

```text
$ R=steady-orchard/patch-steward-testbed-public; run=36412442107; c=214529eff25d9a5c82c307add55c281cbe05ae61; d=$(gh api repos/$R/git/commits/$c --jq .committer.date); bash scenarios/tools/run-log.sh $R $run 1 publish | node -e '...'
S08 run=36412442107 commit=214529eff25d9a5c82c307add55c281cbe05ae61 committed_at=2026-09-28T10:55:11Z summary_at=2026-09-28T10:55:16.1029961Z order=ok
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36416239795 1 publish | grep -E 'text=(evidence commit |freshness |steward job summary:|- )'
LOG job=publish ts=2026-09-28T11:34:30.5319420Z text=evidence commit b5d11cdbe2bf5c4176e1b543a83d133537b4450e rebuilds 0
LOG job=publish ts=2026-09-28T11:34:30.5320116Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T11:34:30.5320639Z text=freshness listing ok
LOG job=publish ts=2026-09-28T11:34:30.5321504Z text=freshness current
LOG job=publish ts=2026-09-28T11:34:30.5488481Z text=steward job summary:
LOG job=publish ts=2026-09-28T11:34:30.5495728Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=publish ts=2026-09-28T11:34:30.5496619Z text=- Run: `36416239795-1`
LOG job=publish ts=2026-09-28T11:34:30.5497173Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T11:34:30.5497889Z text=- Snapshot: `sha256:7a447cf2faf52026ae336bdf57be1b04f586922dda42517bc50e5add8e2a3230`
LOG job=publish ts=2026-09-28T11:34:30.5499134Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=publish ts=2026-09-28T11:34:30.5501346Z text=- Evidence: commit `b5d11cdbe2bf5c4176e1b543a83d133537b4450e` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-34/36416239795-1`
LOG job=publish ts=2026-09-28T11:34:30.5502506Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T11:34:30.5502938Z text=- Ownership artifact retention: `90` days
```

```text
$ gh api repos/steady-orchard/patch-steward-testbed-public/git/commits/b5d11cdbe2bf5c4176e1b543a83d133537b4450e --jq '.committer.date'
2026-09-28T11:34:24Z
```

```text
$ R=steady-orchard/patch-steward-testbed-public; run=36416239795; c=b5d11cdbe2bf5c4176e1b543a83d133537b4450e; d=$(gh api repos/$R/git/commits/$c --jq .committer.date); bash scenarios/tools/run-log.sh $R $run 1 publish | node -e '...'
S08 run=36416239795 commit=b5d11cdbe2bf5c4176e1b543a83d133537b4450e committed_at=2026-09-28T11:34:24Z summary_at=2026-09-28T11:34:30.5488481Z order=ok
```

Result: pass

## S05 concurrent body edits: only the newest owner publishes

Date (UTC): 2026-09-28. Try 1 of 3 passed on the first attempt: three quick body edits of pull request
https://github.com/steady-orchard/patch-steward-testbed-public/pull/34 started three runs; the newest ownership
artifact's run published `freshness current` and the older committed run was superseded, while the third run deduplicated.
Runs: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36417410111,
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36417413257,
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36417416630.

```text
$ R=steady-orchard/patch-steward-testbed-public; P=34; T=1; BASE="$(tr -d '\r' < scenarios/fixtures/submissions/unstructured.txt)"; A=$(gh api "repos/$R/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"; for E in 1 2 3; do gh pr edit "$P" -R "$R" --body "..." > /dev/null && echo "edit$E utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"; done
A=36416239795
edit1 utc=2026-09-28T11:43:58Z
edit2 utc=2026-09-28T11:44:00Z
edit3 utc=2026-09-28T11:44:01Z
```

```text
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User" 36416239795 3
RUN id=36417410111 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T11:44:01Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36417410111 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
RUN id=36417413257 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T11:44:03Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36417413257 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
RUN id=36417416630 attempt=1 event=pull_request_target status=completed conclusion=success created_at=2026-09-28T11:44:05Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36417416630 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36416239795 count=3 completed=3 result=complete
```

```text
$ node -e '...' (S05 check script) => S05 check runs=36417410111,36417413257,36417416630 committed=36417410111,36417413257 duplicates=36417416630 newest_owner=36417413257 tie=false current=36417413257 superseded=36417410111 cancelled=
S05 pass
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36417410111 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T11:44:33.7563591Z text=listing unique owner 36416239795-1
LOG job=gate ts=2026-09-28T11:44:33.7563999Z text=dedup commit snapshot-changed
LOG job=gate ts=2026-09-28T11:44:33.7564553Z text=disposition early-exit
LOG job=gate ts=2026-09-28T11:44:33.7699622Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T11:44:33.7701397Z text=- Owner: committed `36417410111-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36417410111 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Freshness|- Failure)'
LOG job=publish ts=2026-09-28T11:45:02.4863263Z text=evidence commit 046f5905ff2fae4b85cabd623e7c65358f66b4ae rebuilds 0
LOG job=publish ts=2026-09-28T11:45:02.4863624Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T11:45:02.4863864Z text=freshness listing ok
LOG job=publish ts=2026-09-28T11:45:02.4864140Z text=freshness superseded newer-owner 36417413257-1
LOG job=publish ts=2026-09-28T11:45:02.4996289Z text=- Status: `superseded`
LOG job=publish ts=2026-09-28T11:45:02.5003179Z text=- Freshness: `superseded` (`newer-owner`)
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36417413257 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T11:44:34.6230074Z text=listing unique owner 36416239795-1
LOG job=gate ts=2026-09-28T11:44:34.6230654Z text=dedup commit snapshot-changed
LOG job=gate ts=2026-09-28T11:44:34.6231158Z text=disposition early-exit
LOG job=gate ts=2026-09-28T11:44:34.6387623Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T11:44:34.6390781Z text=- Owner: committed `36417413257-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36417413257 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Freshness|- Failure)'
LOG job=publish ts=2026-09-28T11:45:19.7421343Z text=evidence commit da5cf11f9562449557b0b458c0ecb15537bc5e94 rebuilds 0
LOG job=publish ts=2026-09-28T11:45:19.7422297Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T11:45:19.7423216Z text=freshness listing ok
LOG job=publish ts=2026-09-28T11:45:19.7423832Z text=freshness current
LOG job=publish ts=2026-09-28T11:45:19.7562370Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T11:45:19.7567532Z text=- Freshness: `current`
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36417416630 1 gate | grep -E 'text=(listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T11:44:39.2025530Z text=listing unique owner 36417413257-1
LOG job=gate ts=2026-09-28T11:44:39.2026624Z text=dedup duplicate owner-unchanged owner 36417413257-1
LOG job=gate ts=2026-09-28T11:44:39.2152236Z text=- Status: `duplicate`
LOG job=gate ts=2026-09-28T11:44:39.2155040Z text=- Owner: kept `36417413257-1`
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34
ARTIFACT id=10967320747 name=steward-ownership-pr-34 created_at=2026-09-28T11:33:57Z expires_at=2026-12-27T11:32:24Z expired=false run_id=36416239795 size=537
ARTIFACT id=10967968117 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:35Z expires_at=2026-12-27T11:44:02Z expired=false run_id=36417410111 size=535
ARTIFACT id=10967883208 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:36Z expires_at=2026-12-27T11:44:03Z expired=false run_id=36417413257 size=537
```

```text
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34
EVIDENCE store=steady-orchard/patch-steward-testbed-public branch=steward-evidence tip=da5cf11f9562449557b0b458c0ecb15537bc5e94 commits=16
EVIDENCE commit=6f1c3c890f7106aa762a591faff452a2cac35c1d parents=0 added=10 other=0
EVIDENCE commit=9e54a5140f1440cf901cbb7cceb1fd8f4d546390 parents=1 added=11 other=0
EVIDENCE commit=2a6121dbdd6b2e074bb9637f0a275c3c9f5e602d parents=1 added=11 other=0
EVIDENCE commit=214529eff25d9a5c82c307add55c281cbe05ae61 parents=1 added=10 other=0
EVIDENCE commit=7acff9681741e174bc7ebc5799a60815a8d5a704 parents=1 added=10 other=0
EVIDENCE commit=bc8ebb448ff6a90d5576706aea4f16d7d87526b9 parents=1 added=10 other=0
EVIDENCE commit=767fd74ede7d2526f23e18d03f6ea9f64be1b3af parents=1 added=10 other=0
EVIDENCE commit=b721a29825a9958eb19b4ebe66954bb84d20da54 parents=1 added=10 other=0
EVIDENCE commit=d0f7b356b3a8bcc03dcbfc3410e61d328ecd3a7d parents=1 added=10 other=0
EVIDENCE commit=072dc1740b6812752fbf0486ef318af991e3e5c9 parents=1 added=10 other=0
EVIDENCE commit=ac2b86e55c980ad1433c0b4c15b5aa2a8ef73e8d parents=1 added=10 other=0
EVIDENCE commit=2f9a5315634c4b06052569e3f4155ce8c6ba549d parents=1 added=2 other=0
EVIDENCE commit=b5d11cdbe2bf5c4176e1b543a83d133537b4450e parents=1 added=10 other=0
EVIDENCE commit=046f5905ff2fae4b85cabd623e7c65358f66b4ae parents=1 added=10 other=0
EVIDENCE commit=946c4ba918321150008093aa423f1cc1f9839c5e parents=1 added=2 other=0
EVIDENCE commit=da5cf11f9562449557b0b458c0ecb15537bc5e94 parents=1 added=10 other=0
EVIDENCE append_only=yes
EVIDENCE run=36412442107-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36414063591-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36414211101-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36414463707-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36414579082-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36414810059-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36414986082-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36416155582-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36416239795-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36417410111-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36417413257-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE supersession=36416155582-1.json
EVIDENCE supersession=36417410111-1.json
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=pr-34 runs=11 verified=11 result=ok
```

Result: pass

## S06 invalid policy: the gate fails before commitment

Date (UTC): 2026-09-28. With an invalid policy (daily run cap 1001, above the hard bound 1000) deployed to master, a body edit of pull request
https://github.com/steady-orchard/patch-steward-testbed-public/pull/34 produced a run whose
gate job failed before any listing, dedup, or disposition step; the ownership artifact
listing for the pull request was unchanged and no evidence record was written for that run.
Run: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36418122598.

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34   # before
ARTIFACT id=10967968117 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:35Z expires_at=2026-12-27T11:44:02Z expired=false run_id=36417410111 size=535
ARTIFACT id=10967883208 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:36Z expires_at=2026-12-27T11:44:03Z expired=false run_id=36417413257 size=537
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=11 unexpired=11
```

```text
$ bash scenarios/tools/deploy-steward.sh org-public scenarios/fixtures/policies/invalid-limit.yml
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/invalid-limit.yml result=ok
```

```text
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
e1ecb71a2a3209a9d2121a4b45c640f4e33f822c
```

```text
$ gh pr edit 34 -R steady-orchard/patch-steward-testbed-public --body "..." > /dev/null && echo "edit utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
edit utc=2026-09-28T11:51:01Z
```

```text
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User" 36417416630 1
RUN id=36418122598 attempt=1 event=pull_request_target status=completed conclusion=failure created_at=2026-09-28T11:51:03Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36418122598 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36417416630 count=1 completed=1 result=complete
```

```text
$ gh run view 36418122598 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=failure,screen / publish=skipped
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36418122598 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |steward job summary:|- )'
LOG job=gate ts=2026-09-28T11:51:36.0015204Z text=event pull_request_target edited pr 34 sender User
LOG job=gate ts=2026-09-28T11:51:36.0236389Z text=steward job summary:
LOG job=gate ts=2026-09-28T11:51:36.0237849Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=gate ts=2026-09-28T11:51:36.0238608Z text=- Run: `36418122598-1`
LOG job=gate ts=2026-09-28T11:51:36.0239123Z text=- Status: `failed`
LOG job=gate ts=2026-09-28T11:51:36.0239766Z text=- Failure: `gate.policy-invalid`
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34   # after
ARTIFACT id=10967968117 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:35Z expires_at=2026-12-27T11:44:02Z expired=false run_id=36417410111 size=535
ARTIFACT id=10967883208 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:36Z expires_at=2026-12-27T11:44:03Z expired=false run_id=36417413257 size=537
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=11 unexpired=11
$ diff before.txt after.txt && echo "listing unchanged"
listing unchanged
```

```text
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34 | grep -c "^RECORD run=36418122598-1 "
0
```

```text
$ bash scenarios/tools/deploy-steward.sh org-public
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/orphan-branch.yml result=ok
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
d997b1e362c75af03942da0e7a1e8902ca5dbe51
```

Result: pass

## S07 unwritable evidence store: publish fails and publishes nothing

Date (UTC): 2026-09-28. Edited pull request https://github.com/steady-orchard/patch-steward-testbed-public/pull/34
while the trusted policy's evidence store pointed at a nonexistent repository. Run:
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36418649681.

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34   # before
ARTIFACT id=10967883208 name=steward-ownership-pr-34 created_at=2026-09-28T11:44:36Z expires_at=2026-12-27T11:44:03Z expired=false run_id=36417413257 size=537
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=11 unexpired=11
$ gh api repos/steady-orchard/patch-steward-testbed-unwritable --jq .full_name
{"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}
```

```text
$ bash scenarios/tools/deploy-steward.sh org-public scenarios/fixtures/policies/unwritable-store.yml
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/unwritable-store.yml result=ok
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
8c61cbf35781fed2e85377b91b6facb720f2adaa
```

```text
$ gh pr edit 34 -R steady-orchard/patch-steward-testbed-public --body "..."
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-pr.yml "steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User" 36418122598 1
RUN id=36418649681 attempt=1 event=pull_request_target status=completed conclusion=failure created_at=2026-09-28T11:56:11Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36418649681 title=steward pr 34 author 2095171 event pull_request_target edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-pr.yml after=36418122598 count=1 completed=1 result=complete
```

```text
$ gh run view 36418649681 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=failure
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36418649681 1 gate | grep -E 'text=(event |policy |listing |dedup |disposition |- )'
LOG job=gate ts=2026-09-28T11:56:43.9072753Z text=event pull_request_target edited pr 34 sender User
LOG job=gate ts=2026-09-28T11:56:43.9072753Z text=policy trusted-branch revision 8c61cbf35781fed2e85377b91b6facb720f2adaa
LOG job=gate ts=2026-09-28T11:56:43.9073840Z text=listing unique owner 36417413257-1
LOG job=gate ts=2026-09-28T11:56:43.9074639Z text=dedup commit snapshot-changed
LOG job=gate ts=2026-09-28T11:56:43.9075375Z text=disposition early-exit
LOG job=gate ts=2026-09-28T11:56:43.9237779Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=gate ts=2026-09-28T11:56:43.9239259Z text=- Run: `36418649681-1`
LOG job=gate ts=2026-09-28T11:56:43.9239943Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T11:56:43.9241113Z text=- Snapshot: `sha256:adea3f560a4bbe67724be8821c765ef4e81184cf6bee1eac1b47699dfc64d2ab`
LOG job=gate ts=2026-09-28T11:56:43.9242525Z text=- Policy revision: `8c61cbf35781fed2e85377b91b6facb720f2adaa`
LOG job=gate ts=2026-09-28T11:56:43.9243239Z text=- Owner: committed `36418649681-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36418649681 1 publish | grep -E 'text=(policy |ownership |evidence commit |freshness |steward job summary:|- |##\[error\])'
LOG job=publish ts=2026-09-28T11:56:57.3602192Z text=policy revision 8c61cbf35781fed2e85377b91b6facb720f2adaa
LOG job=publish ts=2026-09-28T11:56:57.3616583Z text=##[error]publish failed github.not-found
LOG job=publish ts=2026-09-28T11:56:57.3701809Z text=steward job summary:
LOG job=publish ts=2026-09-28T11:56:57.3708976Z text=- Submission: `steady-orchard/patch-steward-testbed-public` pull request `34`
LOG job=publish ts=2026-09-28T11:56:57.3709329Z text=- Run: `36418649681-1`
LOG job=publish ts=2026-09-28T11:56:57.3709631Z text=- Status: `failed`
LOG job=publish ts=2026-09-28T11:56:57.3710160Z text=- Snapshot: `sha256:adea3f560a4bbe67724be8821c765ef4e81184cf6bee1eac1b47699dfc64d2ab`
LOG job=publish ts=2026-09-28T11:56:57.3710792Z text=- Policy revision: `8c61cbf35781fed2e85377b91b6facb720f2adaa`
LOG job=publish ts=2026-09-28T11:56:57.3711300Z text=- Failure: `github.not-found`
LOG job=publish ts=2026-09-28T11:56:57.3714431Z text=##[error]Process completed with exit code 1.
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-pr-34   # after
ARTIFACT id=10967768810 name=steward-ownership-pr-34 created_at=2026-09-28T11:56:45Z expires_at=2026-12-27T11:56:11Z expired=false run_id=36418649681 size=533
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-pr-34 count=12 unexpired=12
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 34 | grep -c "^RECORD run=36418649681-1 "
0
```

```text
$ bash scenarios/tools/deploy-steward.sh org-public
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/orphan-branch.yml result=ok
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
d997b1e362c75af03942da0e7a1e8902ca5dbe51
```

Result: pass

## S10 issue: open, title edit, body edit

Date (UTC): 2026-09-28. Opened an unstructured issue on org-public (contract not met), edited only its title (duplicate, owner unchanged), then edited its body (new owner committed); issue https://github.com/steady-orchard/patch-steward-testbed-public/issues/35, runs https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36419197068, https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36419328690, https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36419421470.

```text
$ gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S10] issue lifecycle" --body-file scenarios/fixtures/submissions/unstructured.txt
https://github.com/steady-orchard/patch-steward-testbed-public/issues/35
$ PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 35 author 2095171 event issues opened sender 2095171 User" 36418649681 1
RUN id=36419197068 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:01:39Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36419197068 title=steward issue 35 author 2095171 event issues opened sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36418649681 count=1 completed=1 result=complete
```

```text
$ gh issue edit 35 -R steady-orchard/patch-steward-testbed-public --title "[scenario S10] issue lifecycle (title edited)"
https://github.com/steady-orchard/patch-steward-testbed-public/issues/35
$ PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 35 author 2095171 event issues edited sender 2095171 User" 36419197068 1
RUN id=36419328690 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:02:55Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36419328690 title=steward issue 35 author 2095171 event issues edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36419197068 count=1 completed=1 result=complete
```

```text
$ gh issue edit 35 -R steady-orchard/patch-steward-testbed-public --body "$(printf '%s\n\nScenario body edit: S10.\n' "$BASE")"
https://github.com/steady-orchard/patch-steward-testbed-public/issues/35
$ PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 35 author 2095171 event issues edited sender 2095171 User" 36419328690 1
RUN id=36419421470 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:03:49Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36419421470 title=steward issue 35 author 2095171 event issues edited sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36419328690 count=1 completed=1 result=complete
```

```text
$ gh run view 36419197068 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36419197068 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:02:13.6411188Z text=event issues opened issue 35 sender User
LOG job=gate ts=2026-09-28T12:02:13.6412533Z text=listing none
LOG job=gate ts=2026-09-28T12:02:13.6412981Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:02:13.6413294Z text=disposition early-exit
LOG job=gate ts=2026-09-28T12:02:13.6527906Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T12:02:13.6532226Z text=- Owner: committed `36419197068-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36419197068 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Freshness)'
LOG job=publish ts=2026-09-28T12:02:34.7257162Z text=evidence commit acd9ce3b57277a637f2e979bcf4ad02b1ec1e459 rebuilds 0
LOG job=publish ts=2026-09-28T12:02:34.7257810Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:02:34.7258264Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:02:34.7259179Z text=freshness current
LOG job=publish ts=2026-09-28T12:02:34.7433166Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T12:02:34.7439585Z text=- Freshness: `current`
```

```text
$ gh run view 36419328690 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=skipped
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36419328690 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:03:28.8757078Z text=event issues edited issue 35 sender User
LOG job=gate ts=2026-09-28T12:03:28.8760936Z text=listing unique owner 36419197068-1
LOG job=gate ts=2026-09-28T12:03:28.8761954Z text=dedup duplicate owner-unchanged owner 36419197068-1
LOG job=gate ts=2026-09-28T12:03:28.8849408Z text=- Status: `duplicate`
LOG job=gate ts=2026-09-28T12:03:28.8851869Z text=- Owner: kept `36419197068-1`
```

```text
$ gh run view 36419421470 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36419421470 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:04:18.4217688Z text=event issues edited issue 35 sender User
LOG job=gate ts=2026-09-28T12:04:18.4219629Z text=listing unique owner 36419197068-1
LOG job=gate ts=2026-09-28T12:04:18.4220379Z text=dedup commit snapshot-changed
LOG job=gate ts=2026-09-28T12:04:18.4220917Z text=disposition early-exit
LOG job=gate ts=2026-09-28T12:04:18.4354372Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T12:04:18.4357983Z text=- Owner: committed `36419421470-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36419421470 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Freshness)'
LOG job=publish ts=2026-09-28T12:04:38.8786048Z text=evidence commit 8ec860b8a43696d2a330a6724905c7aef291aced rebuilds 0
LOG job=publish ts=2026-09-28T12:04:38.8786637Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:04:38.8787177Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:04:38.8787667Z text=freshness current
LOG job=publish ts=2026-09-28T12:04:38.8889927Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T12:04:38.8894473Z text=- Freshness: `current`
```

```text
$ bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-issue-35
ARTIFACT id=10967369483 name=steward-ownership-issue-35 created_at=2026-09-28T12:02:15Z expires_at=2026-12-27T12:01:39Z expired=false run_id=36419197068 size=526
ARTIFACT id=10968542140 name=steward-ownership-issue-35 created_at=2026-09-28T12:04:19Z expires_at=2026-12-27T12:03:49Z expired=false run_id=36419421470 size=529
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-issue-35 count=2 unexpired=2
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 35
RECORD run=36419197068-1 kind=outcome outcome=needs-changes run_id=36419197068 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:63159a0ef32616ae2d3df41ea502d0be66f6137f61b3cdcbe29b95d9f2e0edf3 findings=submission.unstructured
RECORD run=36419421470-1 kind=outcome outcome=needs-changes run_id=36419421470 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:2fb97073c26f5050567ed137da8ce458827634d8242852d92ab40cabf87ef411 findings=submission.unstructured
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-35 runs=2 supersessions=0
```

Result: pass

## S10 issue: close by the author, reopen, close by the App

Date (UTC): 2026-09-28. Issue https://github.com/steady-orchard/patch-steward-testbed-public/issues/35 was closed by its
author, reopened, then closed by the test App; run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420190205 (author close), run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420321847 (reopen), run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420497173 (App-edit helper), run
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420516188 (App close).

```text
$ A=36419421470; gh issue close 35 -R steady-orchard/patch-steward-testbed-public
Closed issue steady-orchard/patch-steward-testbed-public#35 ([scenario S10] issue lifecycle (title edited))
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 35 author 2095171 event issues closed sender 2095171 User" 36419421470 1
RUN id=36420190205 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:11:01Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420190205 title=steward issue 35 author 2095171 event issues closed sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36419421470 count=1 completed=1 result=complete
```

```text
$ A=36420190205; gh issue reopen 35 -R steady-orchard/patch-steward-testbed-public
Reopened issue steady-orchard/patch-steward-testbed-public#35 ([scenario S10] issue lifecycle (title edited))
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 35 author 2095171 event issues reopened sender 2095171 User" 36420190205 1
RUN id=36420321847 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:12:14Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420321847 title=steward issue 35 author 2095171 event issues reopened sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36420190205 count=1 completed=1 result=complete
```

```text
$ A=36420321847; bash scenarios/tools/app-edit.sh steady-orchard/patch-steward-testbed-public issue 35 close
APP-EDIT log=app-edit installation status=200
APP-EDIT log=app-edit token status=201
APP-EDIT log=app-edit close status=200
APP-EDIT log=app-edit revoke status=204
APP-EDIT repo=steady-orchard/patch-steward-testbed-public kind=issue number=35 operation=close run=36420497173 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420497173 result=ok
DISPATCH run_id=36420497173 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420497173
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue 35 author 2095171 event issues closed sender 331019482 Bot" 36420321847 1
RUN id=36420516188 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:14:04Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36420516188 title=steward issue 35 author 2095171 event issues closed sender 331019482 Bot
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36420321847 count=1 completed=1 result=complete
```

```text
$ gh run view 36420190205 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36420190205 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:11:39.7591820Z text=event issues closed issue 35 sender User
LOG job=gate ts=2026-09-28T12:11:39.7692056Z text=listing unique owner 36419421470-1
LOG job=gate ts=2026-09-28T12:11:39.7692654Z text=disposition closure resolution closed-by-author
LOG job=gate ts=2026-09-28T12:11:39.7704715Z text=- Status: `closure`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36420190205 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence|- Freshness)'
LOG job=publish ts=2026-09-28T12:11:57.4854657Z text=evidence commit 954f529f3ef0771759918aac3c8e5de741ac45f5 rebuilds 0
LOG job=publish ts=2026-09-28T12:11:57.4867700Z text=- Status: `closure`
LOG job=publish ts=2026-09-28T12:11:57.4870306Z text=- Evidence: commit `954f529f3ef0771759918aac3c8e5de741ac45f5` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/metrics/2026-09/36420190205-1.json`
```

```text
$ gh run view 36420321847 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36420321847 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:12:54.3414391Z text=event issues reopened issue 35 sender User
LOG job=gate ts=2026-09-28T12:12:54.3416934Z text=listing unique owner 36419421470-1
LOG job=gate ts=2026-09-28T12:12:54.3417568Z text=dedup commit reopened
LOG job=gate ts=2026-09-28T12:12:54.3417976Z text=disposition early-exit
LOG job=gate ts=2026-09-28T12:12:54.3550514Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T12:12:54.3553553Z text=- Owner: committed `36420321847-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36420321847 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence|- Freshness)'
LOG job=publish ts=2026-09-28T12:13:22.4754476Z text=evidence commit 65655a344c5b3418f727785b6c9b9a6e71cd9471 rebuilds 0
LOG job=publish ts=2026-09-28T12:13:22.4755714Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:13:22.4756208Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:13:22.4756625Z text=freshness current
LOG job=publish ts=2026-09-28T12:13:22.4913413Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T12:13:22.4917651Z text=- Evidence: commit `65655a344c5b3418f727785b6c9b9a6e71cd9471` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-35/36420321847-1`
LOG job=publish ts=2026-09-28T12:13:22.4918779Z text=- Freshness: `current`
```

```text
$ gh run view 36420516188 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36420516188 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:14:43.0781436Z text=event issues closed issue 35 sender Bot
LOG job=gate ts=2026-09-28T12:14:43.0784950Z text=listing unique owner 36420321847-1
LOG job=gate ts=2026-09-28T12:14:43.0786277Z text=disposition closure resolution closed-by-maintainer
LOG job=gate ts=2026-09-28T12:14:43.0907872Z text=- Status: `closure`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36420516188 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence|- Freshness)'
LOG job=publish ts=2026-09-28T12:15:00.7268864Z text=evidence commit e616191ad61f982e3578a7062951631def0d63f8 rebuilds 0
LOG job=publish ts=2026-09-28T12:15:00.7400581Z text=- Status: `closure`
LOG job=publish ts=2026-09-28T12:15:00.7403661Z text=- Evidence: commit `e616191ad61f982e3578a7062951631def0d63f8` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/metrics/2026-09/36420516188-1.json`
```

```text
$ bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36420190205-1
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36420190205-1.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-author paired_run=36419421470-1 paired_snapshot=sha256:2fb97073c26f5050567ed137da8ce458827634d8242852d92ab40cabf87ef411
METRICS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public run=36420190205-1 files=1 events=1
$ bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36420516188-1
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36420516188-1.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-maintainer paired_run=36420321847-1 paired_snapshot=sha256:2fb97073c26f5050567ed137da8ce458827634d8242852d92ab40cabf87ef411
METRICS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public run=36420516188-1 files=1 events=1
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 35
RECORD run=36419197068-1 kind=outcome outcome=needs-changes run_id=36419197068 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:63159a0ef32616ae2d3df41ea502d0be66f6137f61b3cdcbe29b95d9f2e0edf3 findings=submission.unstructured
RECORD run=36419421470-1 kind=outcome outcome=needs-changes run_id=36419421470 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:2fb97073c26f5050567ed137da8ce458827634d8242852d92ab40cabf87ef411 findings=submission.unstructured
RECORD run=36420321847-1 kind=outcome outcome=needs-changes run_id=36420321847 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:2fb97073c26f5050567ed137da8ce458827634d8242852d92ab40cabf87ef411 findings=submission.unstructured
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-35 runs=3 supersessions=0
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 35
EVIDENCE append_only=yes
EVIDENCE run=36419197068-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36419421470-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36420321847-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-35 runs=3 verified=3 result=ok
$ gh issue view 35 -R steady-orchard/patch-steward-testbed-public --json state --jq .state
CLOSED
```

Result: pass

## S10 pull requests: close by the author, merge into a scenario base

Date (UTC): 2026-09-28. Opened and closed pull request 36 by its author, then opened pull request 37 against
scenario-s10-base and merged it: https://github.com/steady-orchard/patch-steward-testbed-public/pull/36
https://github.com/steady-orchard/patch-steward-testbed-public/pull/37
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36421209248
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36421341796
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36421552482
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36421707693.
Runs of the pull request into scenario-s10-base: opened pass, closed pass.

```text
$ bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s10-close "scenario: S10 pull request change" scenarios/fixtures/submissions/unstructured.txt:scenario-s10-close.txt
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=scenario-s10-close existed=no
DEPLOY commit=822d2be929692accce1ff3e22e7ca10f8ecfebef message=scenario: S10 pull request change
DEPLOY push=ok attempt=1 head=822d2be929692accce1ff3e22e7ca10f8ecfebef
DEPLOY identical dest=scenario-s10-close.txt blob=416033bb79d1631d231a6d86791ea321223f1a5c
$ gh pr create -R steady-orchard/patch-steward-testbed-public --base master --head scenario-s10-close --title "[scenario S10] pull request closed by its author" --body-file scenarios/fixtures/submissions/unstructured.txt
https://github.com/steady-orchard/patch-steward-testbed-public/pull/36
```

```text
$ gh run view 36421209248 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421209248 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:21:08.7771831Z text=event pull_request_target opened pr 36 sender User
LOG job=gate ts=2026-09-28T12:21:08.7773765Z text=listing none
LOG job=gate ts=2026-09-28T12:21:08.7774192Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:21:08.7775369Z text=disposition early-exit
LOG job=gate ts=2026-09-28T12:21:08.7917059Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T12:21:08.7919501Z text=- Owner: committed `36421209248-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421209248 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:21:33.0208611Z text=evidence commit b28b138ba3651a30589ea6e86af7a0c5e33cf4fd rebuilds 0
LOG job=publish ts=2026-09-28T12:21:33.0209255Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:21:33.0209718Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:21:33.0210144Z text=freshness current
LOG job=publish ts=2026-09-28T12:21:33.0381441Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T12:21:33.0384336Z text=- Evidence: commit `b28b138ba3651a30589ea6e86af7a0c5e33cf4fd` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-36/36421209248-1`
```

```text
$ gh pr close 36 -R steady-orchard/patch-steward-testbed-public
Closed pull request steady-orchard/patch-steward-testbed-public#36 ([scenario S10] pull request closed by its author)
$ gh run view 36421341796 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421341796 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:22:20.5889467Z text=event pull_request_target closed pr 36 sender User
LOG job=gate ts=2026-09-28T12:22:20.5892213Z text=listing unique owner 36421209248-1
LOG job=gate ts=2026-09-28T12:22:20.5893009Z text=disposition closure resolution closed-by-author
LOG job=gate ts=2026-09-28T12:22:20.5975365Z text=- Status: `closure`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421341796 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:22:35.1837231Z text=evidence commit a47bfdf872fefe33ecaa7c9a906034f99c2f9db1 rebuilds 0
LOG job=publish ts=2026-09-28T12:22:35.1970288Z text=- Status: `closure`
LOG job=publish ts=2026-09-28T12:22:35.1973672Z text=- Evidence: commit `a47bfdf872fefe33ecaa7c9a906034f99c2f9db1` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/metrics/2026-09/36421341796-1.json`
$ bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36421341796-1
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36421341796-1.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=closed-by-author paired_run=36421209248-1 paired_snapshot=sha256:5fbdeca07dd136a135f2faeead462f6993460aca16409987f3a8401a036dce23
METRICS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public run=36421341796-1 files=1 events=1
```

```text
$ bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s10-base "scenario: S10 base branch" scenarios/workflows/steward-pr.yml
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=scenario-s10-base existed=no
DEPLOY commit=none reason=already-identical
DEPLOY push=ok attempt=1 head=98ed7cdfcc010a6fd30975fc008636796116a3ed
DEPLOY identical dest=.github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
$ bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public scenario-s10-merge "scenario: S10 merge change" scenarios/fixtures/submissions/unstructured.txt:scenario-s10-merge.txt
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=scenario-s10-merge existed=no
DEPLOY commit=881381836f34af84ff8f2838c1eac0128c797827 message=scenario: S10 merge change
DEPLOY push=ok attempt=1 head=881381836f34af84ff8f2838c1eac0128c797827
DEPLOY identical dest=scenario-s10-merge.txt blob=416033bb79d1631d231a6d86791ea321223f1a5c
$ gh pr create -R steady-orchard/patch-steward-testbed-public --base scenario-s10-base --head scenario-s10-merge --title "[scenario S10] pull request merged into a scenario base" --body-file scenarios/fixtures/submissions/unstructured.txt
https://github.com/steady-orchard/patch-steward-testbed-public/pull/37
```

```text
$ gh run view 36421552482 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421552482 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:24:22.8613727Z text=event pull_request_target opened pr 37 sender User
LOG job=gate ts=2026-09-28T12:24:22.8615899Z text=listing none
LOG job=gate ts=2026-09-28T12:24:22.8616271Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:24:22.8616690Z text=disposition early-exit
LOG job=gate ts=2026-09-28T12:24:22.8733061Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T12:24:22.8735281Z text=- Owner: committed `36421552482-1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421552482 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:24:44.5629598Z text=evidence commit 06113cf688033223c047dd32fa8a529ca840e69f rebuilds 0
LOG job=publish ts=2026-09-28T12:24:44.5630558Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:24:44.5631198Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:24:44.5631790Z text=freshness current
LOG job=publish ts=2026-09-28T12:24:44.5766360Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T12:24:44.5771597Z text=- Evidence: commit `06113cf688033223c047dd32fa8a529ca840e69f` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/pr-37/36421552482-1`
```

```text
$ gh pr merge 37 -R steady-orchard/patch-steward-testbed-public --merge
$ gh run view 36421707693 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421707693 1 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:25:48.4363146Z text=event pull_request_target closed pr 37 sender User
LOG job=gate ts=2026-09-28T12:25:48.4369342Z text=listing unique owner 36421552482-1
LOG job=gate ts=2026-09-28T12:25:48.4369615Z text=disposition closure resolution merged
LOG job=gate ts=2026-09-28T12:25:48.4493145Z text=- Status: `closure`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36421707693 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:26:11.8963847Z text=evidence commit 35a1509a910a4f1757e8ffea81ed303a5c5e6680 rebuilds 0
LOG job=publish ts=2026-09-28T12:26:11.9091065Z text=- Status: `closure`
LOG job=publish ts=2026-09-28T12:26:11.9094035Z text=- Evidence: commit `35a1509a910a4f1757e8ffea81ed303a5c5e6680` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/metrics/2026-09/36421707693-1.json`
$ bash scenarios/tools/run-records.sh metrics steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public 36421707693-1
METRIC file=steady-orchard/patch-steward-testbed-public/metrics/2026-09/36421707693-1.json kind=maintainer-resolution subject=submission action_kind=resolution resolution=merged paired_run=36421552482-1 paired_snapshot=sha256:beabe36dc74ec31ad710d9d2519ba94f04ade12a08c60f24b2785456045c72f1
METRICS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public run=36421707693-1 files=1 events=1
$ gh pr view 37 -R steady-orchard/patch-steward-testbed-public --json state,baseRefName --jq '.state + " " + .baseRefName'
MERGED scenario-s10-base
```

```text
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public pr 37
EVIDENCE append_only=yes
EVIDENCE run=36421552482-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=pr-37 runs=1 verified=1 result=ok
```

Result: pass

## S11 daily run cap: over-cap work waits

Date (UTC): 2026-09-28. Deployed a policy with `limits.caps.daily_runs: 1`, filed two complete defect issues on the test-bed, and confirmed both runs were queued as over the daily cap with a persisted waiting evidence record; the issues are https://github.com/steady-orchard/patch-steward-testbed-public/issues/38 and https://github.com/steady-orchard/patch-steward-testbed-public/issues/39, the runs are https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36422412647 and https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36422572569; the valid policy was restored afterward.

```text
$ bash scenarios/tools/deploy-steward.sh org-public scenarios/fixtures/policies/caps-daily.yml
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/caps-daily.yml result=ok
```

```text
$ gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S11] daily cap, first issue" --body-file fixtures/submissions/defect-complete.txt
https://github.com/steady-orchard/patch-steward-testbed-public/issues/38
$ gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S11] daily cap, second issue" --body-file fixtures/submissions/defect-complete.txt
https://github.com/steady-orchard/patch-steward-testbed-public/issues/39
```

```text
$ gh run view 36422412647 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36422412647 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |- Status|- Caps)'
LOG job=gate ts=2026-09-28T12:32:24.4721142Z text=event issues opened issue 38 sender User
LOG job=gate ts=2026-09-28T12:32:24.4722349Z text=policy trusted-branch revision b1916b8f26073a908208c9e5afa66fdd067f68a8
LOG job=gate ts=2026-09-28T12:32:24.4723078Z text=listing none
LOG job=gate ts=2026-09-28T12:32:24.4723438Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:32:24.4723878Z text=caps daily-runs daily 28 of 1 author 1 of 20
LOG job=gate ts=2026-09-28T12:32:24.4724324Z text=disposition queued
LOG job=gate ts=2026-09-28T12:32:24.4858738Z text=- Status: `queued`
LOG job=gate ts=2026-09-28T12:32:24.4862659Z text=- Caps: daily `28` of `1`, author `1` of `20`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36422412647 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:32:48.4562214Z text=evidence commit 17014464085e4fea68a62ddbfa26aef1ed5b53ed rebuilds 0
LOG job=publish ts=2026-09-28T12:32:48.4562828Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:32:48.4563388Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:32:48.4563916Z text=freshness current
LOG job=publish ts=2026-09-28T12:32:48.4653291Z text=- Status: `queued`
LOG job=publish ts=2026-09-28T12:32:48.4658472Z text=- Evidence: commit `17014464085e4fea68a62ddbfa26aef1ed5b53ed` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-38/36422412647-1`
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 38
RECORD run=36422412647-1 kind=waiting state=queued reason=daily-runs daily=28/1 author=1/20 arrival_at=2026-09-28T12:32:27Z policy_revision=b1916b8f26073a908208c9e5afa66fdd067f68a8 snapshot=sha256:4007e73d96b9257681ce78747da7953e1a1b3471d53e9b3477c026f601ea8434
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-38 runs=1 supersessions=0
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 38
EVIDENCE run=36422412647-1 kind=waiting manifest=verified
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-38 runs=1 verified=1 result=ok
```

```text
$ gh run view 36422572569 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36422572569 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |- Status|- Caps)'
LOG job=gate ts=2026-09-28T12:33:50.5437080Z text=event issues opened issue 39 sender User
LOG job=gate ts=2026-09-28T12:33:50.5437837Z text=policy trusted-branch revision b1916b8f26073a908208c9e5afa66fdd067f68a8
LOG job=gate ts=2026-09-28T12:33:50.5438274Z text=listing none
LOG job=gate ts=2026-09-28T12:33:50.5438567Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:33:50.5438801Z text=caps daily-runs daily 29 of 1 author 1 of 20
LOG job=gate ts=2026-09-28T12:33:50.5439030Z text=disposition queued
LOG job=gate ts=2026-09-28T12:33:50.5556682Z text=- Status: `queued`
LOG job=gate ts=2026-09-28T12:33:50.5558186Z text=- Caps: daily `29` of `1`, author `1` of `20`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36422572569 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:34:15.5958483Z text=evidence commit 9bc21b43643ad7c9f83f377598b51fddd0efd469 rebuilds 0
LOG job=publish ts=2026-09-28T12:34:15.5959217Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:34:15.5959780Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:34:15.5960290Z text=freshness current
LOG job=publish ts=2026-09-28T12:34:15.6129635Z text=- Status: `queued`
LOG job=publish ts=2026-09-28T12:34:15.6134300Z text=- Evidence: commit `9bc21b43643ad7c9f83f377598b51fddd0efd469` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-39/36422572569-1`
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 39
RECORD run=36422572569-1 kind=waiting state=queued reason=daily-runs daily=29/1 author=1/20 arrival_at=2026-09-28T12:33:52Z policy_revision=b1916b8f26073a908208c9e5afa66fdd067f68a8 snapshot=sha256:e39982efb57eadf9973d4aad52fcea001e6b46f58a4f1a9ff4455123b2de5a16
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-39 runs=1 supersessions=0
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 39
EVIDENCE run=36422572569-1 kind=waiting manifest=verified
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-39 runs=1 verified=1 result=ok
```

```text
$ bash scenarios/tools/deploy-steward.sh org-public
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/orphan-branch.yml result=ok
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
d997b1e362c75af03942da0e7a1e8902ca5dbe51
```

Result: pass

## S11 per-author concurrent cap: over-cap work waits

Date (UTC): 2026-09-28. With a policy whose per-author concurrent cap is 1, two issues opened back to back on
`steady-orchard/patch-steward-testbed-public` (https://github.com/steady-orchard/patch-steward-testbed-public/issues/40,
https://github.com/steady-orchard/patch-steward-testbed-public/issues/41) produced one queued run
(https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36423270119) with a persisted waiting run
directory whose reason is per-author-concurrent-runs; the valid policy was restored afterward.

```text
$ bash scenarios/tools/deploy-steward.sh org-public scenarios/fixtures/policies/caps-author.yml
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=master existed=yes
DEPLOY commit=61ff7a3d556cf3678bfc5dad5842031661e935af message=scenario: deploy steward wrappers and policy
DEPLOY push=ok attempt=1 head=61ff7a3d556cf3678bfc5dad5842031661e935af
DEPLOY identical dest=.github/workflows/steward-pr.yml blob=6a2ded1721a593ece56863a31502232c02ce3e06
DEPLOY identical dest=.github/workflows/steward-issues.yml blob=ecd5347c96097dce26f96a611a9bbf048b1d1fac
DEPLOY identical dest=.github/patch-steward/policy.yml blob=6a8f59316af0631a3d6772f88f55e71f621c53b8
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/caps-author.yml result=ok
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
5fd52dc2a12ee40b72c01c02cf69aa990bf91fa7
```

```text
$ R=steady-orchard/patch-steward-testbed-public; A=$(gh api "repos/$R/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"; gh issue create -R $R --title "[scenario S11] per-author cap, first issue" --body-file fixtures/submissions/defect-complete.txt; gh issue create -R $R --title "[scenario S11] per-author cap, second issue" --body-file fixtures/submissions/defect-complete.txt
A=36422572569
https://github.com/steady-orchard/patch-steward-testbed-public/issues/40
https://github.com/steady-orchard/patch-steward-testbed-public/issues/41
```

```text
$ PROBE_WAIT_SECONDS=540 bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue " 36422572569 2
RUN id=36423270119 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:39:48Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36423270119 title=steward issue 40 author 2095171 event issues opened sender 2095171 User
RUN id=36423271890 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T12:39:49Z url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36423271890 title=steward issue 41 author 2095171 event issues opened sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-public workflow=steward-issues.yml after=36422572569 count=2 completed=2 result=complete
```

```text
$ gh run view 36423270119 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36423270119 1 gate | grep -E 'text=(event |listing |dedup |caps |disposition |- Status|- Caps)'
LOG job=gate ts=2026-09-28T12:40:27.7127565Z text=event issues opened issue 40 sender User
LOG job=gate ts=2026-09-28T12:40:27.7130086Z text=listing none
LOG job=gate ts=2026-09-28T12:40:27.7130820Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:40:27.7131858Z text=caps per-author-concurrent-runs daily 31 of 1000 author 2 of 1
LOG job=gate ts=2026-09-28T12:40:27.7133111Z text=disposition queued
LOG job=gate ts=2026-09-28T12:40:27.7289227Z text=- Status: `queued`
LOG job=gate ts=2026-09-28T12:40:27.7292759Z text=- Caps: daily `31` of `1000`, author `2` of `1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36423270119 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:40:52.9023484Z text=evidence commit f063c98cff2d407841b6b1042cf61447c0db92c5 rebuilds 1
LOG job=publish ts=2026-09-28T12:40:52.9024067Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:40:52.9024494Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:40:52.9024891Z text=freshness current
LOG job=publish ts=2026-09-28T12:40:52.9201155Z text=- Status: `queued`
LOG job=publish ts=2026-09-28T12:40:52.9204741Z text=- Evidence: commit `f063c98cff2d407841b6b1042cf61447c0db92c5` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-40/36423270119-1`
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 40
RECORD run=36423270119-1 kind=waiting state=queued reason=per-author-concurrent-runs daily=31/1000 author=2/1 arrival_at=2026-09-28T12:40:29Z policy_revision=5fd52dc2a12ee40b72c01c02cf69aa990bf91fa7 snapshot=sha256:b46f0e9548370e070b5113bf7ee6c457457676cfa594fd2cdaa0f3fc5538be86
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-40 runs=1 supersessions=0
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 40
EVIDENCE run=36423270119-1 kind=waiting manifest=verified
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-40 runs=1 verified=1 result=ok
```

```text
$ gh run view 36423271890 -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36423271890 1 gate | grep -E 'text=(event |listing |dedup |caps |disposition |- Status|- Caps)'
LOG job=gate ts=2026-09-28T12:40:19.6990934Z text=event issues opened issue 41 sender User
LOG job=gate ts=2026-09-28T12:40:19.6992443Z text=listing none
LOG job=gate ts=2026-09-28T12:40:19.6992820Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T12:40:19.6993426Z text=caps within daily 31 of 1000 author 1 of 1
LOG job=gate ts=2026-09-28T12:40:19.6994060Z text=disposition runnable
LOG job=gate ts=2026-09-28T12:40:19.7135606Z text=- Status: `runnable`
LOG job=gate ts=2026-09-28T12:40:19.7138746Z text=- Caps: daily `31` of `1000`, author `1` of `1`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-public 36423271890 1 publish | grep -E 'text=(evidence commit |freshness |- Status|- Evidence)'
LOG job=publish ts=2026-09-28T12:40:47.8098617Z text=evidence commit 64cdc3d232af4180f2cb38412ea8119a20e4ba82 rebuilds 0
LOG job=publish ts=2026-09-28T12:40:47.8099511Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:40:47.8100202Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:40:47.8100795Z text=freshness current
LOG job=publish ts=2026-09-28T12:40:47.8254759Z text=- Status: `inconclusive`
LOG job=publish ts=2026-09-28T12:40:47.8258888Z text=- Evidence: commit `64cdc3d232af4180f2cb38412ea8119a20e4ba82` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-41/36423271890-1`
```

```text
$ bash scenarios/tools/deploy-steward.sh org-public
SCENARIO-DEPLOY repo=steady-orchard/patch-steward-testbed-public pin=7161cd20df662314d14cc7f2f4130102baee1e98 policy=scenarios/fixtures/policies/orphan-branch.yml result=ok
$ gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github?ref=master" --jq '.[] | select(.name=="patch-steward") | .sha'
d997b1e362c75af03942da0e7a1e8902ca5dbe51
```

Result: pass

## S12 explicit rerun commits a new owner

Date (UTC): 2026-09-28. Re-ran the completed hosted-screening smoke run for issue 31
(https://github.com/steady-orchard/patch-steward-testbed-public/issues/31), whose gate treated the rerun as an
explicit rerun, committed a new owner, and whose publish wrote a second run directory keyed by attempt 2. Run:
https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36397673122.

```text
$ R=steady-orchard/patch-steward-testbed-public; gh run view 36397673122 -R $R --json attempt,status,conclusion --jq '(.attempt|tostring) + " " + .status + " " + .conclusion'
1 completed success
$ bash scenarios/tools/artifacts.sh $R steward-ownership-issue-31
ARTIFACT id=10959510156 name=steward-ownership-issue-31 created_at=2026-09-28T08:30:09Z expires_at=2026-12-27T08:29:34Z expired=false run_id=36397673122 size=529
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-issue-31 count=1 unexpired=1
```

```text
$ gh run rerun 36397673122 -R steady-orchard/patch-steward-testbed-public
$ gh run view 36397673122 -R $R --json attempt,status --jq '(.attempt|tostring) + " " + .status'
2 queued
$ PROBE_WAIT_SECONDS=540 bash probes/smoke/tools/wait-run.sh steady-orchard/patch-steward-testbed-public 36397673122
WAIT completed run_id=36397673122 conclusion=success utc=2026-09-28T12:50:00Z
```

```text
$ gh run view 36397673122 -R $R --attempt 2 --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ bash scenarios/tools/run-log.sh $R 36397673122 2 gate | grep -E 'text=(event |listing |dedup |disposition |- Status|- Owner)'
LOG job=gate ts=2026-09-28T12:49:31.8658268Z text=event issues opened issue 31 sender User
LOG job=gate ts=2026-09-28T12:49:31.8660583Z text=listing none
LOG job=gate ts=2026-09-28T12:49:31.8661194Z text=dedup commit rerun
LOG job=gate ts=2026-09-28T12:49:31.8661920Z text=disposition early-exit
LOG job=gate ts=2026-09-28T12:49:31.8793395Z text=- Status: `early-exit`
LOG job=gate ts=2026-09-28T12:49:31.8796589Z text=- Owner: committed `36397673122-2`
$ bash scenarios/tools/run-log.sh $R 36397673122 2 publish | grep -E 'text=(ownership |evidence commit |freshness |- Status|- Evidence|- Freshness)'
LOG job=publish ts=2026-09-28T12:49:53.6000865Z text=ownership retention 90 days
LOG job=publish ts=2026-09-28T12:49:53.6001890Z text=evidence commit d9ca20b91448abd382fd8009cac5ee72c3eda724 rebuilds 0
LOG job=publish ts=2026-09-28T12:49:53.6002681Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T12:49:53.6003585Z text=freshness listing ok
LOG job=publish ts=2026-09-28T12:49:53.6004249Z text=freshness current
LOG job=publish ts=2026-09-28T12:49:53.6147903Z text=- Status: `needs-changes`
LOG job=publish ts=2026-09-28T12:49:53.6152344Z text=- Evidence: commit `d9ca20b91448abd382fd8009cac5ee72c3eda724` at `https://github.com/steady-orchard/patch-steward-testbed-public/tree/steward-evidence/steady-orchard/patch-steward-testbed-public/runs/issue-31/36397673122-2`
LOG job=publish ts=2026-09-28T12:49:53.6154073Z text=- Freshness: `current`
```

```text
$ bash scenarios/tools/artifacts.sh $R steward-ownership-issue-31
ARTIFACT id=10971196087 name=steward-ownership-issue-31 created_at=2026-09-28T12:49:34Z expires_at=2026-12-27T12:48:23Z expired=false run_id=36397673122 size=530
ARTIFACTS repo=steady-orchard/patch-steward-testbed-public name=steward-ownership-issue-31 count=1 unexpired=1
$ bash scenarios/tools/run-records.sh runs $R steward-evidence $R issue 31
RECORD run=36397673122-1 kind=outcome outcome=needs-changes run_id=36397673122 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:b76304d018392689a4b010d378277f364e15cf9b4681e7a9935c8e6cebb958dc findings=submission.unstructured
RECORD run=36397673122-2 kind=outcome outcome=needs-changes run_id=36397673122 run_attempt=2 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:b76304d018392689a4b010d378277f364e15cf9b4681e7a9935c8e6cebb958dc findings=submission.unstructured
RECORDS store=steady-orchard/patch-steward-testbed-public branch=steward-evidence target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=2 supersessions=0
$ bash scenarios/tools/evidence.sh $R steward-evidence $R issue 31
EVIDENCE store=steady-orchard/patch-steward-testbed-public branch=steward-evidence tip=d9ca20b91448abd382fd8009cac5ee72c3eda724 commits=30
EVIDENCE run=36397673122-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE run=36397673122-2 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-31 runs=2 verified=2 result=ok
```

Result: pass
