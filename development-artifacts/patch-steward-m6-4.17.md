# Step 4.17

- id: 4.17
- depends_on: [4.15, 4.6, 4.7, 4.8]
- route: mechanical
- objective: Re-verify the owner's publication Environment on org-public, then run one end-to-end hosted screening smoke there (an unstructured `[scenario S00]` issue) and record verbatim evidence that build, gate, and publish succeeded, one ownership artifact exists, one evidence commit on `steward-evidence` holds a run directory that verifies, the publish summary was written after that commit, and nothing was written on the issue.
- files_in_scope:
    - development-artifacts/patch-steward-m6-4.17-report.md
- context: |
    Repo root in Git Bash (run every command from your tree root). jq is NOT installed (use `gh --jq` or node). core.autocrlf=true.
    Change NO file except this step's report. R = steady-orchard/patch-steward-testbed-public (the org-public test-bed; public;
    default branch master). The previous step deployed there `.github/workflows/steward-issues.yml` (calls the reusable workflow
    at the pushed steward commit; runs only for sender id 2095171, the local gh user jambolo, or the test App's bot 331019482)
    and `.github/patch-steward/policy.yml` (all observe; evidence store orphan branch `steward-evidence`).

    Owner action OA1 (binding rule): immediately before the first run that uses the Environment, re-run the brief's OA1 verify
    commands for R and compare literally. These four commands, verbatim, with their expected outputs:
      gh api repos/steady-orchard/patch-steward-testbed-public/environments/steward-publication/secrets --jq '[.secrets[].name] | sort'
        -> ["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"]
      gh api repos/steady-orchard/patch-steward-testbed-public/environments/steward-publication/deployment-branch-policies --jq '[.branch_policies[].name]'
        -> ["master"]
      gh api repos/steady-orchard/patch-steward-testbed-public/actions/secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
        -> []
      gh api repos/steady-orchard/patch-steward-testbed-public/actions/organization-secrets --jq '[.secrets[].name | select(startswith("PATCH_STEWARD_"))]'
        -> []
    If ANY output differs: STOP before creating anything, set report status fail, record the four commands and outputs
    verbatim, and add the line `OA1 not done on steady-orchard/patch-steward-testbed-public: <command> printed <output>` (the
    supervisor turns this into a needs-human escalation). These print secret NAMES only; never print or read a secret value.

    Expected behavior of the smoke (observe mode, contract level): the issue body follows no issue form, so the gate's contract
    check ends early (disposition early-exit), the gate commits (uploads steward-handoff and the ownership artifact
    `steward-ownership-issue-<n>`), and publish commits one evidence commit to `steward-evidence` (the branch does not exist
    before the first run, so the first commit is a root commit) holding the run directory
    `steady-orchard/patch-steward-testbed-public/runs/issue-<n>/<run_id>-1/` with outcome needs-changes plus the metrics file,
    re-lists ownership after a 10 s settle delay, finds itself the newest owner, recaptures, and ends freshness current. It
    writes NO comment, label, check, or anything else on the issue. The run's jobs are listed as `screen / build`,
    `screen / gate`, `screen / publish`. Each core step prints its log lines (including `evidence commit <sha> rebuilds <n>` in
    publish) and then `steward job summary:` followed by the job summary lines (`- Status: ...`, `- Evidence: commit
    <backtick><sha><backtick> at ...`, `- Freshness: <backtick>current<backtick>`); because the summary names the evidence
    commit, it was written after that commit existed.

    Tools (read their header comments): scenarios/tools/find-runs.sh, artifacts.sh, evidence.sh (needs `pnpm build`),
    audit.sh; probes/smoke/tools/wait-run.sh. Budgets: poll no more often than every 20 s; wait at most 15 min for the run; stop
    if `gh api rate_limit --jq .resources.core.remaining` is below 500. Create exactly ONE issue in this step; never close,
    edit, or delete it (closing would start a closure run; the scenario suite closes it later), never rerun the workflow, never
    create a second issue: on any failure, collect evidence and STOP with status fail.
- actions: |
    1. Base check (files changed in steps 4.6-4.8 and the deployment of step 4.15): bash -c 'for f in scenarios/tools/find-runs.sh scenarios/tools/artifacts.sh scenarios/tools/evidence.sh scenarios/tools/audit.sh scenarios/fixtures/submissions/unstructured.txt; do [ -f "$f" ] || echo "MISSING $f"; done; l=$(git rev-parse HEAD:scenarios/workflows/steward-issues.yml); d=$(gh api "repos/steady-orchard/patch-steward-testbed-public/contents/.github/workflows/steward-issues.yml?ref=master" --jq .sha); [ -n "$l" ] && [ "$l" = "$d" ] && echo "base ok" || echo "MISSING deployed wrapper"'
       It must print exactly `base ok`; otherwise STOP and report status missing-base with the output.
    2. pnpm install --frozen-lockfile && pnpm build (evidence.sh verifies with the built CLI). Check the rate limit (>= 500).
    3. OA1 verify: run the four commands in context verbatim, record commands and outputs verbatim in a report section
       `## OA1 verify (org-public)`. Any difference -> STOP per context.
    4. Pre-state (record verbatim): `bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue 1`
       and `bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public`.
    5. Create the smoke issue (exactly once) and record the printed URL and the UTC time:
       gh issue create -R steady-orchard/patch-steward-testbed-public --title "[scenario S00] hosted screening smoke" --body-file scenarios/fixtures/submissions/unstructured.txt
       N = the issue number at the end of the URL.
    6. Find the run: repeat up to 15 times, sleeping 20 s before each try:
       bash scenarios/tools/find-runs.sh steady-orchard/patch-steward-testbed-public steward-issues.yml "steward issue N author "
       until count >= 1. Expect exactly one run with event=issues and title `steward issue N author 2095171 event issues opened
       sender 2095171 User`. RUN = its id. None after 15 tries -> STOP (fail) with the last output and
       `gh run list -R steady-orchard/patch-steward-testbed-public --workflow steward-issues.yml --limit 5`.
    7. Wait: PROBE_WAIT_SECONDS=900 bash probes/smoke/tools/wait-run.sh steady-orchard/patch-steward-testbed-public RUN
       Record the output (a timeout, exit 3, -> STOP fail).
    8. Jobs: gh run view RUN -R steady-orchard/patch-steward-testbed-public --json jobs --jq '[.jobs[] | .name + "=" + .conclusion] | sort | join(",")'
       Expected exactly: screen / build=success,screen / gate=success,screen / publish=success
       Otherwise record `gh run view RUN -R steady-orchard/patch-steward-testbed-public --log-failed | head -200` and STOP (fail).
    9. Ownership artifact: bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public steward-ownership-issue-N
       Expected: exactly one ARTIFACT line, with run_id=RUN and expired=false, and `count=1 unexpired=1`.
    10. Evidence: bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue N
        Expected: `append_only=yes`; exactly one run line `EVIDENCE run=RUN-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0`;
        final `... subject=issue-N runs=1 verified=1 result=ok`. Then
        gh api "repos/steady-orchard/patch-steward-testbed-public/commits?sha=steward-evidence&path=steady-orchard/patch-steward-testbed-public/runs/issue-N&per_page=100" --jq '[.[].sha]'
        must list exactly one commit: C (the evidence commit). Record `gh api repos/steady-orchard/patch-steward-testbed-public/git/commits/C --jq '.committer.date + " parents=" + (.parents | length | tostring)'`.
    11. Summary after the commit: save `gh run view RUN -R steady-orchard/patch-steward-testbed-public --log` to a temp file
        (outside the repository; delete it afterwards) and run acceptance 5's node check on it; also copy into the report
        (verbatim, at most 60 lines) the publish job lines from `evidence commit` through the end of the printed summary, and the
        gate job's summary lines (expected `- Status: <backtick>early-exit<backtick>` and `- Owner: committed ...`). Record the
        log timestamp of the publish `steward job summary:` line next to C's committer date (the summary is later).
    12. Observe audit: bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public
        Expected: a line `kind=issue number=N app_comments=0 labels=0 ...` and final `result=clean`. Also record
        `gh api repos/steady-orchard/patch-steward-testbed-public/issues/N/comments --jq length` (expected 0).
    13. Leave issue N OPEN. Write the report. It MUST contain these lines starting at column 0: `smoke_issue: N`,
        `smoke_run: RUN`, `evidence_commit: C` (numbers and 40-hex SHA filled in), the OA1 section, and every command above with
        its verbatim output. Add a section `## Test-bed state after the smoke`: issue N open; steward-pr.yml and
        steward-issues.yml active on the three test-beds; `steward-evidence` on org-public holds the smoke commit(s); nothing
        deployed or run on personal and org-private.
- acceptance: |
    Run each from the tree root in Git Bash (read-only; the report provides N, RUN, C); each must give exactly the stated result.
    1. node -e "const s=require('fs').readFileSync('development-artifacts/patch-steward-m6-4.17-report.md','utf8');const need=['environments/steward-publication/secrets','environments/steward-publication/deployment-branch-policies','actions/secrets','actions/organization-secrets','[\"PATCH_STEWARD_APP_ID\",\"PATCH_STEWARD_APP_PRIVATE_KEY\"]','[\"master\"]'];const miss=need.filter(t=>!s.includes(t));const ids=/^smoke_issue: [0-9]+\s*$/m.test(s)&&/^smoke_run: [0-9]+\s*$/m.test(s)&&/^evidence_commit: [0-9a-f]{40}\s*$/m.test(s);console.log(!miss.length&&ids&&!s.includes('OA1 not done')?'report ok':'report incomplete '+JSON.stringify(miss))"
       -> prints exactly: report ok
    2. bash -c 'f=development-artifacts/patch-steward-m6-4.17-report.md; run=$(grep -m1 -o "^smoke_run: [0-9]*" $f | cut -d" " -f2); gh run view "$run" -R steady-orchard/patch-steward-testbed-public --json jobs --jq "[.jobs[] | .name + \"=\" + .conclusion] | sort | join(\",\")"'
       -> prints exactly: screen / build=success,screen / gate=success,screen / publish=success
    3. bash -c 'f=development-artifacts/patch-steward-m6-4.17-report.md; n=$(grep -m1 -o "^smoke_issue: [0-9]*" $f | cut -d" " -f2); run=$(grep -m1 -o "^smoke_run: [0-9]*" $f | cut -d" " -f2); bash scenarios/tools/artifacts.sh steady-orchard/patch-steward-testbed-public "steward-ownership-issue-$n" | grep -c -E " expired=false run_id=$run size=|count=1 unexpired=1$"'
       -> prints exactly: 2
    4. bash -c 'f=development-artifacts/patch-steward-m6-4.17-report.md; n=$(grep -m1 -o "^smoke_issue: [0-9]*" $f | cut -d" " -f2); run=$(grep -m1 -o "^smoke_run: [0-9]*" $f | cut -d" " -f2); bash scenarios/tools/evidence.sh steady-orchard/patch-steward-testbed-public steward-evidence steady-orchard/patch-steward-testbed-public issue "$n" | grep -c -E "^EVIDENCE append_only=yes$|^EVIDENCE run=$run-1 kind=outcome outcome=needs-changes manifest=verified metrics=verified errors=0$|^EVIDENCE target=steady-orchard/patch-steward-testbed-public subject=issue-$n runs=1 verified=1 result=ok$"'
       -> prints exactly: 3
    5. bash -c 'f=development-artifacts/patch-steward-m6-4.17-report.md; run=$(grep -m1 -o "^smoke_run: [0-9]*" $f | cut -d" " -f2); c=$(grep -m1 -o "^evidence_commit: [0-9a-f]*" $f | cut -d" " -f2); T=$(mktemp -d); gh run view "$run" -R steady-orchard/patch-steward-testbed-public --log > "$T/log.txt"; node -e "const fs=require(\"fs\");const [f,c]=process.argv.slice(1);const B=String.fromCharCode(96);const L=fs.readFileSync(f,\"utf8\").split(\"\n\");const txt=L.filter(l=>l.split(\"\t\")[0].endsWith(\"publish\")).map(l=>l.split(\"\t\").slice(2).join(\"\t\").replace(/^\S+ /,\"\"));const at=s=>txt.findIndex(t=>t.startsWith(s));const iC=at(\"evidence commit \"+c),iH=at(\"steward job summary:\"),iE=at(\"- Evidence: commit \"+B+c+B),iS=at(\"- Status: \"+B+\"needs-changes\"+B),iF=at(\"- Freshness: \"+B+\"current\"+B);const bad=L.filter(l=>l.includes(\"-----BEGIN\")||/gh[pousr]_[A-Za-z0-9]{20,}/.test(l)).length;console.log(c.length===40&&iC>=0&&iH>iC&&iE>iH&&iS>iH&&iF>iH&&bad===0?\"summary after commit\":\"summary check failed \"+JSON.stringify({iC,iH,iE,iS,iF,bad}))" "$T/log.txt" "$c"; rm -rf "$T"'
       -> prints exactly: summary after commit
    6. bash -c 'f=development-artifacts/patch-steward-m6-4.17-report.md; n=$(grep -m1 -o "^smoke_issue: [0-9]*" $f | cut -d" " -f2); bash scenarios/tools/audit.sh steady-orchard/patch-steward-testbed-public | grep -c -E "^AUDIT repo=steady-orchard/patch-steward-testbed-public kind=issue number=$n app_comments=0 labels=0 |result=clean$"; gh issue view "$n" -R steady-orchard/patch-steward-testbed-public --json state,title --jq ".state + \" \" + .title"'
       -> prints exactly two lines: 2, then OPEN [scenario S00] hosted screening smoke
- rollback: |
    Nothing to revert in the repository (report only). The smoke issue stays open (never deleted); the ownership artifact expires
    after its retention; the evidence commit stays (append-only store). If the smoke must be repeated, a later step creates a new
    `[scenario S00]` issue; it never deletes or edits this one.
