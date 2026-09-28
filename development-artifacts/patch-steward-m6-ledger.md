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
- owner-gate: APPROVED 2026-09-27. Answers: Q1-Q8 A; Q9 C (distinct names: Environment `steward-publication` restricted to the default branch; Environment secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`; test-bed probe secrets `STEWARD_APP_ID`, `STEWARD_APP_PRIVATE_KEY` and variable `STEWARD_APP_CLIENT_ID` untouched and never read by the product; added live check S17: a job of a called reusable workflow that does not declare the Environment receives both secrets empty, wired to the exit criterion "Only gate and publish reference the publication Environment"); Q10-Q16 A (incl. M1-M8, K38-K51, `scenarios/` suite, ADR-0071-ADR-0078 with ADR-0011 superseded by ADR-0077, I1-I20; I21 added); Q17 owner will perform OA1-OA4 and report to the lead. Brief "Owner gate answers" holds the full record.
- owner-actions: owner reported OA1-OA4 complete 2026-09-27. OA1 VERIFIED by the lead on all three test-beds (Environment `steward-publication` lists secrets `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY`; deployment branch policy `master`; no repository secret named `PATCH_STEWARD_*`); OA2 VERIFIED by the lead (`steady-orchard/patch-steward-testbed-evidence` private, 1 commit); the planner re-ran every brief OA1 and OA2 verify line at the amendment and each printed its expected value. OA3 and OA4 reported done, not locally verifiable; proved only by the S16 run (OA3) and the S15 run (OA4). Still re-verify each with the brief "Owner actions" command before the step that first needs it (OA1 org-public: phase 4 org-public smoke; OA1 personal and org-private, OA2: phase 5 per the roadmap); a failed verify, or a token-mint or permission failure in S16 (OA3) or S15 (OA4), returns `RESULT: needs-human` naming the action.

## Phases

| Phase | Status  | Notes |
| ----: | ------- | ----- |
| 1     | pending | Core contracts (pure): bounds K38-K51, records (ownership, waiting, supersession, resolution keys), event model, dedup, newest owner, run-name and caps, store path planning, blob id, zip entry reader, job summary renderer. Blocked on owner gate. |
| 2     | pending | GitHub and evidence-store adapters: allowlisted writer, App tokens, artifacts list and download, run list, Git Data API store with retries and read-back, gate fallback read, recorded responses. Needs Phase 1. |
| 3     | pending | Hosted gate and publish, action package entry, invariant 2, 4, 7, 8 extensions, write allowlist, fixture-tier hosted scenarios. Needs Phase 2. |
| 4     | pending | Reusable workflow, wrapper templates (secrets `PATCH_STEWARD_APP_ID`, `PATCH_STEWARD_APP_PRIVATE_KEY`), static workflow tests, live-test switch, scenarios skeleton incl. SC5 secret-scope pair, push to origin, test-bed deployment, OA1 verified on org-public, org-public smoke. Needs Phase 3 and OA1 on org-public (before the smoke step only). |
| 5     | pending | Live test-bed scenarios S01-S17 (S17 = Environment-only secret delivery on all three test-beds) with recorded results, steady state. Needs Phase 4; OA1 on personal and org-private, OA2, OA3, OA4 verified before the scenarios that need them (S15, S16, S17). |
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

| id | phase | status | files | commit |
| --- | --- | --- | --- | --- |
| 1.1 | 1 | pending | packages/core/src/policy/bounds.ts, packages/core/src/policy/bounds.test.ts, development-artifacts/patch-steward-m6-1.1-report.md | |
| 1.2 | 1 | pending | packages/core/src/vocabulary.ts, packages/core/src/vocabulary.test.ts, packages/core/src/records/common.ts, packages/core/src/records/common.test.ts, packages/core/src/exports.test.ts, development-artifacts/patch-steward-m6-1.2-report.md | |
| 1.3 | 1 | pending | packages/core/src/net/zip-entry.ts, packages/core/src/net/zip-entry.test.ts, development-artifacts/patch-steward-m6-1.3-report.md | |
| 1.4 | 1 | pending | packages/core/src/evidence/blob-id.ts, packages/core/src/evidence/blob-id.test.ts, packages/core/src/evidence/store-checks.ts, packages/core/src/evidence/store-checks.test.ts, development-artifacts/patch-steward-m6-1.4-report.md | |
| 1.5 | 1 | pending | packages/core/src/ownership/dedup.ts, packages/core/src/ownership/dedup.test.ts, development-artifacts/patch-steward-m6-1.5-report.md | |
| 1.6 | 1 | pending | packages/core/src/records/waiting.ts, packages/core/src/records/waiting.test.ts, packages/core/src/records/supersession.ts, packages/core/src/records/supersession.test.ts, development-artifacts/patch-steward-m6-1.6-report.md | |
| 1.7 | 1 | pending | packages/core/src/ownership/record.ts, packages/core/src/ownership/record.test.ts, development-artifacts/patch-steward-m6-1.7-report.md | |
| 1.8 | 1 | pending | packages/core/src/ownership/artifacts.ts, packages/core/src/ownership/artifacts.test.ts, development-artifacts/patch-steward-m6-1.8-report.md | |
| 1.9 | 1 | pending | packages/core/src/ownership/events.ts, packages/core/src/ownership/events.test.ts, development-artifacts/patch-steward-m6-1.9-report.md | |
| 1.10 | 1 | pending | packages/core/src/ownership/caps.ts, packages/core/src/ownership/caps.test.ts, development-artifacts/patch-steward-m6-1.10-report.md | |
| 1.11 | 1 | pending | packages/core/src/evidence/layout.ts, packages/core/src/evidence/layout.test.ts, packages/core/src/evidence/manifest.ts, packages/core/src/evidence/manifest.test.ts, development-artifacts/patch-steward-m6-1.11-report.md | |
| 1.12 | 1 | pending | packages/core/src/records/metrics-event.ts, packages/core/src/records/metrics-event.test.ts, packages/core/src/evidence/metrics.ts, packages/core/src/evidence/metrics.test.ts, development-artifacts/patch-steward-m6-1.12-report.md | |
| 1.13 | 1 | pending | packages/core/src/pipeline/job-summary.ts, packages/core/src/pipeline/job-summary.test.ts, development-artifacts/patch-steward-m6-1.13-report.md | |
| 1.14 | 1 | pending | packages/core/src/index.ts, packages/core/src/exports.test.ts, packages/core/src/conformance/invariant-5.test.ts, packages/core/src/conformance/never-pass-hosted.test.ts, development-artifacts/patch-steward-m6-1.14-report.md | |
| 1.15 | 1 | pending | development-artifacts/patch-steward-m6-1.15-report.md | |

### Phase 1 notes

- Decomposed at the commit that adds this block (message `decompose(patch-steward-m6): phase 1 steps`), base 08035c4 (the planner
  amendment of ES10 that this decomposition triggered; no phase 1 step embeds ES10). No new dependency, no network, no GitHub
  access; no file under packages/cli/, packages/action/, .github/, templates/, docs/ is in any scope. All steps route mechanical.
- Dependency graph (scopes pairwise disjoint within each wave; merge order within a wave is free):
  - W1 (parallel, no deps): 1.1 bounds; 1.2 vocabularies, record types, recordTreeIdSchema; 1.3 zip entry reader; 1.4 git blob id
    and store checks (append-only compare, read-back); 1.5 deduplication decision and echo predicate.
  - W2 (parallel; each starts once its own deps are merged): 1.6 waiting and supersession records (1.2); 1.7 ownership record
    (1.1, 1.2); 1.8 ownership artifacts, newest owner (1.1); 1.9 event authentication (1.1, 1.2); 1.10 run-name tags and caps
    (1.1, 1.2); 1.11 layout and manifest run_kind (1.2); 1.12 resolution metrics and hosted metrics builders (1.2); 1.13 job
    summary (1.1, 1.2).
  - W3: 1.14 root exports, exports test, invariant-5, never-pass-hosted (1.1 to 1.13).
  - W4: 1.15 gate (verification only; MAIN tree; after 1.14 merged).
  - Critical path: 1.1 or 1.2 -> any W2 step -> 1.14 -> 1.15.
- Environment / bootstrap:
  - Worker worktrees on short paths (C:/w/m6-<id>); `pnpm install --frozen-lockfile` per new worktree, sequentially.
  - Every acceptance runs its tests with the Vitest JSON reporter to node_modules/.m6-p1-<id>.json (ignored, not a tree change) and
    checks rendered titles with node; then the full `pnpm vitest run` (about 12 s; 141 files and 2673 tests at base), `pnpm
    typecheck`, eslint and prettier on the step's files, a static temp-file check, and a numeric control/bidi/zero-width check.
    jq is not installed.
  - The working tree is CRLF (core.autocrlf=true): acceptance greps never use a `$` anchor on file contents.
  - 1.14 also runs `pnpm build` and imports packages/core/dist. 1.15 runs IN the main tree.
  - Workers run Prettier only on their own .ts files, never on development-artifacts/.
- Couplings:
  - Only 1.14 edits packages/core/src/index.ts (87 -> 98 `export *` lines). Until then the new modules (net/zip-entry,
    evidence/blob-id, evidence/store-checks, records/waiting, records/supersession, ownership/*, pipeline/job-summary) are reachable
    only by relative import. 1.1, 1.2, 1.11, 1.12 add names to modules that are already root-exported (bounds, vocabulary,
    records/common, evidence/layout, evidence/metrics); all names were checked unique across core and cli (TS2308) and none starts
    with load, validate, resolve, parse, capture, or check.
  - exports.test.ts is edited by 1.2 (RECORD_TYPES 9 -> 12, new vocabulary tuples and schemas) and then by 1.14 (new modules).
  - invariant-5: parseRunName (1.10) is the only new root function matching the pinned prefixes; 1.14 adds it to the sorted list
    with a rejection assertion and fixes the pre-existing invariant5- temp-directory leak of that file.
  - 1.5 takes structural inputs whose listing kinds mirror 1.8 newestOwnershipArtifact ('none', 'unique', 'ambiguous',
    'incomplete') plus 'unavailable'; phase 3 maps the 1.8 result and the 1.7 decode result into DedupListingRead.
  - RECORD_TYPES gains ownership, waiting, supersession (1.2); only waiting.json is part of a run directory (1.11).
- Emergent contracts for phases 2 and 3 (pinned in the step files; names exact):
  - Constants (1.1): K38 OWNERSHIP_SETTLE_DELAY_MS; K39 OWNERSHIP_RECORD_MAX_BYTES; K40 OWNERSHIP_ARTIFACT_MAX_BYTES and
    OWNERSHIP_ARTIFACT_ENTRIES; K41 OWNERSHIP_LISTING_PAGES_MAX; K42 RUN_LIST_PAGES_MAX; K43 EVENT_PAYLOAD_MAX_BYTES; K44
    RUN_DISPLAY_TITLE_MAX_LENGTH; K45 EVIDENCE_CONFLICT_WAIT_STEP_MS and EVIDENCE_CONFLICT_WAIT_MAX_MS; K46
    EVIDENCE_FALLBACK_ENTRIES_MAX and EVIDENCE_FALLBACK_FILE_MAX_BYTES; K47 JOB_SUMMARY_MAX_LENGTH; K48 OWNERSHIP_RETENTION_DAYS;
    K49 APP_JWT_LIFETIME_SECONDS and APP_JWT_BACKDATE_SECONDS; K50 RUNTIME_ARCHIVE_MAX_BYTES; K51 SAME_RUN_ARTIFACT_RETENTION_DAYS.
  - Vocabularies (1.2): GATE_DISPOSITIONS, OWNERSHIP_DISPOSITIONS, CAP_STATES, WAITING_REASONS, SUPERSESSION_REASONS,
    RESOLUTION_KINDS, RUN_KINDS, WRAPPER_EVENT_NAMES, PULL_REQUEST_EVENT_ACTIONS, ISSUE_EVENT_ACTIONS, SENDER_TYPES (each with
    xSchema and type); recordTreeIdSchema (40 or 64 hex, never local).
  - Zip (1.3): readSingleZipEntry(bytes, { entryName, maxArchiveBytes, maxEntryBytes }) -> ok bytes or violation (reasons
    archive-bytes, archive with archiveReason, entry-count, entry-name, crc-mismatch); CRC and sizes from the central directory.
    Phase 2 passes OWNERSHIP_ARTIFACT_FILE, OWNERSHIP_ARTIFACT_MAX_BYTES, OWNERSHIP_RECORD_MAX_BYTES.
  - Store checks (1.4): gitBlobId(bytes); evidenceCompareSchema; verifyAppendOnlyCompare(compare, expectedPaths) (ES4);
    readBackTipAccepted(compare of new...tip) and verifyReadBackTree(entries, expected, 'exact' for a run directory or 'contains'
    for a metrics directory) (ES6). Paths passed in are whatever the caller lists (full store paths for compare, tree-relative for
    trees).
  - Dedup (1.5): decideDeduplication({ runAttempt, action, echo, listing, fallback, captured }) -> ok duplicate (echo,
    owner-unchanged, published-unchanged; keptOwner) or ok commit (rerun, reopened, no-owner, snapshot-changed, owner-ambiguous,
    listing-incomplete) or err ownership.listing-unavailable or ownership.record-invalid; order echo, rerun, reopened, listing
    rules; appliesListingDeduplication(runAttempt, action) (true exactly when runAttempt is 1 and action is not 'reopened': the
    listing-based rules and the ES10 fallback read decide; it NEVER gates the listing, which the gate performs for every event kind
    per DD8 step 2; phase 3 must not use it to skip the listing); isVerifiedEcho({ senderId, botUserId, triggeringResourceId,
    receipts }).
  - Records (1.6): waitingRecordSchema (state queued; reason consistent with counts; policy_revision tree id);
    supersessionRecordSchema (successor nullable; snapshot-changed requires live_snapshot_hash).
  - Ownership record (1.7): OWNERSHIP_ARTIFACT_FILE, OWNERSHIP_ARTIFACT_PREFIX, ownershipArtifactName(type, number),
    ownershipRecordSchema (check_id null, admission not-required, cap null exactly for early-exit, closure actions rejected),
    encodeOwnershipRecord -> canonical JSON bytes within K39, decodeOwnershipRecord(bytes, { repository, type, number,
    artifactName, workflowRunId }) with detail tokens size, encoding, json, schema, name, subject, repository, run.
  - Artifacts (1.8): newestOwnershipArtifact({ items, complete }, name) -> none, unique, ambiguous (sorted by id), or incomplete;
    items { id, name, createdAt, expiresAt, expired, workflowRunId }; artifactRetentionDays; ownershipRetentionShort.
  - Events (1.9): authenticateEvent(environment strings, payload bytes) -> AuthenticatedEvent or err gate.event-invalid (detail
    tokens name the failed check); eventIdentity(event) has the ownership record event keys; stewardConcurrencyGroup(repositoryId,
    type, number) = steward-<id>-<pr or issue>-<n>; closureResolution(event).
  - Caps (1.10): STEWARD_WRAPPER_PATHS; buildRunName and parseRunName (the RN1 grammar); runListQueryDate(now);
    evaluateCaps({ createdToday, inProgress, queued, now, botUserId, authorId, currentRunId, dailyLimit, authorLimit }) where each
    query result is { items: { id, path, event, status, createdAt, displayTitle }[], totalCount, complete } (phase 2 adapter sets
    complete false when pages exceed RUN_LIST_PAGES_MAX or any read fails).
  - Layout and manifest (1.11): WAITING_RUN_FILES, SUPERSESSIONS_DIRECTORY, supersessionStorePath, supersessionMetricsStorePath,
    repositoryStorePath(repository, storePath) -> '<owner>/<name>/<storePath>', latestRunDirectoryName(names) for the ES10 pick;
    manifest input runKind (written only when given; waiting manifests require the waiting run files and reject outcome files).
  - Metrics (1.12): maintainer-resolution payload optional keys resolution, paired_run, paired_snapshot_hash;
    buildWaitingMetricsEvents, buildSupersessionMetricsEvents, buildClosureMetricsEvent (closure resolution comes from 1.9
    closureResolution).
  - Job summary (1.13): renderJobSummary(input) with the exact line format pinned in step 1.13 (heading `## Patch Steward gate` or
    `## Patch Steward publish`, bullets Submission, Run, Status, then optional Snapshot, Policy revision, Owner, Caps, Evidence,
    Freshness, Ownership artifact retention, Failure); fitJobSummary(lines, max).
