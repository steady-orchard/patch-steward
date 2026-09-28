- status: pass
- base: 0c1be99dd8d5b2ff89f860a81d7f993ebbabb590
- changes: |
    Created scenarios/results/org-private.md documenting S17 (publication Environment secret-scope delivery check on
    steady-orchard/patch-steward-testbed-private) and S16 (one contract-met issue screened and published to the separate
    evidence repository steady-orchard/patch-steward-testbed-evidence, also proving OA3). No product code changed.

s17_run: 36409910597
s16_issue: 9
s16_run: 36410002176
s16_commit: 40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3

## OA1 verify (org-private)

```text
$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-private
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private check=organization-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok
```

OA1 done: last line is `ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok`.

## OA2 verify

```text
$ gh api repos/steady-orchard/patch-steward-testbed-evidence --jq '[.private, .size >= 0]'
[true,true]
$ gh api repos/steady-orchard/patch-steward-testbed-evidence/commits --jq length
1
```

OA2 done: `[true,true]` and count `1` (>= 1).

## S17 (secret-scope)

```text
$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-private
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=steady-orchard/patch-steward-testbed-private branch=master existed=yes
DEPLOY commit=7a01c1e9b707648e733fb24d12acc55dcc2b779d message=scenario: deploy secret-scope pair
DEPLOY push=ok attempt=1 head=7a01c1e9b707648e733fb24d12acc55dcc2b779d
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=9020f1a58702ee33bab4f83555a6e5ba9fb00168
SECRET-SCOPE job=outside line=^[[36;1mecho "PATCH_STEWARD_APP_ID length-zero=$id_empty"^[[0m
SECRET-SCOPE job=outside line=^[[36;1mecho "PATCH_STEWARD_APP_PRIVATE_KEY length-zero=$key_empty"^[[0m
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE job=inside line=^[[36;1mecho "PATCH_STEWARD_APP_ID length-zero=$id_empty"^[[0m
SECRET-SCOPE job=inside line=^[[36;1mecho "PATCH_STEWARD_APP_PRIVATE_KEY length-zero=$key_empty"^[[0m
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE repo=steady-orchard/patch-steward-testbed-private run=36409910597 url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36409910597 result=pass
```

The DISPATCH run_id was not printed as a distinct line by this build of the tool; S17_RUN is taken from the run id in the
final `SECRET-SCOPE repo=... run=<id> url=... result=pass` line (36409910597), which is the same run the `outside`/`inside`
job logs and the workflow run URL confirm.

## S16 (contract-met issue)

```text
$ gh api repos/steady-orchard/patch-steward-testbed-private/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"
target store branch exit 1
$ A=$(gh api "repos/steady-orchard/patch-steward-testbed-private/actions/runs?per_page=1" --jq '.workflow_runs[0].id // 0'); echo "A=$A"
A=36409910597
$ gh issue create -R steady-orchard/patch-steward-testbed-private --title "[scenario S16] contract-met issue" --body-file fixtures/submissions/defect-complete.txt
https://github.com/steady-orchard/patch-steward-testbed-private/issues/9
$ date -u +%Y-%m-%dT%H:%M:%SZ
2026-09-28T10:29:19Z
$ bash scenarios/tools/await-runs.sh steady-orchard/patch-steward-testbed-private steward-issues.yml "steward issue 9 author 2095171 event issues opened sender 2095171 User" 36409910597 1
RUN id=36410002176 attempt=1 event=issues status=completed conclusion=success created_at=2026-09-28T10:29:22Z url=https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36410002176 title=steward issue 9 author 2095171 event issues opened sender 2095171 User
AWAIT repo=steady-orchard/patch-steward-testbed-private workflow=steward-issues.yml after=36409910597 count=1 completed=1 result=complete
$ gh run view 36410002176 -R steady-orchard/patch-steward-testbed-private --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
screen / build=success,screen / gate=success,screen / publish=success
$ gh api "repos/steady-orchard/patch-steward-testbed-evidence/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]'
["40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3"]
$ bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-evidence steward-evidence steady-orchard/patch-steward-testbed-private issue 9
EVIDENCE store=steady-orchard/patch-steward-testbed-evidence branch=steward-evidence tip=40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3 commits=1
EVIDENCE commit=40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3 parents=0 added=9 other=0
EVIDENCE append_only=yes
EVIDENCE run=36410002176-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0
EVIDENCE target=steady-orchard/patch-steward-testbed-private subject=issue-9 runs=1 verified=1 result=ok
$ bash scenarios/tools/run-records.sh runs steady-orchard/patch-steward-testbed-evidence steward-evidence steady-orchard/patch-steward-testbed-private issue 9
RECORD run=36410002176-1 kind=outcome outcome=inconclusive run_id=36410002176 run_attempt=1 policy_revision=82e7de77b61c61c22193765687b53264af57b814 snapshot=sha256:6ca84fc3fe9a4e9c8a29b47b5ed31df232f271e0de718e87be447ef374f5af0f findings=none
RECORDS store=steady-orchard/patch-steward-testbed-evidence branch=steward-evidence target=steady-orchard/patch-steward-testbed-private subject=issue-9 runs=1 supersessions=0
$ gh api repos/steady-orchard/patch-steward-testbed-private/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"
target store branch exit 1
```

