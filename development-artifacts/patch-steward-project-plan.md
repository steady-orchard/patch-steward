# patch-steward — Project Plan

## Overview

- Product: Patch Steward screens GitHub issues and pull requests (public or private repositories) for maintainers. Outcomes
  exactly `pass`, `needs-changes`, `uncertain`, `inconclusive`, `overridden`, `superseded`; rules in the core decide, a model
  never does. Success criterion (README): measured reduction in net maintainer work without systematically excluding valid
  contributions; delivery alone does not establish it (M21 measures it).
- Users: maintainers (install in the target repository: reusable workflows, policy, App), contributors (`steward preflight`,
  browser submission assistant), the project owner (operates the test-beds and approves gates).
- Scope: version 1 as defined in `docs/architecture.md` §1.1, delivered as milestones M01–M21.
- Milestone text source: `docs/project-development-plan.md` (the owner's plan; its `### M<nn>.` sections govern each milestone's
  goal, design scope, inputs, decisions to settle first, outputs, and exit criteria). This file is the lead developer's execution
  projection of it for the pipeline-v4 skills, created 2026-10-23 by migration while M07 was in progress; M01–M06 were completed
  under the earlier pipeline. When the two disagree, report the conflict to the owner; do not edit either silently.
- Development host: Windows 11, Git Bash and PowerShell, Node 24, pnpm, Docker Desktop (Linux containers), Podman machine
  `podman-machine-default` (rootful, WSL), `act` 0.2.88. CI: GitHub Actions on `ubuntu-latest` and `windows-latest`. Repository
  `steady-orchard/patch-steward`; test-beds `steady-orchard/patch-steward-testbed-public`, `steady-orchard/patch-steward-testbed-private`,
  `jambolo/patch-steward-testbed-personal`; evidence repository `steady-orchard/patch-steward-testbed-evidence`; test App id 4993303.

## Architecture

- pnpm monorepo: `packages/core` (screening core: policy, records, redaction, submission, github, git, net, ownership, decision,
  report, evidence, pipeline, execution, runner, materialize, conformance), `packages/cli` (`steward` executable:
  `policy`, `preflight`, `screen`, `report`), `packages/action` (runs the core's `gate` and `publish` in workflow jobs from a packed
  runtime), `packages/web` (browser app; smoke code until M18). `.github/workflows/steward-screening.yml` is the reusable screening
  workflow (`workflow_call`). `templates/` (policy, issue forms, PR template, wrapper workflows), `fixtures/` (shared corpus),
  `scenarios/` (test-bed scenario suite, never in CI), `probes/` (platform probes PA01–PA09, never in CI).
- Topologies (architecture §5): T1 GitHub-hosted single-run workflow with jobs `build` → `gate` → `intake` → `execute` → `assess`
  → bounded `execute-N`/`assess-N` → `publish`; T2 contributor preflight (claim-only unsandboxed runner on the contributor's
  checkout); T3 local maintainer `steward screen`; T4 `steward replay`. The same phase sequence runs in one process locally.
- Trust: only `gate` and `publish` hold App tokens; only `intake` and `assess` hold the model credential and never execute
  submitted code; submitted code runs only in disposable credential-free containers; evidence is written before any publication.
- Adapters: LLM (`copilot-sdk`, `openai-compatible`), GitHub REST/GraphQL, git, container runner (Docker or Podman CLI),
  evidence store (orphan branch `steward-evidence` or a separate repository, Git Data API).
- Design sources that govern: `docs/architecture.md` (components, boundaries), `docs/processes.md` (SP01–SP20 steps and
  behavior), `docs/whitepaper.md` (defers to both), `docs/adr/` (record only), `docs/user-manual/`; `docs/deferred.md` governs
  nothing in version 1. `CLAUDE.md` summarizes the delivered state and the invariants.

## Techniques

- TypeScript ESM (`module: nodenext`, `verbatimModuleSyntax`), strict compiler options, Node 24 only, pnpm only.
- Zod 4 as the single schema source (runtime validation, inferred types, exported JSON Schema); YAML 2 through the strict
  policy parser; RFC 8785 canonical JSON for hashing; policy revision = git tree id of `.github/patch-steward/`.
- Every numeric policy limit sits under a hard bound that is a core constant; redaction (23 built-in detectors plus exact
  values of resolved credentials) before anything is stored.
- Containers driven through the Docker or Podman CLI by argument vector; inert materialization of submitted commits; JUnit XML
  as the result-file format.
