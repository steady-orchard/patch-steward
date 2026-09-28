# Scenario results: org-private

Test-bed `steady-orchard/patch-steward-testbed-private` with the separate evidence repository
`steady-orchard/patch-steward-testbed-evidence`. Verbatim evidence from the test-bed scenario suite described in
`../README.md`; command output is copied unchanged inside `text` fences. Sections appear in the order the scenarios ran.

## S17 publication Environment delivers the App secrets only to Environment jobs

Date (UTC): 2026-09-28. The publication Environment check confirms the `steward-publication` Environment on Q, then the
secret-scope scenario dispatches a caller/called workflow pair at
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36409910597.

```text
$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-private
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=organization-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok
```

```text
$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-private
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=steady-orchard/patch-steward-testbed-private branch=master existed=yes
DEPLOY commit=7a01c1e9b707648e733fb24d12acc55dcc2b779d message=scenario: deploy secret-scope pair
DEPLOY push=ok attempt=1 head=7a01c1e9b707648e733fb24d12acc55dcc2b779d
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=9020f1a58702ee33bab4f83555a6e5ba9fb00168
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE repo=steady-orchard/patch-steward-testbed-private run=36409910597 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36409910597 result=pass
```

Result: pass

## S16 contract-met issue published to the separate evidence repository

Date (UTC): 2026-09-28. Contract-met issue
https://github.com/steady-orchard/patch-steward-testbed-private/issues/9 triggered run
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36410002176, which committed evidence to E and
proved E is among the organization App installation's selected repositories.

The evidence repository check:

```text
$ gh api repos/steady-orchard/patch-steward-testbed-evidence --jq '[.private, .size >= 0]'
[true,true]
$ gh api repos/steady-orchard/patch-steward-testbed-evidence/commits --jq length
1
```

```text
$ gh api repos/steady-orchard/patch-steward-testbed-private/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"
target store branch exit 1
```

```text
$ A=$(gh api "repos/steady-orchard/patch-steward-testbed-private/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
A=36409910597
```

```text
$ gh issue create -R steady-orchard/patch-steward-testbed-private --title "[scenario S16] contract-met issue" --body-file fixtures/submissions/defect-complete.txt
https://github.com/steady-orchard/patch-steward-testbed-private/issues/9
$ date -u +%Y-%m-%dT%H:%M:%SZ
2026-09-28T10:29:19Z
```

```text
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-private steward-issues.yml "steward issue 9 author 2095171 event issues opened sender 2095171 User" 36409910597 1
RUN id=36410002176 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T10:29:22Z url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36410002176 title=steward issue 9 author 2095171 event issues opened sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-private workflow=steward-issues.yml after=36409910597 count=1 completed=1 result=complete
```

```text
$ gh run view 36410002176 -R steady-orchard/patch-steward-testbed-private --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
```

