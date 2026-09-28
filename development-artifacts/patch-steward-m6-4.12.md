# Step 4.12

- id: 4.12
- depends_on: [4.5, 4.6, 4.7, 4.8, 4.9]
- route: mechanical
- objective: Write scenarios/README.md, the persistent guide to the test-bed scenario suite: layout, test-beds, prerequisites, safety rules, budgets, setup and deployment, one procedure per scenario S00-S17, and the steady state.
- files_in_scope:
    - scenarios/README.md
    - development-artifacts/patch-steward-m6-4.12-report.md
- context: |
    Repo root in Git Bash. core.autocrlf=true. Prettier checks Markdown (printWidth 132, proseWrap preserve); run
    `pnpm exec prettier --write scenarios/README.md` after writing (it aligns tables). Never run a formatter on development-artifacts/.

    PERSISTENCE RULES (binding; the acceptance greps enforce them): scenarios/README.md is a persistent document. It must NOT
    contain: planning identifiers (milestone ids like M06, PD ids, gate or rule ids made of two capital letters and a digit such
    as the owner-action, ownership, dedup, event, run-name, cap, store, layout, waiting, supersession, resolution, workflow,
    token, or scenario-rule ids), the phrase "owner decision", step or phase numbers, the word "milestone", the text
    "development-artifacts", "deferred.md", or any DF id. Scenario ids S00-S17 ARE allowed (they name the suite's scenarios,
    and issue titles carry them). It must never write the probe suite's App secret names (STEWARD_APP_ plus ID, PRIVATE_KEY,
    or CLIENT_ID without the PATCH_ prefix): call them only "the probe suite's App secrets". It may cite probes/ files and the
    PA identifiers (e.g. PA02.5). American spelling. Describe only what exists; do not describe checks, comments, labels,
    stages, containers, or model calls as working (the hosted steward is an observe-mode, contract-level skeleton).

    Facts to state (all binding):
    - Purpose: a suite that demonstrates GitHub-hosted screening (wrapper workflows calling the reusable workflow
      `.github/workflows/steward-screening.yml` with jobs build, gate, publish, in observe mode at contract level) on dedicated
      test-bed repositories. Not product code, not a workspace package, never runs in CI; steward workflows run only on the
      three test-beds below, never in this repository and never on any other repository.
    - Layout: README.md; tools/*.sh (bash plus gh; they reuse probes/smoke/tools/deploy.sh, dispatch.sh, wait-run.sh by path);
      workflows/steward-pr.yml and workflows/steward-issues.yml (test-bed copies of templates/workflows/*: pinned to a pushed
      steward commit, `steward_ref` equal to the pin, plus a sender guard `if:` on job `screen` allowing only user id 2095171 and
      the test App's bot user id 331019482, because the public test-beds accept events from anyone; the guard is not part of the
      templates); workflows/scenario-secret-scope.yml and workflows/scenario-secret-scope-called.yml (the secret-scope pair);
      fixtures/policies/orphan-branch.yml and fixtures/policies/repository-store.yml (test-bed policies: all observe, no llm
      section); fixtures/submissions/*.txt (submission bodies); results/<test-bed key>.md (verbatim evidence per test-bed, in
      `text` fences, like the probe results).
    - Test-beds (table: key, repository, visibility, evidence store): org-public steady-orchard/patch-steward-testbed-public,
      public, orphan branch `steward-evidence`; personal jambolo/patch-steward-testbed-personal, public, orphan branch
      `steward-evidence`; org-private steady-orchard/patch-steward-testbed-private, private, repository
      steady-orchard/patch-steward-testbed-evidence branch `steward-evidence`. Plus the fork jambolo/patch-steward-testbed-public:
      pull-request-head fixture only (no workflow enabled, App not installed, no policy; the live tests rely on it having no
      published policy).
    - Prerequisites, managed by the repository owner (the suite never changes them): the test App installed on each test-bed
      (and on the evidence repository); on each test-bed the Environment `steward-publication` with deployment branches
      restricted to `master` and the Environment secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` (never
      repository or organization secrets of those names); the private evidence repository with at least one commit. Check with
      `bash scenarios/tools/environment-check.sh <owner/repo>` (prints secret names only). The probe suite's App secrets stay
      untouched and nothing here reads them.
    - Safety rules: steward and scenario workflows run only for the allowlisted senders; no pull request head is checked out or
      executed; no event text passes through `${{ }}` into `run:`; only `actions/*` actions pinned by full commit SHA; never
      print tokens or secrets (the secret-scope check prints only length-zero booleans); never delete repositories or issues;
      never force-push; test-bed `master` changes only through deploys (probes/smoke/tools/deploy.sh); every test-bed write is
      a standalone `gh` command or a tool listed here. Naming: issue and pull request titles start `[scenario S<nn>]`; branches
      `scenario-s<nn>-*`.
    - Budgets: poll no more often than every 20 s; wait at most 15 min per run; stop when the core rate limit remaining is
      below 500; org-private at most 30 billed Actions minutes for the whole suite.
    - Tools (one bullet each, with its exact usage line and what it prints; read each script's header comment for details):
      `bash scenarios/tools/deploy-steward.sh <org-public|personal|org-private> [<policy file>]`;
      `bash scenarios/tools/environment-check.sh <owner/repo>`;
      `bash scenarios/tools/find-runs.sh <owner/repo> <workflow file name> <display title prefix>`;
      `bash scenarios/tools/artifacts.sh <owner/repo> <artifact name>`;
      `bash scenarios/tools/evidence.sh <store owner/repo> <branch> <target owner/repo> <pr|issue> <number>` (and the
      `--local <store root directory>` form); `bash scenarios/tools/audit.sh <owner/repo> [<title prefix>]`;
      `bash scenarios/tools/secret-scope.sh check|run <owner/repo>`; `bash scenarios/tools/steady-state.sh <owner/repo> plan|apply`.
      evidence.sh needs `pnpm build` first (it verifies run directories with `steward report --json`).
    - Setup: push the steward commit the test-beds will pin; create the test-bed wrapper copies from templates/workflows/ by
      replacing both placeholder SHAs with that commit and adding the sender guard; validate the policies with `node
      packages/cli/dist/main.js policy --file <policy>`; deploy with deploy-steward.sh per test-bed; confirm the deployed blob ids
      equal `git rev-parse HEAD:<path>` (never compare working-tree bytes: line endings differ on Windows) and that the pin is
      reachable on GitHub. Ownership artifacts are named `steward-ownership-pr-<n>` or `steward-ownership-issue-<n>`; run
      display titles read `steward <pr|issue> <n> author <id> event <event> <action> sender <id> <type>`; in the run's job
      list the jobs appear as `screen / build`, `screen / gate`, `screen / publish`; each core step prints its job summary into
      the log after the steward finishes.
    - Procedures: one subsection per scenario, each with procedure, pass condition, and the tools used, for exactly these ids:
      S00 (org-public smoke: open an unstructured issue with fixtures/submissions/unstructured.txt; pass: build, gate, publish
      succeed; one ownership artifact; one evidence commit whose run directory verifies; the publish summary in the log names
      the evidence commit; audit clean); then S01-S17 with the procedure and pass condition of this table (rephrase freely,
      keep every pass condition):
        S01 org-public: open an unstructured PR; one ownership artifact; one run directory with outcome needs-changes; publish
            summary after evidence.
        S02 org-public: edit the S01 PR title only; disposition duplicate; artifact count unchanged; no new run directory.
        S03 org-public: title edit by the test App (helper workflow, sender is the bot); disposition duplicate; nothing committed.
        S04 org-public: edit the PR body twice within about 5 s; the newer run commits and publishes; the older run has a
            supersession record (newer-owner or snapshot-changed); retry up to 3 times until the runs overlap.
        S05 org-public: three body edits in quick succession; exactly one non-superseded outcome for the newest owner; every
            other committed run superseded or its pending publish replaced; every evidence commit since S01 only adds files.
        S06 org-public: deploy an invalid policy, edit a body, restore the policy; gate fails before commitment; listing
            unchanged; previous newest owner still newest; no evidence for that run.
        S07 org-public: point the evidence store at a repository the App cannot write, edit a body, restore; gate commits;
            publish fails at the evidence write; no run directory; no summary outcome.
        S08 org-public: inspect S01 and S04 publish logs; the evidence commit (its read-back) precedes the job summary.
        S09 org-public: a same-repository PR and a fork PR (from the fork) that modify .github/workflows/steward-pr.yml and
            .github/patch-steward/policy.yml; runs used master's workflow; run record policy_revision equals master's tree id;
            findings include submission.policy-change and submission.trusted-path-change.
        S10 org-public: open, title-edit, body-edit, close, reopen an issue; open and close a PR by the author; merge a scenario
            PR into a scenario-* base branch; body edit commits; reopen commits; closures produce metrics-only commits with
            merged, closed-by-author, closed-by-maintainer as applicable.
        S11 org-public: scenario policy with daily_runs 1, then per_author_concurrent_runs 1; open contract-met submissions;
            the over-cap run is queued; waiting run directory with waiting.json; restore the policy.
        S12 org-public: re-run a completed run (`gh run rerun`); the new attempt commits a new owner (newest created_at).
        S13 all: audit every scenario submission with audit.sh; App-authored comments, labels, App check runs on head SHAs,
            requested reviewers all 0; no deployment on a PR head.
        S14 all: fetch the deployed wrappers and the pinned reusable workflow; only gate and publish declare
            steward-publication and reference the two secrets; no probe suite secret name; every uses pinned by 40-hex SHA
            reachable on GitHub; steward_ref equals the pin.
        S15 personal: one contract-met issue; outcome run directory on the personal test-bed's steward-evidence; the secrets
            arrived through the explicit mapping (gate minted a token).
        S16 org-private: one contract-met issue; run directory committed to the private evidence repository, none in the target.
        S17 all: check the Environment (environment-check.sh), then `bash scenarios/tools/secret-scope.sh run <owner/repo>`;
            job outside logs both `length-zero=true`, job inside both `length-zero=false`; no secret value, length number, or
            `-----BEGIN` in either log; record the two log lines verbatim.
      One sentence after the table: ambiguous or unavailable ownership and snapshot reads cannot be forced live without
      platform manipulation; they are proved by fixture-tier tests with recorded responses.
    - Steady state (after the scenarios): steward-pr.yml, steward-issues.yml, and scenario-*.yml disabled on every test-bed
      (`bash scenarios/tools/steady-state.sh <owner/repo> apply`; scenario-secret-scope-called.yml has no trigger of its own and
      may stay active); no open `[scenario` issue or PR. What stays: the evidence branches, the evidence repository, the
      policy, the Environment, the wrapper files (disabled), and closed scenario issues and pull requests (never deleted).
    Headings (exactly these level-2 headings, in this order): `## Layout`, `## Test-beds`, `## Prerequisites`,
    `## Safety rules`, `## Budgets`, `## Tools`, `## Setup`, `## Procedures`, `## Steady state`; level-1 title
    `# Test-bed scenarios`; each scenario a level-3 heading starting `### S<nn>` (S00 to S17, 18 headings).
- actions: |
    1. Base check (files changed in steps 4.5 to 4.9): node -e "const fs=require('fs');const f=['scenarios/fixtures/policies/orphan-branch.yml','scenarios/fixtures/policies/repository-store.yml','scenarios/fixtures/submissions/unstructured.txt','scenarios/tools/deploy-steward.sh','scenarios/tools/environment-check.sh','scenarios/tools/steady-state.sh','scenarios/tools/find-runs.sh','scenarios/tools/artifacts.sh','scenarios/tools/audit.sh','scenarios/tools/evidence.sh','scenarios/tools/secret-scope.sh','scenarios/workflows/scenario-secret-scope.yml','scenarios/workflows/scenario-secret-scope-called.yml'];const m=f.filter(p=>!fs.existsSync(p));console.log(m.length?'MISSING '+m.join(' '):'base ok')"
       It must print `base ok`; otherwise STOP and report status missing-base with the output.
    2. Read the header comment of every scenarios/tools/*.sh file (usage and output lines) so the Tools section matches them.
    3. Write scenarios/README.md per context; then run `pnpm exec prettier --write scenarios/README.md`.
- acceptance: |
    Run each from the tree root in Git Bash; each must give exactly the stated result.
    1. node -e "const s=require('fs').readFileSync('scenarios/README.md','utf8').replace(/\r/g,'');const h2=(s.match(/^## .+/gm)||[]).join('|');const h3=(s.match(/^### S\d\d\b/gm)||[]).map(x=>x.slice(4));const want=Array.from({length:18},(_,i)=>'S'+String(i).padStart(2,'0'));console.log(s.startsWith('# Test-bed scenarios\n')&&h2==='## Layout|## Test-beds|## Prerequisites|## Safety rules|## Budgets|## Tools|## Setup|## Procedures|## Steady state'&&JSON.stringify(h3)===JSON.stringify(want)?'structure ok':'structure wrong '+h2+' '+JSON.stringify(h3))"
       -> prints exactly: structure ok
    2. node -e "const s=require('fs').readFileSync('scenarios/README.md','utf8').replace(/\s+/g,' ');const need=['deploy-steward.sh','environment-check.sh','find-runs.sh','artifacts.sh','evidence.sh','audit.sh','secret-scope.sh','steady-state.sh','steady-orchard/patch-steward-testbed-public','jambolo/patch-steward-testbed-personal','steady-orchard/patch-steward-testbed-private','steady-orchard/patch-steward-testbed-evidence','steward-publication','PATCH_STEWARD_APP_ID','PATCH_STEWARD_APP_PRIVATE_KEY','2095171','331019482','the probe suite\'s App secrets','steward-evidence','length-zero=true','length-zero=false','[scenario S'];const miss=need.filter(t=>!s.includes(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'content ok')"
       -> prints exactly: content ok
    3. git grep --untracked -n -P '(?<!PATCH_)STEWARD_APP_(ID|PRIVATE_KEY|CLIENT_ID)|development-artifacts|\bM0[0-9]\b|\bM1[0-9]\b|\bM2[01]\b|\bPD0[1-8]\b|owner decision|\b(OW|DD|EV|RN|CP|ES|EL|WS|SS|RS|WF|AT|SC|OA|DF)[0-9]{1,2}\b|deferred\.md|[Mm]ilestone|\b[Pp]hase [0-9]|\b[Ss]tep [0-9]' -- scenarios/README.md
       -> no output (exit 1)
    4. pnpm exec prettier --check scenarios -> exit 0
    5. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" scenarios/README.md
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the README).
