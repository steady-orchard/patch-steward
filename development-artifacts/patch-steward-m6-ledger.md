# patch-steward-m6 — Ledger

Single source of truth for execution state. Sections are owned by different agents —
the planner seeds Plan + Phases; the decomposer fills Steps per phase; the supervisor
updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m6
- current-phase: 1
- working-branch: milestone/6-github-hosted-skeleton-gate-ownership-evidence-publish
- starting-commit: 6418129c7b104fd93d9162efcda6fe08373287ee
- default-branch: develop
- artifacts-dir: development-artifacts
- owner-gate: PENDING (brief "Owner gate questions" 1-17; G1-G11, I1-I20, K38-K51, OA1-OA4 are drafts). No phase may be decomposed until this field reads APPROVED.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | pending | Core contracts (pure): bounds K38-K51, records (ownership, waiting, supersession, resolution keys), event model, dedup, newest owner, run-name and caps, store path planning, blob id, zip entry reader, job summary renderer. Blocked on owner gate. |
| 2     | pending | GitHub and evidence-store adapters: allowlisted writer, App tokens, artifacts list and download, run list, Git Data API store with retries and read-back, gate fallback read, recorded responses. Needs Phase 1. |
| 3     | pending | Hosted gate and publish, action package entry, invariant 2, 4, 7, 8 extensions, write allowlist, fixture-tier hosted scenarios. Needs Phase 2. |
| 4     | pending | Reusable workflow, wrapper templates, static workflow tests, live-test switch, scenarios skeleton, push to origin, OA1-OA4 verified, test-bed deployment, org-public smoke. Needs Phase 3 and owner actions. |
| 5     | pending | Live test-bed scenarios S01-S16 with recorded results, steady state. Needs Phase 4. |
| 6     | pending | ADR-0071 onward, governing documents, whitepaper, README, CLAUDE.md, user manual, project DoD. Needs Phase 5. |

## Pipeline rules (from earlier milestones plus M06 outward actions; binding for every agent in this plan)

- Every `decomposer`, `worker`, and `planner` invocation runs in the FOREGROUND (`run_in_background: false`). A parallel wave is
  several foreground Agent calls in ONE message. A supervisor that backgrounds workers is force-handed back and loses results.
- Never put a pipe character inside a ledger table cell (it breaks the columns); write "or" instead. Never write raw control,
  bidi, or zero-width characters into any artifact or source file; write escapes, and build such characters in test code with
  String.fromCharCode (the file-writing channel turns backslash-u escapes into raw characters).
- Phase gates and the project DoD run in the MAIN tree (repo root); long git-worktree paths break `pnpm test`. Worker worktrees
  use short paths such as `C:/w/m6-<id>`; delete leftover `node_modules` after `git worktree remove` on Windows.
- Before a wide wave, run `pnpm install --frozen-lockfile` in each new worktree sequentially (pnpm store contention on Windows).
- `core.autocrlf=true`: compare committed bytes with `git show HEAD:<path>`; compare deployed test-bed files by git blob id.
- Every Prettier-checked file a step writes (fixtures, docs, README, CLAUDE.md, templates, `.github/workflows`, `scenarios/`) is
  Prettier-clean at commit; byte-exact fixtures use `.txt`. Never run a formatter on anything under `development-artifacts/`.
- `.gitignore` swallows `logs`, `*.log`, `*.tgz`, `.env*`, `out`, `dist`: never name a committed file or directory that way.
- Credential samples (tokens, private keys) are built by string concatenation in test code, never committed as literals. Never print,
  log, or store a real token, key, or secret; verify by length or SHA-256 only.
- Acceptance checks that grep for substrings the mandated text itself contains are mis-specified; literal grep on prose must
  tolerate Prettier line wraps; it.each titles are checked as rendered titles (Vitest JSON reporter; titles over 40 characters in
  it.each are truncated).
- New core root exports named load*, validate*, resolve*, parse*, capture*, or check* must extend conformance/invariant-5.test.ts in
  the same step; every new export name is unique across core (TS2308).
- Tests clean their temp dirs; each step's acceptance proves its mkdtemp prefix count is unchanged after its test run.
- GitHub access in unit and fixture tests: recorded or synthetic responses only. Live reads only in `*.live.test.ts` under
  `pnpm test:live`. Live WRITES only in phases 4 and 5, only to the three test-beds and the fork, only through
  `probes/smoke/tools/*.sh`, `scenarios/tools/*.sh`, or `gh` commands listed in the step, polling no faster than every 20 s, stopping
  when the core rate limit remaining is below 500.
- Pushes: only `milestone/6-*` branches to origin, never force, never `develop` or `master`; the push happens only in the step that
  owns it; test-bed wrappers pin only SHAs reachable on the pushed milestone branch.
- The pipeline never changes App registration, permissions, or installations, never creates repositories, never sets real secrets, and
  never deletes repositories or issues; a failing owner-action verify command returns `needs-human`.
- Persistent files (`docs/` except the two plan documents, README.md, CLAUDE.md, `fixtures/`, `templates/`, `scenarios/`) never cite
  planning artifacts or their ids.

## Steps

<!-- decomposer fills per phase: id | phase | status | files | commit,
     plus a "Phase <N> notes" block: dependency graph, couplings, emergent contracts -->

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->