- Decisions taken at decomposition (within the brief's latitude; no gate, DoD, or brief text changed by them):
  - Module names refine the brief's layout: the pure parts of ES4 and ES6 live in evidence/store-checks.ts (evidence/git-store.ts
    stays for the phase 2 adapter); ES10's latest-directory pick is layout.ts latestRunDirectoryName; the job summary is
    pipeline/job-summary.ts as laid out.
  - Failure codes and causes: gate.event-invalid (infrastructure); ownership.listing-unavailable and ownership.record-invalid
    (github-unavailable; encode failure steward-defect); caps.run-list-unavailable (github-unavailable);
    evidence.store-not-append-only and evidence.readback-mismatch (infrastructure).
  - CP7 precedence: a created-today total_count over 1000 is over the daily cap even when that listing is incomplete (the API
    returns at most 1000 results, so CP6 cannot apply to it); in-progress and queued listings stay fail-closed.
  - CP2 path match also accepts a wrapper path followed by '@' and a suffix (tolerates a ref-suffixed `path`; confirm the real
    shape with phase 2 recorded run-list responses).
  - Ownership record decode additionally rejects a record whose run_id differs from the artifact's workflow_run.id when that id
    is known (strengthening of the forged-identity check).
  - check_id is z.null() and admission z.literal('not-required') in the ownership record (widened additively later).
  - The manifest writes run_kind only when the builder input sets it, so outcome manifests stay byte-identical to M05.
