# Scenario results: personal

Test-bed `jambolo/patch-steward-testbed-personal`. Verbatim evidence from the test-bed scenario suite described in
`../README.md`; command output is copied unchanged inside `text` fences. Sections appear in the order the scenarios
ran.

## S17 publication Environment delivers the App secrets only to Environment jobs

Date (UTC): 2026-09-28. The publication Environment check confirms `steward-publication` holds both App secrets,
restricted to branch `master`, with no repository-level `PATCH_STEWARD_*` secret. The secret-scope scenario run is at
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36409893521.

```text
$ bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal result=ok
```

```text
$ bash scenarios/tools/secret-scope.sh run jambolo/patch-steward-testbed-personal
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=jambolo/patch-steward-testbed-personal branch=master existed=yes
DEPLOY commit=4e55c9f1a0c226f2894ece41aef852ea6b98c56d message=scenario: deploy secret-scope pair
DEPLOY push=ok attempt=1 head=4e55c9f1a0c226f2894ece41aef852ea6b98c56d
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=9020f1a58702ee33bab4f83555a6e5ba9fb00168
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE repo=jambolo/patch-steward-testbed-personal run=36409893521 url=https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36409893521 result=pass
```

Result: pass

## S15 contract-met issue screened with secrets passed by explicit mapping

Date (UTC): 2026-09-28. Issue https://github.com/jambolo/patch-steward-testbed-personal/issues/9 was screened by run
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36409964372, which published an outcome record
of `inconclusive` to the evidence store, proving the personal installation accepted the App's current permissions.

```text
$ A=$(gh api "repos/jambolo/patch-steward-testbed-personal/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
A=36409893521
```

```text
$ gh issue create -R jambolo/patch-steward-testbed-personal --title "[scenario S15] contract-met issue" --body-file fixtures/submissions/defect-complete.txt
https://github.com/jambolo/patch-steward-testbed-personal/issues/9
$ date -u +%Y-%m-%dT%H:%M:%SZ
2026-09-28T10:28:57Z
```

```text
$ bash scenarios/tools/await-runs.sh jambolo/patch-steward-testbed-personal steward-issues.yml "steward issue 9 author 2095171 event issues opened sender 2095171 User" "36409893521" 1
RUN id=36409964372 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T10:29:00Z url=https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36409964372 title=steward issue 9 author 2095171 event issues opened sender 2095171 User
AWAIT repo=jambolo/patch-steward-testbed-personal workflow=steward-issues.yml after=36409893521 count=1 completed=1 result=complete
```

```text
$ gh run view 36409964372 -R jambolo/patch-steward-testbed-personal --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
```

```text
$ bash scenarios/tools/run-log.sh jambolo/patch-steward-testbed-personal 36409964372 1 gate | grep -E 'text=(event |policy |listing |dedup |caps |disposition |steward job summary:|- )'
LOG job=gate ts=2026-09-28T10:29:27.8237761Z text=event issues opened issue 9 sender User
LOG job=gate ts=2026-09-28T10:29:27.8239064Z text=policy trusted-branch revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=gate ts=2026-09-28T10:29:27.8239639Z text=listing none
LOG job=gate ts=2026-09-28T10:29:27.8239984Z text=dedup commit no-owner
LOG job=gate ts=2026-09-28T10:29:27.8240404Z text=caps within daily 1 of 50 author 1 of 2
LOG job=gate ts=2026-09-28T10:29:27.8240823Z text=disposition runnable
LOG job=gate ts=2026-09-28T10:29:27.8385425Z text=steward job summary:
LOG job=gate ts=2026-09-28T10:29:27.8393263Z text=- Submission: `jambolo/patch-steward-testbed-personal` issue `9`
LOG job=gate ts=2026-09-28T10:29:27.8394094Z text=- Run: `36409964372-1`
LOG job=gate ts=2026-09-28T10:29:27.8394473Z text=- Status: `runnable`
LOG job=gate ts=2026-09-28T10:29:27.8395313Z text=- Snapshot: `sha256:3d0ba4fb7fbf26c1f88d3d66b66a12c06e70109b25f591edf14056c0e99987aa`
LOG job=gate ts=2026-09-28T10:29:27.8396532Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=gate ts=2026-09-28T10:29:27.8397105Z text=- Owner: committed `36409964372-1`
LOG job=gate ts=2026-09-28T10:29:27.8397580Z text=- Caps: daily `1` of `50`, author `1` of `2`
```