- Tests: Vitest; tiers by filename suffix (`*.test.ts` unit, `*.fixture.test.ts` fixture, `*.container.test.ts` container,
  `*.live.test.ts` live); invariant conformance tests in `packages/core/src/conformance/`; exit criteria proven by named tests
  (M07 titles them `exit E<k>: ...`, k = the criterion's position in the milestone's exit-criteria list).
- Decisions recorded as MADR ADRs in `docs/adr/` (record only), governing documents updated first.

## Constraints

- `CLAUDE.md` binds every milestone: toolchain constraints, documentation conventions, persistence rule, invariants.
- `docs/project-development-plan.md` §0.3 (definition of done for every milestone) applies to every milestone; its Ubuntu leg is
  verified locally with `act` on an LF clone (`git clone -c core.autocrlf=false`) with `-W .github/workflows/ci.yml` and
  `-P ubuntu-latest=catthehacker/ubuntu:act-latest`, one `-j` job per run (`build-and-test` needs `--matrix os:ubuntu-latest`,
  `container-tests` `--matrix runtime:docker`); the coverage job is never run. Every brief's project DoD carries those items.
- Owner decisions: each milestone's "Decisions to settle first" are settled with the owner by the lead before planning and
  recorded in the project ledger's Owner decisions table and the brief; values needing owner approval (bounds tables,
  templates, wording) go into the brief, and the planner returns `RESULT: needs-human` before any decomposition.
- Outward actions: no push to origin, no test-bed write, no GitHub write, no App, secret, ruleset, or settings change unless
  that milestone's owner decisions authorize it; `develop` is pushed only by the owner. Never `secrets: inherit`; the probe
  suite's App secrets are never read. Persistent files never name planning branches.
- Persistence: persistent documents (`docs/` except `docs/project-development-plan.md` and `docs/astra-plan.md`, `README.md`,
  `CLAUDE.md`, `fixtures/`, `templates/`, `scenarios/`) never cite planning artifacts or their ids (Mxx, PDxx, gate, question,
  step, phase ids).
