- status: pass
- base: f3118acac83b6da0d40f94aae30fb6e723e3fa93
- changes: |
    scenarios/results/org-public.md: appended `## S04 body edit commits a new owner and supersedes the older run` section
    (one sentence on tries 1-3, then try 4 command groups a-d, then step-4 post-pass evidence commands); ran
    `pnpm exec prettier --write scenarios/results/org-public.md` after appending.
    development-artifacts/patch-steward-m6-5.13-report.md: this report.
- acceptance: |
    node -e 'const s=require("fs").readFileSync("development-artifacts/patch-steward-m6-5.13-report.md","utf8");const ok=[/^s04_try: [4-6]\s*$/m,/^s04_old_run: [0-9]+\s*$/m,/^s04_new_run: [0-9]+\s*$/m,/^s04_new_commit: [0-9a-f]{40}\s*$/m].every(r=>r.test(s));console.log(ok?"report ok":"report incomplete")'
    report ok

    R=steady-orchard/patch-steward-testbed-public; f=development-artifacts/patch-steward-m6-5.13-report.md; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); OLD=$(grep -m1 -o '^s04_old_run: [0-9]*' $f | cut -d' ' -f2); NEW=$(grep -m1 -o '^s04_new_run: [0-9]*' $f | cut -d' ' -f2); g1=$(bash scenarios/tools/run-log.sh $R $OLD 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); g2=$(bash scenarios/tools/run-log.sh $R $NEW 1 gate | grep -c -E '^LOG job=gate ts=[^ ]+ text=dedup commit '); p1=$(bash scenarios/tools/run-log.sh $R $OLD 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness superseded (newer-owner [0-9]+-[0-9]+|snapshot-changed)|- Status: `superseded`)$'); p2=$(bash scenarios/tools/run-log.sh $R $NEW 1 publish | grep -c -E '^LOG job=publish ts=[^ ]+ text=(freshness current|- Status: `needs-changes`)$'); s=$(bash scenarios/tools/run-records.sh runs $R steward-evidence $R pr $P | grep -c "^SUPERSESSION file=$OLD-1.json run=$OLD-1 reason="); [ "$g1$g2$p1$p2$s" = "11221" ] && echo "S04 pass" || echo "S04 not met $g1$g2$p1$p2$s"
    S04 pass

    R=steady-orchard/patch-steward-testbed-public; P=$(grep -m1 -o '^s01_pr: [0-9]*' development-artifacts/patch-steward-m6-5.11-report.md | cut -d' ' -f2); bash scenarios/tools/evidence.sh $R steward-evidence $R pr $P | grep -c -E "^EVIDENCE append_only=yes\$|^EVIDENCE target=$R subject=pr-$P runs=[0-9]+ verified=[0-9]+ result=ok\$"
    2

    bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none; S04 passed on the first try attempted (try 4, D=45s), so tries 5 and 6 were not needed, matching
    the step's "stop after the first S04 pass" instruction.

s04_try: 4
s04_old_run: 36416155582
s04_new_run: 36416239795
s04_new_commit: b5d11cdbe2bf5c4176e1b543a83d133537b4450e
