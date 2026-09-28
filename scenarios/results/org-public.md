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