- Pipeline rules (every milestone; the planner copies them into the milestone ledger, the decomposer projects them into steps):
  - Every pipeline agent runs in the foreground; a parallel wave is several Agent calls in one message.
  - No pipe character inside a ledger table cell (write "or"); never write raw control, bidi, zero-width, or NUL characters
    into any artifact or source file (tests build them with `String.fromCharCode`).
  - Phase gates and DoDs run in the main tree; waves use `wave-create.sh --worktrees C:/w`; bootstrap `pnpm install
    --frozen-lockfile` in each new worktree, one at a time; delete leftover `node_modules` after removing a worktree.
  - `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; fixture repositories are JSON manifests; never
    commit a live `.gitattributes` or `.gitmodules` below the repository root.
  - Prettier-clean source and fixtures at commit; byte-exact fixtures use `.txt` or `.xml`; never format `development-artifacts/`.
  - `.gitignore` swallows `logs`, `*.log`, `*.tgz`, `.env*`, `out`, `dist`, `pids`: never name a committed path that way.
  - Credential samples built by string concatenation; never print, log, or store a real token.
  - `it.each` titles over 40 characters are truncated: check rendered titles. New core root exports named `load*`, `validate*`,
    `resolve*`, `parse*`, `capture*`, or `check*` extend `conformance/invariant-5.test.ts` in the same step; export names unique
    across core (TS2308).
  - Tests clean their temp directories (prefix `patch-steward-`) and every container, volume, and image they create (label
    `org.patch-steward.test=<nonce>`); acceptance runs tests with a private TMP directory and counts leftovers.
  - Nine concurrent full `pnpm vitest run` suites cause timeouts and EPERM; a sequential re-run is the judge.
  - Git Bash prints a `stty: 'standard input': Inappropriate ioctl for device` line at startup in some shells; ignore it.
  - Container-tier tests run only through `pnpm test:container` with `STEWARD_CONTAINER_RUNTIME` set; unit and fixture tiers
    never need a runtime or network; test images are public and pinned by digest.

## Out of scope

- Everything in `docs/deferred.md` (DF01–DF10) and anything outside architecture §1.1.
- GitHub Models and the `models: read` permission (retired 2026-07-30).
- Releases and version bumps on `master` (owner actions through the existing CD path), recruitment of external M21 participants.

## Definition of Done (project)

```dod
# every milestone done in the project ledger
cmd: source "$HOME/.claude/skills/pipeline-tools/scripts/lib.sh" && milestones_done development-artifacts/patch-steward-project-ledger.md
expect: 21|21
# toolchain on Windows
cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
expect: exit 0
# invariant conformance suite
cmd: pnpm vitest run packages/core/src/conformance >/dev/null 2>&1 && echo ok
expect: ok
# version 1.0.0 tag on origin
cmd: git ls-remote --tags origin refs/tags/v1.0.0 | wc -l
expect: 1
# version 1 acceptance record
manual: the version 1 acceptance record exists, reports delivered capability and measured effectiveness separately, and states the owner-only participation limit while PD08 holds
```

## Milestone 1 — Monorepo foundation

- slug: monorepo-foundation
- objective: done before the migration (merge commit 9c2a1cb); milestone text in `docs/project-development-plan.md` "### M01."
- scope: all packages
- deliverables: delivered (CLAUDE.md "Project state")
- depends-on: nothing
- definition-of-done:
  ```dod
  # merged into develop
  cmd: git merge-base --is-ancestor 9c2a1cb develop && echo merged
  expect: merged
  ```
- planner-context: |
    Done; not re-planned.

## Milestone 2 — Platform assumption probes

- slug: platform-assumption-probes
- objective: done before the migration (merge commit 60d2505); milestone text in `docs/project-development-plan.md` "### M02."
- scope: test-beds, `probes/`, design documents, `docs/adr/`
- deliverables: delivered (`probes/findings.md`, ADR-0001 to ADR-0033)
- depends-on: nothing
- definition-of-done:
  ```dod
  # merged into develop
  cmd: git merge-base --is-ancestor 60d2505 develop && echo merged
  expect: merged
  ```
- planner-context: |
    Done; not re-planned.

## Milestone 3 — Policy and data contracts

- slug: policy-and-data-contracts
- objective: done before the migration (merge commit b3d7582); milestone text in `docs/project-development-plan.md` "### M03."
- scope: `core`, `cli`, templates
- deliverables: delivered (`steward policy`, record schemas, redaction)
- depends-on: 1
- definition-of-done:
  ```dod
  # merged into develop
  cmd: git merge-base --is-ancestor b3d7582 develop && echo merged
  expect: merged
  ```
- planner-context: |
    Done; not re-planned.

## Milestone 4 — Submission intake and contract check

- slug: submission-intake-and-contract-check
- objective: done before the migration (merge commit 58de685); milestone text in `docs/project-development-plan.md` "### M04."
- scope: `core`, `cli`, templates
- deliverables: delivered (deterministic `steward preflight`, submission module)
- depends-on: 3
- definition-of-done:
  ```dod
  # merged into develop
  cmd: git merge-base --is-ancestor 58de685 develop && echo merged
  expect: merged
  ```
- planner-context: |
    Done; not re-planned.

## Milestone 5 — Decision, report, evidence records, local skeleton

- slug: decision-report-evidence-records-local-skeleton
- objective: done before the migration (merge commit ab6b99a); milestone text in `docs/project-development-plan.md` "### M05."
- scope: `core`, `cli`
- deliverables: delivered (`steward screen` at contract level, `steward report`)
- depends-on: 4
- definition-of-done:
  ```dod
  # merged into develop
  cmd: git merge-base --is-ancestor ab6b99a develop && echo merged
  expect: merged
  ```
- planner-context: |
    Done; not re-planned.

## Milestone 6 — GitHub-hosted skeleton: gate, ownership, evidence, publish

- slug: github-hosted-skeleton-gate-ownership-evidence-publish
- objective: done before the migration (merge commit 4387d8b); milestone text in `docs/project-development-plan.md` "### M06."
- scope: `core`, `action`, workflows, `scenarios/`
- deliverables: delivered (reusable workflow with `build`, `gate`, `publish`; live scenarios S01–S17)
- depends-on: 2, 5
- definition-of-done:
  ```dod
  # merged into develop
  cmd: git merge-base --is-ancestor 4387d8b develop && echo merged
  expect: merged
  ```
- planner-context: |
    Done; not re-planned.

## Milestone 7 — Sandboxed execution

- slug: sandboxed-execution
- objective: run plan entries against explicit commits inside disposable, credential-free containers, produce bounded and
  redacted execution records, and provide the claim-only runner for T2.
- scope: SP17 steps 1–5; architecture §4 Z1-to-Z2 rule, §6.2 Execution planner, §6.3 Runner (local container, unsandboxed),
  §12 execution bounds, §13 credential, escape, and log rows; SP05 CLI step 3; invariants 3 and 7; packages `core`, `cli`;
  `.github/workflows/ci.yml` container job; `fixtures/`.
- deliverables: execution planner; inert materialization and validated overlays; local container runner (Docker and Podman) and
  unsandboxed claim-only runner; execution records with environment identity, bounded output, result files, admissibility;
  runner image from `.github/patch-steward/runner/`; `steward screen` executions; `steward preflight --run`; ADR-0079 to
  ADR-0089 and governing-document updates.
- depends-on: 5
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m7-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # exit criteria 1, 4, 5 pass in the unit and fixture tiers
  cmd: pnpm vitest run --reporter=json --outputFile=node_modules/.m7-exit-unit.json >/dev/null 2>&1; node -e "const r=require('./node_modules/.m7-exit-unit.json');let f=0;const g=new Set();for(const t of r.testResults)for(const a of t.assertionResults){if(a.status==='failed')f++;const m=/^exit (E[1-5]):/.exec(a.title);if(m&&a.status==='passed')g.add(m[1])}console.log(f?'failed '+f:['E1','E4','E5'].filter(e=>!g.has(e)).join(' ')||'ok')"
  expect: ok
  # exit criteria 2, 3, 4 pass in the container tier under docker
  cmd: STEWARD_CONTAINER_RUNTIME=docker pnpm test:container --reporter=json --outputFile=node_modules/.m7-exit-docker.json >/dev/null 2>&1; node -e "const r=require('./node_modules/.m7-exit-docker.json');let f=0;const g=new Set();for(const t of r.testResults)for(const a of t.assertionResults){if(a.status==='failed')f++;const m=/^exit (E[1-5]):/.exec(a.title);if(m&&a.status==='passed')g.add(m[1])}console.log(f?'failed '+f:['E2','E3','E4'].filter(e=>!g.has(e)).join(' ')||'ok')"
  expect: ok
  # exit criteria 2, 3, 4 pass in the container tier under podman
  cmd: STEWARD_CONTAINER_RUNTIME=podman pnpm test:container --reporter=json --outputFile=node_modules/.m7-exit-podman.json >/dev/null 2>&1; node -e "const r=require('./node_modules/.m7-exit-podman.json');let f=0;const g=new Set();for(const t of r.testResults)for(const a of t.assertionResults){if(a.status==='failed')f++;const m=/^exit (E[1-5]):/.exec(a.title);if(m&&a.status==='passed')g.add(m[1])}console.log(f?'failed '+f:['E2','E3','E4'].filter(e=>!g.has(e)).join(' ')||'ok')"
  expect: ok
  # no labeled container, volume, or image left by tests
  cmd: for r in docker podman; do echo "$($r ps -a -q --filter label=org.patch-steward.test | wc -l) $($r volume ls -q --filter label=org.patch-steward.test | wc -l) $($r image ls -q --filter label=org.patch-steward.test | wc -l)"; done | tr '\n' ' ' | sed 's/ *$//'
  expect: 0 0 0 0 0 0
  # milestone branch has no upstream
  cmd: git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo none
  expect: none
  ```
