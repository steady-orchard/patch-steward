# Step 5.28

- id: 5.28
- depends_on: []
- route: mechanical
- objective: Make scenarios/tools/pins.sh accept the publication Environment only in the mapping form (`name: steward-publication` plus `deployment: false`) on exactly gate and publish, report any other declaration form, and add an optional local-file override for the reusable workflow text.
- files_in_scope:
    - scenarios/tools/pins.sh
    - development-artifacts/patch-steward-m6-5.28-report.md
- context: |
    Git Bash; run every command from your tree root. core.autocrlf=true (the working tree is CRLF; Git Bash runs CRLF
    scripts). jq is NOT installed. gh is logged in as jambolo. `gh api` endpoints never start with `/`. Never print a
    token or secret. Never run a formatter on development-artifacts/. This step makes NO GitHub write; its acceptance
    makes read-only GitHub requests to the org-public test-bed steady-orchard/patch-steward-testbed-public and to
    steady-orchard/patch-steward (check `gh api rate_limit --jq .resources.core.remaining` >= 500 first).

    scenarios/tools/pins.sh <owner/repo> (read-only) fetches the test-bed's deployed wrappers and the reusable workflow
    `.github/workflows/steward-screening.yml` of steady-orchard/patch-steward at the wrappers' pinned commit (variable
    `raw_screening`, CR-stripped), then prints eight `PINS repo=<r> check=<name> ok|FAIL [detail]` lines and a final
    `PINS repo=<r> pin=<pin> result=pass|fail`. Check 4 (`environment-jobs`) is computed by an awk program over
    `raw_screening` that today sets env[job] = 1 only for the exact line `    environment: steward-publication` (the
    string form) and passes when the jobs so marked are exactly `gate,publish` and neither wrapper contains
    `environment:`; its detail is `jobs=<list>`.

    New rule (binding): the reusable workflow's gate and publish now declare the Environment as the job-level mapping
        environment:
          name: steward-publication
          deployment: false
    (indentation 4, 6, 6; the string form makes GitHub Actions record a Deployment on pull request heads). Check 4
    passes only when the jobs whose `environment:` is exactly that mapping (the two child lines in either order, no
    other child line) are `gate,publish`, NO job declares an Environment in any other form (string form, or a mapping
    with a missing, different, or extra child line), and neither wrapper contains `environment:`. Detail becomes
    `jobs=<mapping-form jobs, sorted, comma-separated, or none> other_form=<other-form jobs, sorted, comma-separated, or none>`,
    e.g. `PINS repo=<r> check=environment-jobs ok jobs=gate,publish other_form=none` or
    `PINS repo=<r> check=environment-jobs FAIL jobs=none other_form=gate,publish`.
    New optional override: environment variable PINS_SCREENING_FILE=<path>. When set (non-empty), the tool reads the
    reusable workflow text from that local file (CR-stripped) instead of fetching it at the pin (a missing file is a read
    failure: `PINS repo=<r> error=read-failed what=screening-file`, exit 3); every other check is unchanged, and the
    final line carries ` screening=local` before ` result=`: `PINS repo=<r> pin=<pin> screening=local result=pass|fail`.
    Without the override every output line is unchanged except the check 4 detail.
    Checks 1-3 and 5-8, exit codes, and all other output stay exactly as they are.