## OA3 proof

Signal (a): the first attempt of the new issue's `opened` event logged `listing none` and `dedup commit no-owner` in the gate
job, and the gate job completed with conclusion `success` (mint of a read token for E and the published-snapshot fallback
read succeeded silently, as no product log line names token repositories):

```text
LOG job=gate ts=2026-09-28T10:29:57.3964438Z text=listing none
LOG job=gate ts=2026-09-28T10:29:57.3973406Z text=dedup commit no-owner
```

Signal (b): the publish job minted a write token for E and committed there, logging `evidence commit <sha> rebuilds <n>`,
and the commit is present on E's `steward-evidence` branch:

```text
LOG job=publish ts=2026-09-28T10:30:20.5276273Z text=evidence commit 40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3 rebuilds 0
```

```text
$ gh api "repos/steady-orchard/patch-steward-testbed-evidence/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]'
["40a346cc9a7a1a45a306a5bea51f2d8c5f0df6f3"]
```

Both signals present and no OA3-missing failure lines (`ownership.listing-unavailable`, `github.not-found`,
`github.unauthorized`, `app-auth.token-scope-mismatch`) appeared; OA3 is proven.

- acceptance: |
    $ node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.9-report.md","utf8");const ok=[/^s17_run: [0-9]+\s*$/m,/^s16_issue: [0-9]+\s*$/m,/^s16_run: [0-9]+\s*$/m,/^s16_commit: [0-9a-f]{40}\s*$/m].every(r=>r.test(s))&&!/OA[123] not done/.test(s);console.log(ok?"report ok":"report incomplete")'
    report ok

    $ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-private | tail -n 1; gh api repos/steady-orchard/patch-steward-testbed-evidence --jq '[.private, .size >= 0]'
    ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private result=ok
    [true,true]

    $ f=development-artifacts/patch-steward-m6-5.9-report.md; run=$(grep -m1 -o '^s17_run: [0-9]*' $f | cut -d' ' -f2); for j in outside inside; do bash scenarios/tools/run-log.sh steady-orchard/patch-steward-testbed-private "$run" 1 $j; done | grep -c -x -E 'LOG job=outside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=true|LOG job=inside ts=[^ ]+ text=PATCH_STEWARD_APP_(ID|PRIVATE_KEY) length-zero=false'; gh run view "$run" -R steady-orchard/patch-steward-testbed-private --log | grep -c -e '-----BEGIN'
    4
    0

    $ f=development-artifacts/patch-steward-m6-5.9-report.md; Q=steady-orchard/patch-steward-testbed-private; run=$(grep -m1 -o '^s16_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s16_commit: [0-9a-f]*' $f | cut -d' ' -f2); gh run view "$run" -R $Q --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'; bash scenarios/tools/run-log.sh $Q "$run" 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=(listing none|dedup commit no-owner|disposition runnable|caps within daily [0-9]+ of 50 author [0-9]+ of 2)$'; bash scenarios/tools/run-log.sh $Q "$run" 1 publish | grep -c -E "^LOG job=publish ts=[^ ]+ text=(evidence commit $c rebuilds [0-9]+|freshness current|- Status: \`inconclusive\`)\$"
    screen / build=success,screen / gate=success,screen / publish=success
    4
    3

    $ f=development-artifacts/patch-steward-m6-5.9-report.md; Q=steady-orchard/patch-steward-testbed-private; E=steady-orchard/patch-steward-testbed-evidence; n=$(grep -m1 -o '^s16_issue: [0-9]*' $f | cut -d' ' -f2); run=$(grep -m1 -o '^s16_run: [0-9]*' $f | cut -d' ' -f2); c=$(grep -m1 -o '^s16_commit: [0-9a-f]*' $f | cut -d' ' -f2); bash scenarios/tools/evidence.sh $E steward-evidence $Q issue "$n" | grep -c -E "^EVIDENCE append_only=yes\$|^EVIDENCE run=$run-1 kind=outcome outcome=inconclusive manifest=verified metrics=verified errors=0\$|^EVIDENCE target=$Q subject=issue-$n runs=1 verified=1 result=ok\$"; gh api "repos/$E/commits?sha=steward-evidence&per_page=5" --jq '[.[].sha]' | grep -c "$c"; gh api repos/$Q/git/ref/heads/steward-evidence > /dev/null 2>&1; echo "target store branch exit $?"
    3
    1
    target store branch exit 1

    $ node -e '...' (results ok check); bash scenarios/tools/results-check.sh scenarios/results/org-private.md S16 S17 | tail -n 1
    results ok
    RESULTS-CHECK file=scenarios/results/org-private.md result=pass
- deviations: |
    The secret-scope.sh output in this environment did not print a separate `DISPATCH run_id=<id> url=...` line as the
    context description implies; the run id was instead read from the final `SECRET-SCOPE repo=... run=<id> ...` summary
    line, which names the same run confirmed by the outside/inside job logs. No other deviation.