- planner-context: |
    Planned 2026-09-28 under the earlier pipeline; brief, roadmap, and ledger on branch milestone/7-sandboxed-execution
    (development-artifacts/patch-steward-m7-*.md), migrated to pipeline v4 on 2026-10-23. Not re-planned: changes go through the
    planner's amend operation. Milestone text: docs/project-development-plan.md "### M07. Sandboxed execution". Owner decisions:
    project ledger Owner decisions rows M07 and the brief's "Owner gate decisions".

## Milestone 8 — Deterministic verification stages

- slug: deterministic-verification-stages
- objective: reproduce defects, verify fixes before and after, and compare regressions against a baseline by rules alone, so
  these stages work without an inference account.
- scope: SP09 steps 1, 2, 3 (declared markers), 4, 5; SP10 steps 1–4; SP12 steps 1–4 and the merge-commit run of step 6; SP17
  step 6 and the project-CI rule of architecture §4; §11 baseline keys; package `core`; `fixtures/`.
- deliverables: reproduction stage; fix-verification stage (declared regression test, three controlled executions,
  failure classification, anti-gaming analysis); regression stage (baselines under the full key, test-identity comparison,
  one instability rerun, full-suite triggers, platform coverage status); project-CI results ingested as signals; all three
  stages in `steward screen`; ADRs and governing-document updates.