```text
$ bash scenarios/tools/run-log.sh jambolo/patch-steward-testbed-personal 36409964372 1 publish | grep -E 'text=(policy |ownership |evidence commit |freshness |steward job summary:|- )'
LOG job=publish ts=2026-09-28T10:29:51.7257178Z text=policy revision d997b1e362c75af03942da0e7a1e8902ca5dbe51
LOG job=publish ts=2026-09-28T10:29:51.7257914Z text=ownership retention 90 days
LOG job=publish ts=2026-09-28T10:29:51.7258558Z text=evidence commit c5ae908e66ec9298048d6d0dbd54713930cb911e rebuilds 0
LOG job=publish ts=2026-09-28T10:29:51.7259202Z text=freshness settle 10000 ms
LOG job=publish ts=2026-09-28T10:29:51.7259604Z text=freshness listing ok
LOG job=publish ts=2026-09-28T10:29:51.7259980Z text=freshness current
LOG job=publish ts=2026-09-28T10:29:51.7428278Z text=steward job summary:
LOG job=publish ts=2026-09-28T10:29:51.7436655Z text=- Submission: `jambolo/patch-steward-testbed-personal` issue `9`
LOG job=publish ts=2026-09-28T10:29:51.7437349Z text=- Run: `36409964372-1`
LOG job=publish ts=2026-09-28T10:29:51.7437945Z text=- Status: `inconclusive`
LOG job=publish ts=2026-09-28T10:29:51.7438765Z text=- Snapshot: `sha256:3d0ba4fb7fbf26c1f88d3d66b66a12c06e70109b25f591edf14056c0e99987aa`
LOG job=publish ts=2026-09-28T10:29:51.7439714Z text=- Policy revision: `d997b1e362c75af03942da0e7a1e8902ca5dbe51`
LOG job=publish ts=2026-09-28T10:29:51.7441904Z text=- Evidence: commit `c5ae908e66ec9298048d6d0dbd54713930cb911e` at `https://github.com/jambolo/patch-steward-testbed-personal/tree/steward-evidence/jambolo/patch-steward-testbed-personal/runs/issue-9/36409964372-1`
LOG job=publish ts=2026-09-28T10:29:51.7443270Z text=- Freshness: `current`
LOG job=publish ts=2026-09-28T10:29:51.7443735Z text=- Ownership artifact retention: `90` days
```

```text
$ bash scenarios/tools/evidence.sh jambolo/patch-steward-testbed-personal steward-evidence jambolo/patch-steward-testbed-personal issue 9
EVIDENCE store=jambolo/patch-steward-testbed-personal branch=steward-evidence tip=c5ae908e66ec9298048d6d0dbd54713930cb911e commits=1
EVIDENCE commit=c5ae908e66ec9298048d6d0dbd54713930cb911e parents=0 added=9 other=0
EVIDENCE append_only=yes
EVIDENCE run=36409964372-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0
EVIDENCE target=jambolo/patch-steward-testbed-personal subject=issue-9 runs=1 verified=1 result=ok
```

```text
$ bash scenarios/tools/run-records.sh runs jambolo/patch-steward-testbed-personal steward-evidence jambolo/patch-steward-testbed-personal issue 9
RECORD run=36409964372-1 kind=outcome outcome=inconclusive run_id=36409964372 run_attempt=1 policy_revision=d997b1e362c75af03942da0e7a1e8902ca5dbe51 snapshot=sha256:3d0ba4fb7fbf26c1f88d3d66b66a12c06e70109b25f591edf14056c0e99987aa findings=none
RECORDS store=jambolo/patch-steward-testbed-personal branch=steward-evidence target=jambolo/patch-steward-testbed-personal subject=issue-9 runs=1 supersessions=0
```

```text
$ gh api "repos/jambolo/patch-steward-testbed-personal/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]'
["c5ae908e66ec9298048d6d0dbd54713930cb911e"]
```

Result: pass

## S17 repeated after the publication jobs declared deployment false

Date (UTC): 2026-09-28. The publication Environment is now declared with `deployment: false` in the called workflow's
job inside, as in the reusable screening workflow; the run URL is
https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36458938852.

```text
$ bash scenarios/tools/environment-check.sh jambolo/patch-steward-testbed-personal
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal result=ok
```

```text
$ bash scenarios/tools/secret-scope.sh run jambolo/patch-steward-testbed-personal
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=jambolo/patch-steward-testbed-personal branch=master existed=yes
DEPLOY commit=none reason=already-identical
DEPLOY push=none reason=nothing-to-push
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=3242cc52593044b07274fbf5b565f72ad01eecf1
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE repo=jambolo/patch-steward-testbed-personal run=36458938852 url=https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36458938852 result=pass
```

```text
$ gh api -H 'Accept: application/vnd.github.raw+json' "repos/jambolo/patch-steward-testbed-personal/contents/.github/workflows/scenario-secret-scope-called.yml?ref=master" | tr -d '\r' | grep -x -E '    environment:|      name: steward-publication|      deployment: false'
    environment:
      name: steward-publication
      deployment: false
