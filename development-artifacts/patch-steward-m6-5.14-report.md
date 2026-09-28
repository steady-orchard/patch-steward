- status: pass
- base: 90d3b9e2749eae59dd3a442a08d4411c85f83310
- changes: |
    scenarios/results/org-public.md: appended `## S08 evidence is written before the job summary` section, showing for
    the S01 run (36412442107) and the S04 newer run (36416239795) the publish log lines for `evidence commit ... rebuilds`,
    `freshness ...`, `steward job summary:`, and the summary body lines, each run's evidence commit committer date
    (`gh api .../git/commits/<sha> --jq .committer.date`), and the S08 order check line for both runs (order=ok, order=ok).
    Ran prettier on the results file and results-check for S01 S02 S03 S04 S08 S09 S17 (pass). No GitHub write made.
- acceptance: |
    $ R=steady-orchard/patch-steward-testbed-public; a=development-artifacts/patch-steward-m6-5.11-report.md; b=development-artifacts/patch-steward-m6-5.13-report.md; for pair in "$(grep -m1 -o '^s01_run: [0-9]*' $a | cut -d' ' -f2) $(grep -m1 -o '^s01_commit: [0-9a-f]*' $a | cut -d' ' -f2)" "$(grep -m1 -o '^s04_new_run: [0-9]*' $b | cut -d' ' -f2) $(grep -m1 -o '^s04_new_commit: [0-9a-f]*' $b | cut -d' ' -f2)"; do set -- $pair; run=$1; c=$2; d=$(gh api repos/$R/git/commits/$c --jq .committer.date); bash scenarios/tools/run-log.sh $R $run 1 publish | node -e '...'; done
    order ok
    order ok

    $ grep -c -E '^S08 run=[0-9]+ commit=[0-9a-f]{40} committed_at=\S+ summary_at=\S+ order=ok' scenarios/results/org-public.md
    2

    $ bash scenarios/tools/results-check.sh scenarios/results/org-public.md S01 S02 S03 S04 S08 S09 S17 | tail -n 1
    RESULTS-CHECK file=scenarios/results/org-public.md result=pass
- deviations: none