- depends-on: 7
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m8-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M08." in docs/project-development-plan.md maps to a passing brief DoD item or named test, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M08. Deterministic verification
    stages" (goal, design scope, addresses, depends on, inputs, decisions to settle first, outputs, exit criteria). Also binding:
    that file's §0.1, §0.3, §0.5, §7 rows for M08, §8, and §9 PD04; CLAUDE.md; the design sections the milestone text cites.
    Owner decisions for "Decisions to settle first" are appended to this prompt by the lead.
    Builds on M07 (merged): execution planner, materialization, container and unsandboxed runners, execution records, JUnit
    parser; contracts in development-artifacts/patch-steward-m7-brief.md and the Phase notes of patch-steward-m7-ledger.md.
    M07 left to this milestone: classification of missing or malformed declared result files; container before-and-after
    executions, merge commits, baselines, `signal` records; the compiled-ecosystem choice (PD04: Rust or C++). Finding: the
    `overlay_files` hard maximum (3000) exceeds the execution record's 1000-item list bound (RECORD_LIST_MAX_ITEMS); container
    overlays first arrive here, so reconcile the two.
    Map each exit criterion to named tests or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 9 — Inference layer

- slug: inference-layer
- objective: bounded, provider-independent, schema-validated request-and-response inference under one cumulative budget, where
  every failure becomes a typed failure that the decision rules turn into `inconclusive`.
- scope: architecture §6.3 LLM adapter contract and both adapters, §6.2 Budget, §12 budgets, caching, rate limits; SP19 steps
  2, 4, 5, 7; SP05 CLI step 4; ADR-0008, ADR-0014, ADR-0015; invariants 4, 5, 7; packages `core`, `cli`.
- deliverables: LLM adapter interface, capability descriptor, shared contract test suite; `copilot-sdk` and
  `openai-compatible` adapters; session framework with response schemas, bounded repair, A/B/C isolation; budget module;
  result cache; `steward preflight` self-review with disclosure and confirmation; ADRs and governing-document updates.
- depends-on: 5
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m9-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M09." in docs/project-development-plan.md maps to a passing brief DoD item or named test, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M09. Inference layer". Also binding:
    that file's §0.1, §0.3, §0.5, §7 rows for M09, §8, §9 PD03; CLAUDE.md (Copilot SDK adapter isolation rules, GitHub Models
    retired, no default provider); `probes/findings.md` PA08 and PA09 (Copilot in Actions, allowance caps).
    Owner decisions for "Decisions to settle first" are appended to this prompt by the lead.
    Facts: M03 fixed the `env` key variable `STEWARD_LLM_API_KEY` and left Copilot login reuse for `github-token` to this
    milestone; Copilot Free on `jambolo`, no Copilot seats on `steady-orchard` (PD03; the organization billing path is
    unverified); the `jambolo` monthly allowance was exhausted by the M02 cap probe once, so live Copilot probes count calls.
    Map each exit criterion to named tests or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 10 — Reference verification and claim validation

- slug: reference-verification-and-claim-validation
- objective: establish whether cited material exists at the claimed revision and what the claim is, with evidence pointers
  that the core confirms.
- scope: SP07; SP08; architecture §6.2 Context retrieval and References, §7 Search API; ADR-0004; package `core`.
- deliverables: references module (extraction, verification, three statuses, applicability findings); bounded context
  retrieval; claim-validation stage (session A, pointer resolution, security-claim routing, prior-dismissal matching, SP08
  routing table, both `unrequested_change` settings); issue screening end to end in `steward screen`; ADRs and documents.
- depends-on: 9
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m10-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M10." in docs/project-development-plan.md maps to a passing brief DoD item or named test, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M10. Reference verification and
    claim validation". Also binding: that file's §0.1, §0.3, §0.5, §7 rows for M10, §8; CLAUDE.md (untrusted data, session
    isolation, model never decides).
    Owner decisions for "Decisions to settle first" are appended to this prompt by the lead.
    Builds on M09 sessions and budgets, M04 submissions, M05 decision and evidence.
    Map each exit criterion to named tests or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 11 — Evaluation replay

- slug: evaluation-replay
- objective: measure the pipeline on frozen, labeled history with the labels withheld, so that prompt, threshold, and limit
  decisions from here on rest on measurements.
- scope: SP04; T4 (architecture §5); §6.5 `steward replay`; whitepaper §13 historical cases; packages `core`, `cli`.
- deliverables: `steward replay` over frozen content-addressed manifests with evaluation cutoffs; scoring report; manifest
  leakage audit; seed dataset and first baseline measurement of M10; optional attributed upload; ADRs and documents.
- depends-on: 8, 10
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m11-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M11." in docs/project-development-plan.md maps to a passing brief DoD item or named test, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M11. Evaluation replay". Also binding:
    that file's §0.1, §0.3, §0.5, §7 rows for M11, §8.
    Owner decisions for "Decisions to settle first" (dataset format, seed datasets, scoring definitions, authorization for
    held-out or private cases) are appended to this prompt by the lead.
    Facts: the M03 hard bounds are provisional and revisited here with measurements (bound changes need owner approval).
    Map each exit criterion to named tests or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 12 — Model-assisted verification and independent challenge