- actions: |
    Verbatim blocks below sit between a line `BLOCK <name> BEGIN` and a line `BLOCK <name> END`; every line inside
    carries exactly 8 spaces of packet indentation that is NOT part of the code (remove exactly 8 spaces per line).
    1. Replace the four lines that start with `raw_screening="$(gh api -H` and end with
       `raw_screening="$(printf '%s' "$raw_screening" | strip_cr)"` (the fetch, `rc=$?`, the `[ "$rc" -eq 0 ] ...
       fail_read "screening"` line, and the CR strip) with:
    BLOCK fetch BEGIN
        screening_source=pinned
        if [ -n "${PINS_SCREENING_FILE:-}" ]; then
          [ -f "$PINS_SCREENING_FILE" ] || fail_read "screening-file"
          raw_screening="$(strip_cr < "$PINS_SCREENING_FILE")"
          screening_source=local
        else
          raw_screening="$(gh api -H 'Accept: application/vnd.github.raw+json' "repos/steady-orchard/patch-steward/contents/.github/workflows/steward-screening.yml?ref=$pin" 2> /dev/null)"
          rc=$?
          [ "$rc" -eq 0 ] && [ -n "$raw_screening" ] || fail_read "screening"
          raw_screening="$(printf '%s' "$raw_screening" | strip_cr)"
        fi
    BLOCK fetch END
    2. Replace the whole `job_info="$(printf '%s\n' "$raw_screening" | awk '` ... `')"` assignment and the following
       `env_list=...` line (keep the `sec_list=...` line and everything after it) with:
    BLOCK jobs BEGIN
        job_info="$(printf '%s\n' "$raw_screening" | awk '
          BEGIN { seen_jobs = 0; job = ""; inenv = 0 }
          /^jobs:$/ { seen_jobs = 1; next }
          seen_jobs && /^  [a-z][a-z0-9_-]*:$/ {
            job = $0
            sub(/^  /, "", job)
            sub(/:$/, "", job)
            decl[job] = 0; name[job] = 0; dep[job] = 0; extra[job] = 0; strf[job] = 0
            sec[job] = 0
            inenv = 0
            next
          }
          seen_jobs && job != "" {
            if (inenv && $0 ~ /^      /) {
              if ($0 == "      name: steward-publication") name[job] = 1
              else if ($0 == "      deployment: false") dep[job] = 1
              else extra[job] = 1
              next
            }
            inenv = 0
            if ($0 == "    environment:") { decl[job] = 1; inenv = 1; next }
            if ($0 ~ /^    environment:/) strf[job] = 1
            if ($0 ~ /secrets\.PATCH_STEWARD_APP_ID/ || $0 ~ /secrets\.PATCH_STEWARD_APP_PRIVATE_KEY/) sec[job] = 1
          }
          END {
            for (j in decl) {
              m = (decl[j] && name[j] && dep[j] && !extra[j] && !strf[j]) ? 1 : 0
              o = ((decl[j] || strf[j]) && !m) ? 1 : 0
              print "MAP|" j "|" m
              print "OTHER|" j "|" o
            }
            for (j in sec) print "SEC|" j "|" sec[j]
          }
        ')"
        
        env_list="$(printf '%s\n' "$job_info" | awk -F'|' '$1 == "MAP" && $3 == 1 { print $2 }' | sort | paste -sd, -)"
        other_list="$(printf '%s\n' "$job_info" | awk -F'|' '$1 == "OTHER" && $3 == 1 { print $2 }' | sort | paste -sd, -)"
    BLOCK jobs END
    3. In check 4 change the condition line to
       `if [ "$env_list" = "gate,publish" ] && [ -z "$other_list" ] && [ "$wrappers_have_environment" = no ]; then`
       and the print line to
       `print_check environment-jobs "$c4" "jobs=${env_list:-none} other_form=${other_list:-none}"`.
    4. Replace the final `if [ "$overall" = yes ]; then ... fi` block (the two result echo lines and exits) with:
    BLOCK result BEGIN
        suffix=""
        if [ "$screening_source" = local ]; then suffix=" screening=local"; fi
        if [ "$overall" = yes ]; then
          echo "PINS repo=$repo pin=$pin$suffix result=pass"
          exit 0
        else
          echo "PINS repo=$repo pin=$pin$suffix result=fail"
          exit 1
        fi
    BLOCK result END
    5. Update the header comment (no planning ids; keep it factual): check 4 requires gate and publish to declare the
       Environment steward-publication in the mapping form with `deployment: false` and no job to declare an Environment
       in any other form (the plain form makes GitHub Actions record a Deployment for the job); document the
       PINS_SCREENING_FILE override and the ` screening=local` marker on the final line. Keep all other comment lines.
    6. bash -n scenarios/tools/pins.sh must print nothing; then run the acceptance commands.
- acceptance: |
    Run each from the tree root in Git Bash (read-only GitHub requests only); each must give exactly the stated result.
    1. bash -n scenarios/tools/pins.sh; echo "syntax $?"
       -> prints exactly: syntax 0
    2. T=$(mktemp -d); git show 7161cd20df662314d14cc7f2f4130102baee1e98:.github/workflows/steward-screening.yml > "$T/string.yml"; node -e 'const fs=require("fs");const d=process.argv[1];const s=fs.readFileSync(d+"/string.yml","utf8").replace(/\r\n/g,"\n");const k="    environment: steward-publication\n";if(s.split(k).length!==3)throw new Error("form");fs.writeFileSync(d+"/mapping.yml",s.split(k).join("    environment:\n      name: steward-publication\n      deployment: false\n"));fs.writeFileSync(d+"/name-only.yml",s.split(k).join("    environment:\n      name: steward-publication\n"))' "$T"; for v in string mapping name-only; do PINS_SCREENING_FILE="$T/$v.yml" bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-public > "$T/$v.out"; grep ' check=environment-jobs ' "$T/$v.out"; done; cat "$T"/*.out | grep -c -E '^PINS repo=steady-orchard/patch-steward-testbed-public pin=[0-9a-f]{40} screening=local result=(pass|fail)$'; rm -rf "$T"
       -> prints exactly four lines:
          PINS repo=steady-orchard/patch-steward-testbed-public check=environment-jobs FAIL jobs=none other_form=gate,publish
          PINS repo=steady-orchard/patch-steward-testbed-public check=environment-jobs ok jobs=gate,publish other_form=none
          PINS repo=steady-orchard/patch-steward-testbed-public check=environment-jobs FAIL jobs=none other_form=gate,publish
          3
    3. PINS_SCREENING_FILE=/nonexistent/steward-screening.yml bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-public; echo "exit $?"
       -> prints exactly two lines: PINS repo=steady-orchard/patch-steward-testbed-public error=read-failed what=screening-file, exit 3
    4. bash scenarios/tools/pins.sh steady-orchard/patch-steward-testbed-public | grep -c -E '^PINS repo=steady-orchard/patch-steward-testbed-public check=(wrapper-blobs|pin-equal|pin-reachable|environment-jobs|secret-jobs|wrapper-mapping|probe-names|uses-pinned) (ok|FAIL)( |$)'
       -> prints exactly: 8
    5. git grep -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|owner decision' -- scenarios/tools/pins.sh; echo "exit $?"
       -> prints exactly: exit 1
- rollback: |
    git revert <this step's commit> (tool only; nothing was written to GitHub).
