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