- slug: model-assisted-verification-and-independent-challenge
- objective: complete the PR pipeline's judgment stages: output interpretation, design and completeness, impact analysis, the
  session B challenge with executed counterexamples in bounded rounds, and passive hygiene flags.
- scope: SP09 step 3 (model assessment); SP10 step 5; SP11; SP12 step 5; SP16 steps 2–4; the plan, execute, and interpret
  separation of architecture §6.4; §13 shared-blind-spot row; package `core`.
- deliverables: challenge stage; model assessment of reproduction output; design and completeness findings; impact analysis;
  hygiene flags; the complete pipeline in `steward screen`; replay comparison with the M11 baseline; ADRs and documents.
- depends-on: 8, 10, 11
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m12-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M12." in docs/project-development-plan.md maps to a passing brief DoD item or named test, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M12. Model-assisted verification and
    independent challenge". Also binding: that file's §0.1, §0.3, §0.5, §7 rows for M12, §8; CLAUDE.md (session B receives no
    author prose or A/C history; model phases never execute code).
    Owner decisions for "Decisions to settle first" are appended to this prompt by the lead.
    Map each exit criterion to named tests or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 13 — GitHub-hosted full pipeline in observe mode

- slug: github-hosted-full-pipeline-observe-mode
- objective: run the complete pipeline in Actions with job-level privilege separation, in observe mode, on real traffic.
- scope: architecture §6.4 job table (`intake`, `execute`, `assess`, round pairs) and handoffs, §4 boundary rules, §6.3 Actions
  container runner; SP06 steps 7 and 9; SP12 step 1 in T1; SP17 in T1; SP19 steps 2 and 4–7; SP02 step 3, failure handling,
  first part of step 7; `steward-maintenance.yml` skeleton; packages `core`, `action`; workflows; `scenarios/`.
- deliverables: complete reusable workflow with per-job credentials; Actions container runner; verified artifact handoffs and
  cumulative budget; baselines in the evidence store; validation reuse; `intake` credential and capability verification;
  maintenance wrapper skeleton and first installation self-test; observe-mode evidence from real submissions; ADRs and documents.
- depends-on: 6, 12
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m13-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M13." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M13. GitHub-hosted full pipeline in
    observe mode". Also binding: that file's §0.1, §0.3, §0.5 (observe on real repositories gate), §7 rows for M13, §8, §9
    PD05, PD08; CLAUDE.md (job credentials, `steward-publication` Environment with `deployment: false`, explicit `secrets:`
    mapping); `probes/findings.md`; `scenarios/README.md` (safety rules, budgets).
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Facts: test-beds were left in steady state after M06 (steward and scenario workflows `disabled_manually`); test-bed wrappers
    pin 15c6e6d on origin branch `milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish`, kept until `develop` is
    pushed and pins move; explicit `secrets:` mapping is untested organization to organization; T1 runner-image caching was left
    to this milestone by M07.
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 14 — Repository gate and visible feedback

- slug: repository-gate-and-visible-feedback
- objective: publish outcomes where contributors and maintainers see them: the App check run, one report comment, labels, and
  review requests, under the mode, ownership, and freshness rules.
- scope: architecture §10, §6.4 check, echo, and stale-check rules, §7 Checks, Labels, Review requests, ready-for-review; SP13
  steps 4–7; SP06 step 1 check creation and step 4 early neutral; SP16 step 1; SP19 check-creation failure; SP20 step 3; §13
  stale-success, late-write, shared-head, event-loop rows; packages `core`, `action`, `cli`.
- deliverables: check lifecycle; GitHub write adapter with publication receipts; echo filtering; stale-check reconciliation;
  `steward screen` publication behind an explicit flag; self-test check semantics; test-bed scenario matrix; ADRs and documents.
- depends-on: 13
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m14-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M14." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M14. Repository gate and visible
    feedback". Also binding: that file's §0.1, §0.3, §0.5, §7 rows for M14, §8; CLAUDE.md (labels are outputs, echo rule,
    shared-head rule, check completion order); `probes/findings.md` (required checks, App-write echoes); `scenarios/README.md`.
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Facts: M05 deferred the name of the `steward screen` publish flag to this milestone.
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 15 — Maintainer commands, recorded actions, inference admission