- Open items for later phases (not resolved here; no phase 1 step depends on them):
  - Brief DD7 and D4 say a verified echo is dropped "before capture", while DD8 orders capture, snapshot hash, echo, then the
    ownership listing, and DD7 needs the newest owner's receipts, which come from that listing. With no receipts recorded in M06
    the echo never fires, so the order has no behavioral effect now; decideDeduplication takes a precomputed echo flag and applies
    it first. The phase 3 decomposer should settle the gate order (amendment if the DD8 text must change). RESOLVED by amendment
    6f1e50c (DD8 rewritten: list for every event kind, closure branch, echo check, capture, dedup decision); see Revisions.
  - evidence/verify.ts (steward report) still requires decision.json and report.json and has no schema for the waiting,
    ownership, or supersession record types, so a waiting run directory does not verify. Phases 2 and 3 decide whether hosted
    verification needs it; the CLI stays unchanged.
  - OW7 successor attempt: the artifact listing gives workflow_run.id and created_at but no attempt; the supersession record
    successor is nullable; phase 3 decides whether to read the successor's record.
  - Job summary values (for example a long evidence location URL) are code spans truncated at 200 code units by the M05 escaper.
  - Pre-existing temp-directory leaks in packages/cli tests (prefixes policy-gitconfig-, policy-repo-, ps-cli-missing-) remain;
    packages/cli is out of scope in M06 except the live-test switch. The 1.15 leak check tolerates exactly those prefixes.

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| Phase | Trigger step | Amendment | Outcome |
| --- | --- | --- | --- |
| all (before phase 1) | owner gate (2026-09-27) | Owner gate answered: Q1-Q8 and Q10-Q16 A, Q9 C, Q17 owner performs OA1-OA4. Brief: gate items, I-list, owner actions marked APPROVED and binding; product secret names changed to `PATCH_STEWARD_APP_ID` and `PATCH_STEWARD_APP_PRIVATE_KEY` in WF1, WF4, WF12, WF13, AT1, OA1, G11 inventory, module layout, conformance titles, constraints; added SC5, S17, I21, project DoD item 18; re-pinned DoD items 8, 10, 12, 16; owner actions gained verify blocks and a needed-first-by column. Roadmap: gate APPROVED, S01-S17, earliest phase per OA, phase 4 needs OA1 on org-public only, phase 5 names the rest, phase 6 DoD items 1-18. | brief amended |
| 2 (found in phase 1 decomposition) | decomposer, phase 1 decomposition | Brief G4 ES10 named `submission.json` as the fallback source, but the submission record has no policy revision. ES10 now reads the run's `run.json` (same K46 bound, same single file read), validated with `runRecordSchema`, requires `subject.kind` `submission` matching the event's repository, type, number, and uses `subject.snapshot_hash` and `policy_revision`; schema or subject mismatch is treated as unavailable (DD6). Stale-fact correction plus stricter validation; no bound, scope, or DoD change. Ripple checked: DD4, OW8, K46, module layout `fallback-read.ts`, roadmap phase 2 scope and DoD cite ES10 generically and stay unchanged. No step file embeds ES10. | brief amended |
| 1 and 3 (open item recorded in Phase 1 notes) | owner decision 2026-09-27 (amendment note item 1; resolves the Phase 1 notes open item on the echo-check order) | Brief G2 DD8 rewritten as 8 numbered steps in the owner's order: authenticate (EV2, token mint and bot user id, trusted policy load, repository-gate check I5) -> ownership listing OW3, newest owner OW4, unique record download OW5 and validation OW2 (every event kind incl. reruns, reopens, closures; never skipped) -> closure branch EV4 (paired from that listing; never echo-dropped) -> verified-echo check DD7 (duplicate reason echo; stops before capture) -> capture and snapshot hash -> deduplication decision DD1-DD6 (ES10 fallback read only when listing kind none and neither rerun nor reopened) -> contract and caps -> commit. Policy load stays before the listing because the listing uses the policy budget (I13). DD7: receipts come from the unique newest owner's valid record, else the set is empty; an unverifiable echo is not an echo and the listing outcome reaches the decision unchanged. EV4: pairs from the DD8 step 2 listing; an unavailable listing fails before any upload (DD6). D4 and I1 aligned. Roadmap phase 3 DoD gains two fixture assertions (listing before capture; a verified echo captures and uploads nothing). Step impact: no step file edited; step 1.5 decideDeduplication contract stays valid unchanged (precomputed echo flag applied first; always false in the hosted gate after DD8 step 4). Contract-meaning change: needsOwnershipListing (defined in 1.5; re-exported and title-checked in 1.14 and 1.15) no longer decides whether the gate lists (the gate always lists); its truth table now states only when the ES10 fallback read and the listing-based dedup rules apply; its name and the 1.5 test title "the listing is needed only for first attempts of non-reopen events" are misleading but behaviorally correct; the decomposer may revise pending 1.5, 1.14, 1.15 (rename or retitle) or leave them; phase 3 must not use it to skip the listing. | brief amended |
| all (before phase 1 execution) | owner report 2026-09-27 (amendment note item 2) | Owner actions: owner reported OA1-OA4 complete 2026-09-27. OA1 verified by the lead on all three test-beds (Environment steward-publication secrets PATCH_STEWARD_APP_ID and PATCH_STEWARD_APP_PRIVATE_KEY, deployment branch policy master, no repository secret named PATCH_STEWARD_*); OA2 verified by the lead (steady-orchard/patch-steward-testbed-evidence private, 1 commit); the planner re-ran every brief OA1 and OA2 verify line (incl. organization secrets) and each printed its expected value. OA3 and OA4 remain proved only by S16 and S15. Updated: brief top paragraph, Owner actions heading and new Status table, Q17 row, Constraints, Assumptions; roadmap intro, phase 4 and phase 5 Depends on; ledger owner-actions. The re-verify-before-use rule is unchanged (no gate weakened). | brief amended |
| 1 | 1.5 (pre-run; pending dependents 1.14, 1.15) | Supervisor revision note before launch: after amendment 6f1e50c the gate always lists ownership artifacts, so the 1.5 helper name `needsOwnershipListing` and its test title "the listing is needed only for first attempts of non-reopen events" falsely implied the listing can be skipped. Decomposer revised in place (none of the three had run; superseded text reachable at 06e7f93): helper renamed `appliesListingDeduplication(runAttempt, action)` (unique across packages/core and packages/cli; no pinned invariant-5 prefix), truth table unchanged (true exactly when runAttempt is 1 and action is not 'reopened'); test retitled "listing-based deduplication applies only to first attempts of non-reopen events"; 1.5 context states the caller lists for every event kind and the helper never gates the listing. Updated 1.5 API block, rule text, title list, acceptance; 1.14 context, base check, functionExports, dist import check; 1.15 D2 title list (still 48 titles); Phase 1 notes Dedup (1.5) contract and the resolved echo-order open item. decideDeduplication, DedupInput, and every other contract unchanged. | steps 1.5, 1.14, 1.15 revised in place |