```text
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-private 36410002176 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |steward job summary:|- )'
LOG job=gate ts=2026-09-28T10:29:51.5879203Z text=- steward-runtime (ID: 10963657744, Size: 1637777, Expected Digest: sha256:00b1caeb76e1f0c7b64f2e250009b301675ce2f5513392342a23a857c8dd9652)
LOG job=gate ts=2026-09-28T10:29:57.3954646Z text=event issues opened issue 9 sender User
LOG job=gate ts=2026-09-28T10:29:57.3961808Z text=policy trusted-branch revision 82e7de77b61c61c22193765687b53264af57b814
LOG job=gate ts=2026-09-28T10:29:57.3964438Z text=listing none
LOG job=gate ts=2026-09-28T10:29:57.3973406Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T10:29:57.3974739Z text=caps within daily 1 of 50 author 1 of 2
LOG job=gate ts=2026-09-28T10:29:57.3975957Z text=disposition runnable
LOG job=gate ts=2026-09-28T10:29:57.4096621Z text=steward job summary:
LOG job=gate ts=2026-09-28T10:29:57.4104606Z text=- Submission: `steady-orchard/patch-steward-testbed-private` issue `9`
LOG job=gate ts=2026-09-28T10:29:57.4106263Z text=- Run: `36410002176-1`
LOG job=gate ts=2026-09-28T10:29:57.4107124Z text=- Status: `runnable`
LOG job=gate ts=2026-09-28T10:29:57.4108902Z text=- Snapshot: `sha256:6ca84fc3fe9a4e9c8a29b47b5ed31df232f271e0de718e87be447ef374f5af0f`
LOG job=gate ts=2026-09-28T10:29:57.4110625Z text=- Policy revision: `82e7de77b61c61c22193765687b53264af57b814`
LOG job=gate ts=2026-09-28T10:29:57.4116500Z text=- Owner: committed `36410002176-1`
LOG job=gate ts=2026-09-28T10:29:57.4118098Z text=- Caps: daily `1` of `50`, author `1` of `2`
$ bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-private 36410002176 1 publish | grep -E 'text=(policy |ownership |evidence commit |freshness |steward job summary:|- )'
LOG job=publish ts=2026-09-28T10:30:08.9963791Z text=- steward-runtime (ID: 10963657744, Size: 1637777, Expected Digest: sha256:00b1caeb76e1f0c7b64f2e250009b301675ce2f5513392342a23a857c8dd9652)
LOG job=publish ts=2026-09-28T10:30:10.2676154Z text=- steward-handoff (ID: 10963594442, Size: 1788, Expected Digest: sha256:278d40488271cde64d5a7ffda140763683653a1bc4c96e3305a97b16e53f570f)
LOG job=publish ts=2026-09-28T10:30:20.5274712Z text=policy revision 82e7de77b61c61c22193765687b53264af57b814
LOG job=publish ts=2026-09-28T10:30:20.5275585Z text=ownership retention 90 days
LOG job=publish ts=2026-09-28T10:30:20.5276273Z text=evidence commit 40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3 rebuilds 0
LOG job=publish ts=2026-09-28T10:30:20.5276936Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T10:30:20.5277462Z text=freshness listing ok
LOG job=publish ts=2026-09-28T10:30:20.5277946Z text=freshness current
LOG job=publish ts=2026-09-28T10:30:20.5369490Z text=steward job summary:
LOG job=publish ts=2026-09-28T10:30:20.5377579Z text=- Submission: `steady-orchard/patch-steward-testbed-private` issue `9`
LOG job=publish ts=2026-09-28T10:30:20.5378838Z text=- Run: `36410002176-1`
LOG job=publish ts=2026-09-28T10:30:20.5379891Z text=- Status: `inconclusive`
LOG job=publish ts=2026-09-28T10:30:20.5381344Z text=- Snapshot: `sha256:6ca84fc3fe9a4e9c8a29b47b5ed31df232f271e0de718e87be447ef374f5af0f`
LOG job=publish ts=2026-09-28T10:30:20.5382626Z text=- Policy revision: `82e7de77b61c61c22193765687b53264af57b814`
LOG job=publish ts=2026-09-28T10:30:20.5384574Z text=- Evidence: commit `40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3` at `https://github.com/steady-orchard/patch-steward-testbed-evidence/tree/steward-evidence/steady-orchard/patch-steward-testbed-private/runs/issue-9/36410002176-1`
LOG job=publish ts=2026-09-28T10:30:20.5386223Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T10:30:20.5386814Z text=- Ownership artifact retention: `90` days
```

```text
$ gh api "repos/steady-orchard/patch-steward-testbed-evidence/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]'
["40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3"]
```

```text
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-evidence steward-evidence steady-orchard/patch-steward-testbed-private issue 9
EVIDENCE store=steady-orchard/patch-steward-testbed-evidence branch=steward-evidence tip=40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3 commits=1
EVIDENCE commit=40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3 parents=0 added=9 other=0
EVIDENCE append_only=yes
EVIDENCE run=36410002176-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-private subject=issue-9 runs=1 verified=1 result=ok
```

```text
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-evidence steward-evidence steady-orchard/patch-steward-testbed-private issue 9
RECORD run=36410002176-1 kind=outcome outcome=inconclusive run_id=36410002176 run_attempt=1 policy_revision=82e7de77b61c61c22193765687b53264af57b814 snapshot=sha256:6ca84fc3fe9a4e9c8a29b47b5ed31df232f271e0de718e87be447ef374f5af0f findings=none
RECORDS store=steady-orchard/patch-steward-testbed-evidence branch=steward-evidence target=steady-orchard/patch-steward-testbed-private subject=issue-9 runs=1 supersessions=0
```

```text
$ gh api repos/steady-orchard/patch-steward-testbed-private/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"
target store branch exit 1
```

Result: pass

## S17 repeated after the publication jobs declared deployment false

Date (UTC): 2026-09-28. The publication Environment is now declared with `deployment: false` in the called
workflow's job inside, as in the reusable screening workflow; the run
https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36458943724.

```text
$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-private
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=organization-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok
```

```text
$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-private
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=steady-orchard/patch-steward-testbed-private branch=master existed=yes
DEPLOY commit=none reason=already-identical
DEPLOY push=none reason=nothing-to-push
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=3242cc52593044b07274fbf5b565f72ad01eecf1
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE repo=steady-orchard/patch-steward-testbed-private run=36458943724 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36458943724 result=pass
```

```text
$ gh api -H 'Accept: application/vnd.github.raw+json' "repos/steady-orchard/patch-steward-testbed-private/contents/.github/workflows/scenario-secret-scope-called.yml?ref=master" | tr -d '\r' | grep -x -E '    environment:|      name: steward-publication|      deployment: false'
    environment:
      name: steward-publication
      deployment: false