- slug: maintainer-commands-recorded-actions-inference-admission
- objective: give maintainers and authors the recorded, scoped controls of SP15, and the optional inference-admission hold.
- scope: SP15; SP19 step 10 and the partial-rerun rule of step 3; SP13 step 1 waivers and `overridden`; SP08 step 6 acceptance
  paths; SP06 step 7 action-scope transfer; SP03 steps 2 (`resolve`), 4, 6; architecture §9 Maintainer action and claim-scope
  hashing; ADR-0016; packages `core`, `action`; workflows.
- deliverables: command recognition, permission verification, acknowledgment, usage reply; every SP15 command with idempotent
  action records; reruns inside the issues run; appeals; the admission hold with metrics; ADRs and documents.
- depends-on: 14
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m15-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M15." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M15. Maintainer commands, recorded
    actions, and inference admission". Also binding: that file's §0.1, §0.3, §0.5, §7 rows for M15, §8; CLAUDE.md
    (acceptance only as a recorded `/steward accept`; `llm.admission: maintainer-approved`).
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 16 — Contributor follow-through and dependency propagation

- slug: contributor-follow-through-and-dependency-propagation
- objective: close the loop with authors through stable numbered requests and assessed responses, and rescreen every
  submission whose inputs change through another item.
- scope: SP14; session C; SP19 step 3; architecture §6.4 dependency-change and shared-head refresh rules; SP18 step 3 live
  linkage beside the index; §13 stale-success-after-linked-change row; packages `core`, `action`; workflows.
- deliverables: request ledger with stable ids and durable anchors; response parsing, single follow-up, session C, affected-stage
  reruns; `awaiting-author` state with ages and abandonment; linked-issue and shared-head propagation; ADRs and documents.
- depends-on: 15
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m16-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M16." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M16. Contributor follow-through and
    dependency propagation". Also binding: that file's §0.1, §0.3, §0.5 (advise on this repository gate), §7 rows for M16, §8;
    CLAUDE.md (request ids and consumed responses persist across report edits; dependency changes still process).
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 17 — Maintenance, calibration, and publication data

- slug: maintenance-calibration-and-publication-data
- objective: keep an installation healthy and measurable on a schedule: recover missed work, sweep policy changes, sample
  audits, compute rollups, prune evidence, probe the model, and publish the data contract.
- scope: remaining duties of `steward-maintenance.yml` (architecture §6.4); SP01 steps 3 and 5; SP03 machinery; SP18 steps 3–5
  and 7; SP19 steps 9 and 11; §6.6 data contract; §11 publication; §12 probe; packages `core`, `action`; workflows.
- deliverables: sweeps; index rebuild, rollups, audit sampling, time entries, retention pruning; evaluation-protocol and
  mode-change records; availability probe and maintenance issue; generated Pages data and deployment; ADRs and documents.
- depends-on: 16
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m17-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M17." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M17. Maintenance, calibration, and
    publication data". Also binding: that file's §0.1, §0.3, §0.5, §7 rows for M17, §8.
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Facts: the M03 hard bounds are provisional and revisited here (bound changes need owner approval).
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 18 — Browser application

- slug: browser-application
- objective: one static application with two faces, the contributor submission assistant and the maintainer dashboard, with no
  secrets, inference, or writes.
- scope: architecture §6.6; zone Z6; ADR-0001, ADR-0002; SP05 browser steps; SP15 step 1 views; SP03 step 4 audit queue;
  package `web`.
- deliverables: submission assistant; maintainer dashboard; pinned versioned bundle for the maintenance workflow; ADRs and
  documents.
- depends-on: 17
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m18-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M18." in docs/project-development-plan.md maps to a passing brief DoD item or named test, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M18. Browser application". Also
    binding: that file's §0.1, §0.3, §0.5, §7 rows for M18, §8; CLAUDE.md (static app, no secrets, no inference).
    Owner decisions for "Decisions to settle first" are appended to this prompt by the lead.
    Facts: `packages/web` holds only toolchain smoke code before this milestone.
    Map each exit criterion to named tests or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 19 — Merge queue

- slug: merge-queue
- objective: verify the integrated group commit through a credential-free relay and the group-only path.
- scope: `steward-relay.yml`; the `workflow_run` entry of `steward-pr.yml`; SP06 merge-group branch; SP12 step 6; the
  merge-queue paragraph of architecture §6.4; §13 merge-queue row; package `core`; workflows.
- deliverables: relay wrapper; group path; self-test relay check; ADRs and documents.
- depends-on: 14
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m19-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M19." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M19. Merge queue". Also binding: that
    file's §0.1, §0.3, §0.5, §7 rows for M19, §8; `probes/findings.md` PA06 (merge queue; not offered on user-owned
    repositories, so the organization test-beds carry it).
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 20 — Adoption, distribution, and release candidate