```

```text
$ T=$(gh api "repos/jambolo/patch-steward-testbed-personal/actions/runs/36458938852" --jq .created_at); n=$(gh api "repos/jambolo/patch-steward-testbed-personal/deployments?environment=steward-publication&per_page=100" --paginate --jq ".[] | select(.created_at >= \"$T\") | .id" | wc -l | tr -d ' '); echo "DEPLOYMENTS repo=jambolo/patch-steward-testbed-personal environment=steward-publication since=$T count=$n"
DEPLOYMENTS repo=jambolo/patch-steward-testbed-personal environment=steward-publication since=2026-09-28T17:33:17Z count=0
```

Result: pass

## S13 observe mode writes nothing on submissions

Date (UTC): 2026-09-28. This test-bed has no scenario pull request.

```text
$ bash scenarios/tools/audit.sh jambolo/patch-steward-testbed-personal
AUDIT repo=jambolo/patch-steward-testbed-personal wrappers_deployed_at=2026-09-28T17:25:12Z source=history
AUDIT repo=jambolo/patch-steward-testbed-personal kind=issue number=9 app_comments=0 labels=0 app_check_runs=n/a requested_reviewers=n/a head_deployments=n/a before_fix_deployments=n/a
AUDIT repo=jambolo/patch-steward-testbed-personal submissions=1 app_comments=0 labels=0 app_check_runs=0 requested_reviewers=0 head_deployments=0 before_fix_deployments=0 result=clean
```

Result: pass

## S14 only gate and publish use the publication Environment; everything is pinned

Date (UTC): 2026-09-28. Only the `gate` and `publish` jobs declare the `steward-publication` Environment, in the
mapping form, and the deployed wrappers are pinned to the reusable workflow commit.

```text
$ bash scenarios/tools/pins.sh jambolo/patch-steward-testbed-personal
PINS repo=jambolo/patch-steward-testbed-personal check=wrapper-blobs ok
PINS repo=jambolo/patch-steward-testbed-personal check=pin-equal ok pin=15c6e6d73ae88f4d95a9e0233f9dee45ce3b9568
PINS repo=jambolo/patch-steward-testbed-personal check=pin-reachable ok status=identical
PINS repo=jambolo/patch-steward-testbed-personal check=environment-jobs ok jobs=gate,publish other_form=none
PINS repo=jambolo/patch-steward-testbed-personal check=secret-jobs ok jobs=gate,publish
PINS repo=jambolo/patch-steward-testbed-personal check=wrapper-mapping ok
PINS repo=jambolo/patch-steward-testbed-personal check=probe-names ok
PINS repo=jambolo/patch-steward-testbed-personal check=uses-pinned ok count=14
PINS repo=jambolo/patch-steward-testbed-personal pin=15c6e6d73ae88f4d95a9e0233f9dee45ce3b9568 result=pass
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
$ bash scenarios/tools/steady-state.sh jambolo/patch-steward-testbed-personal apply
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow scenario-secret-scope-called.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow scenario-secret-scope.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow steward-issues.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow steward-pr.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal result=steady active_workflows=0 open_submissions=0
```

```text
$ bash scenarios/tools/steady-state.sh jambolo/patch-steward-testbed-personal plan
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow scenario-secret-scope-called.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow scenario-secret-scope.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow steward-issues.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal workflow steward-pr.yml disabled_manually keep
SCENARIO-STEADY jambolo/patch-steward-testbed-personal result=planned active_workflows=0 open_submissions=0
```

```text
$ gh api "repos/jambolo/patch-steward-testbed-personal/actions/workflows?per_page=100" --paginate --jq '.workflows[] | select(.path == ".github/workflows/steward-pr.yml" or .path == ".github/workflows/steward-issues.yml" or (.path | startswith(".github/workflows/scenario-"))) | (.path | ltrimstr(".github/workflows/")) + " " + .state'
scenario-secret-scope-called.yml disabled_manually
scenario-secret-scope.yml disabled_manually
steward-issues.yml disabled_manually
steward-pr.yml disabled_manually
```