```

```text
$ T=$(gh api "repos/steady-orchard/patch-steward-testbed-private/actions/runs/36458943724" --jq .created_at); n=$(gh api "repos/steady-orchard/patch-steward-testbed-private/deployments?environment=steward-publication&per_page=100" --paginate --jq ".[] | select(.created_at >= \"$T\") | .id" | wc -l | tr -d ' '); echo "DEPLOYMENTS repo=steady-orchard/patch-steward-testbed-private environment=steward-publication since=$T count=$n"
DEPLOYMENTS repo=steady-orchard/patch-steward-testbed-private environment=steward-publication since=2026-09-28T17:33:19Z count=0
```

Result: pass

## S13 observe mode writes nothing on submissions

Date (UTC): 2026-09-28. This test-bed has no scenario pull request.

```text
$ bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-private
AUDIT repo=steady-orchard/patch-steward-testbed-private wrappers_deployed_at=2026-09-28T17:25:22Z source=history
AUDIT repo=steady-orchard/patch-steward-testbed-private kind=issue number=9 app_comments=0 labels=0 app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a before_fix_deployments=n/a
AUDIT repo=steady-orchard/patch-steward-testbed-private submissions=1 app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=0 result=clean
```

Result: pass

## S14 only gate and publish use the publication Environment; everything is pinned

Date (UTC): 2026-09-28. Only the `gate` and `publish` jobs declare the `steward-publication` Environment, in the
mapping form, and the deployed wrappers are pinned to the reusable workflow commit.

```text
$ bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-private
PINS repo=steady-orchard/patch-steward-testbed-private check=wrapper-blobs ok
PINS repo=steady-orchard/patch-steward-testbed-private check=pin-equal ok pin=15c6e6d73ae88f4d95a9e0233f9dee45ce3b9568
PINS repo=steady-orchard/patch-steward-testbed-private check=pin-reachable ok status=identical
PINS repo=steady-orchard/patch-steward-testbed-private check=environment-jobs ok jobs=gate,publish other_form=none
PINS repo=steady-orchard/patch-steward-testbed-private check=secret-jobs ok jobs=gate,publish
PINS repo=steady-orchard/patch-steward-testbed-private check=wrapper-mapping ok
PINS repo=steady-orchard/patch-steward-testbed-private check=probe-names ok
PINS repo=steady-orchard/patch-steward-testbed-private check=uses-pinned ok count=14
PINS repo=steady-orchard/patch-steward-testbed-private pin=15c6e6d73ae88f4d95a9e0233f9dee45ce3b9568 result=pass
```

```text
$ gh api -H 'Accept: application/vnd.github.raw+json' "repos/steady-orchard/patch-steward/contents/.github/workflows/steward-screening.yml?ref=15c6e6d73ae88f4d95a9e0233f9dee45ce3b9568" | tr -d '\r' | grep -n -E '^  [a-z]+:$|^    environment|^      (name|deployment): '
28:  build:
83:  gate:
88:    environment:
89:      name: steward-publication
90:      deployment: false
180:  publish:
186:    environment:
187:      name: steward-publication
188:      deployment: false
```

Result: pass

## Steady state

Date (UTC): 2026-09-28. Every steward and scenario workflow in scope is now disabled and no scenario issue or pull
request remains open.

```text
$ bash scenarios/tools/steady-state.sh steady-orchard/patch-steward-testbed-private apply
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow scenario-secret-scope-called.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow scenario-secret-scope.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow steward-issues.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow steward-pr.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private result=steady active_workflows=0 open_submissions=0
```

```text
$ bash scenarios/tools/steady-state.sh steady-orchard/patch-steward-testbed-private plan
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow scenario-secret-scope-called.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow scenario-secret-scope.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow steward-issues.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private workflow steward-pr.yml disabled_manually keep
SCENARIO-STEADY steady-orchard/patch-steward-testbed-private result=planned active_workflows=0 open_submissions=0
```

```text
$ gh api "repos/steady-orchard/patch-steward-testbed-private/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state'
scenario-secret-scope-called.yml disabled_manually
scenario-secret-scope.yml disabled_manually
steward-issues.yml disabled_manually
steward-pr.yml disabled_manually
```