- slug: adoption-distribution-and-release-candidate
- objective: a project can adopt Patch Steward from a published release candidate by following the documentation, without help
  from its developers.
- scope: SP02; architecture §6.5 `steward init`, §6.7; ADR-0011 (and its successor); §13 compromised-release row; every
  remaining §15 item except the enforcement thresholds; all packages and templates.
- deliverables: `steward init`; complete installation self-test; published release candidate pinned by immutable references;
  security review against every §13 threat; conformance suite as a release gate; documentation of delivered behavior; `probes/`
  repurposed as a persistent regression suite.
- depends-on: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m20-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios probes 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M20." in docs/project-development-plan.md maps to a passing brief DoD item or live scenario, listed in the brief
  # release candidate cut
  manual: the owner cut the release-candidate version through the existing CD path and the published artifacts are pinned by immutable references
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M20. Adoption, distribution, and
    release candidate". Also binding: that file's §0.1, §0.3, §0.5, §7, §8, §9 PD03, PD06, PD07; CLAUDE.md.
    Owner decisions for "Decisions to settle first" and the outward actions authorized for this milestone are appended to this
    prompt by the lead.
    Facts: owner decision (2026-09-25): `probes/` may hold planning references while implementation uses it; in the project's
    final implementation steps it becomes a persistent regression suite with planning references scrubbed (raise the timing
    with the owner when planning). A stale-plan-text list S1–S15 from M02 (plan sections for M06, M09, M13, M14, M19, M20,
    sections 0.5 and 8, PD03) was reported to the owner; its status is unknown: check the governing documents, not the plan.
    The organization billing path stays marked unverified while PD03's limitation holds.
    Map each exit criterion to named tests, live scenarios, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.

## Milestone 21 — Measured rollout and version 1 acceptance

- slug: measured-rollout-and-version-1-acceptance
- objective: establish with measurements whether the delivered system reduces net maintainer work without systematically
  excluding valid contributions, decide per category whether `advise` or `enforce` is justified, and accept version 1 on a
  record that separates delivered capability from measured effectiveness.
- scope: SP03 steps 1–7 on participating repositories; SP04 step 4 release comparison; SP02 step 8 before any enforcement;
  whitepaper §2 and §13; the README success criterion; the §15 enforcement-threshold item; participating repositories.
- deliverables: recorded evaluation protocol before outcome analysis; observation and advise-pilot results; net
  maintainer-time comparison; per-category mode decisions with reversal criteria; replay comparison; final release
  verification; version 1 acceptance record; final documentation; version 1.0.0.
- depends-on: 20
- definition-of-done:
  ```dod
  # toolchain on Windows
  cmd: pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check
  expect: exit 0
  # brief project definition of done
  cmd: bash "$HOME/.claude/skills/pipeline-tools/scripts/dod-run.sh" --file development-artifacts/patch-steward-m21-brief.md --heading "Definition of Done (project)" --cwd . | tail -n 1 | cut -d' ' -f1-2
  expect: DOD PASS
  # persistent documents cite no milestone or plan-decision ids
  cmd: grep -rlE '\bM[0-9]{2}\b|\bPD0[0-9]\b' docs README.md CLAUDE.md fixtures templates scenarios probes 2>/dev/null | grep -vE '^docs/(project-development-plan|astra-plan)[.]md$' | wc -l
  expect: 0
  # exit criteria proven
  manual: every exit criterion of "### M21." in docs/project-development-plan.md maps to a passing brief DoD item or recorded measurement, listed in the brief
  # protocol precedes analysis
  manual: the evaluation protocol's commit precedes the first analyzed outcome, and deviations from it are reported in the acceptance record
  ```
- planner-context: |
    Milestone text (governs scope; read verbatim): docs/project-development-plan.md "### M21. Measured rollout and version 1
    acceptance". Also binding: that file's §0.1, §0.3, §0.5 (advise pilot and enforce gates), §7, §8, §9 PD07, PD08;
    CLAUDE.md.
    Owner decisions for "Decisions to settle first" (protocol, pilot bounds, reversal criteria, participating repositories) and
    the outward actions authorized for this milestone are appended to this prompt by the lead.
    Facts: participants are the owner's repositories until others are recruited (PD08); measurement runs over calendar time,
    so phases that wait on observation are bounded by the protocol's period, not by pipeline steps.
    Map each exit criterion to named tests, recorded measurements, or brief DoD items and list the mapping in the brief.
    The lead appends the project plan's `## Constraints` section to this prompt.
