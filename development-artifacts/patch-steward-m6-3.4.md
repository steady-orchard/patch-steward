# Step 3.4

- id: 3.4
- depends_on: []
- route: mechanical
- objective: Add the pure publish-freshness rules to the ownership module (find this run's own ownership artifact, classify the top of a fresh listing, and decide current, superseded, or unknown in the fixed order) as packages/core/src/ownership/freshness.ts.
- files_in_scope:
    - packages/core/src/ownership/freshness.ts
    - packages/core/src/ownership/freshness.test.ts
    - development-artifacts/patch-steward-m6-3.4-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, zod v4, Vitest); run commands in Git Bash from the worktree root. Built-ins only.

    Why: after writing evidence, the hosted publish job waits a settle delay, re-lists the submission's ownership artifacts, and
    decides freshness. The rules are evaluated in this order, FIRST MATCH WINS:
      (a) the listing is unavailable or incomplete, or this run's own artifact (the unexpired artifact of that name whose
          workflowRunId equals this run id) is absent or appears more than once, or it differs in artifact id or createdAt from
          the one publish read before its evidence commit -> UNKNOWN;
      (b) two or more unexpired artifacts share the greatest createdAt, whether or not this run's artifact is among them ->
          UNKNOWN (a tie never supersedes and never publishes);
      (c) the unique newest artifact is not this run's -> its record must have been downloaded and validated with a run id
          equal to that artifact's workflowRunId: valid -> SUPERSEDED reason 'newer-owner' with successor { run_id, run_attempt
          from that record, artifact_created_at from the listing }; missing or invalid record -> UNKNOWN;
      (d) this run's artifact is the unique newest -> the live recapture (live snapshot hash and live policy revision) must be
          available: unavailable -> UNKNOWN; either value differs from the recorded ones -> SUPERSEDED reason 'snapshot-changed'
          with the live snapshot hash; else CURRENT.
    Artifact ids never order artifacts; only createdAt does. This module is pure: the network reads are done by a later step.

    Existing code to use (packages/core/src/ownership/artifacts.ts): types OwnershipArtifactItem ({ id, name, createdAt, expiresAt:
    string | null, expired, workflowRunId: number | null }) and OwnershipListing ({ items, complete }); newestOwnershipArtifact(
    listing, name) -> { kind: 'none' } | { kind: 'unique', artifact } | { kind: 'ambiguous', artifacts } | { kind: 'incomplete' }
    (incomplete also when a considered createdAt does not parse; it filters by name and unexpired).

    Required API (exact names; export nothing else; names verified unique across packages/core/src and packages/cli/src):
      export const FRESHNESS_UNKNOWN_REASONS = ['listing-unavailable', 'listing-incomplete', 'own-missing', 'own-changed', 'tie',
        'successor-unavailable', 'recapture-unavailable'] as const;
      export type FreshnessUnknownReason = (typeof FRESHNESS_UNKNOWN_REASONS)[number];
      export type OwnArtifactLookup =
        | { readonly kind: 'found'; readonly artifact: OwnershipArtifactItem }
        | { readonly kind: 'missing' } | { readonly kind: 'duplicate' } | { readonly kind: 'incomplete' };
      export function findOwnOwnershipArtifact(listing: OwnershipListing, name: string, runId: number): OwnArtifactLookup;
        // incomplete listing -> 'incomplete'; items with item.name === name && !item.expired && item.workflowRunId === runId:
        // 0 -> 'missing', 1 -> 'found', more -> 'duplicate'
      export interface OwnArtifactReference { readonly id: number; readonly createdAt: string; readonly workflowRunId: number }
      export type FreshnessTop =
        | { readonly kind: 'unknown'; readonly reason: FreshnessUnknownReason }
        | { readonly kind: 'own-newest' }
        | { readonly kind: 'newer'; readonly artifact: OwnershipArtifactItem };
      export function freshnessTop(listing: OwnershipListing | null, name: string, own: OwnArtifactReference): FreshnessTop;
        // null -> unknown 'listing-unavailable'; !complete -> 'listing-incomplete'; findOwnOwnershipArtifact(listing, name,
        // own.workflowRunId): missing or duplicate -> 'own-missing'; found but id or createdAt differ from own -> 'own-changed';
        // then newestOwnershipArtifact: 'incomplete' -> 'listing-incomplete'; 'none' -> 'own-missing'; 'ambiguous' -> 'tie';
        // 'unique' with artifact.id === own.id -> { kind: 'own-newest' }; else { kind: 'newer', artifact }
      export type SuccessorRead =
        | { readonly kind: 'valid'; readonly runId: number; readonly runAttempt: number } | { readonly kind: 'unavailable' };
      export type LiveSnapshotRead =
        | { readonly kind: 'captured'; readonly snapshotHash: string; readonly policyRevision: string }
        | { readonly kind: 'unavailable' };
      export interface FreshnessDecisionInput {
        readonly top: FreshnessTop;
        readonly successor: SuccessorRead | null;   // read only when top.kind === 'newer'
        readonly live: LiveSnapshotRead | null;     // read only when top.kind === 'own-newest'
        readonly recorded: { readonly snapshotHash: string; readonly policyRevision: string };
      }
      export type PublishFreshness =
        | { readonly kind: 'current' }
        | { readonly kind: 'superseded'; readonly reason: 'newer-owner';
            readonly successor: { readonly run_id: number; readonly run_attempt: number; readonly artifact_created_at: string } }
        | { readonly kind: 'superseded'; readonly reason: 'snapshot-changed'; readonly liveSnapshotHash: string }
        | { readonly kind: 'unknown'; readonly reason: FreshnessUnknownReason };
      export function decidePublishFreshness(input: FreshnessDecisionInput): PublishFreshness;
        // top unknown -> unknown(top.reason); top newer: successor null or 'unavailable', or successor.runId !==
        // top.artifact.workflowRunId -> unknown 'successor-unavailable'; else superseded newer-owner with successor { run_id:
        // successor.runId, run_attempt: successor.runAttempt, artifact_created_at: top.artifact.createdAt };
        // top own-newest: live null or 'unavailable' -> unknown 'recapture-unavailable'; live.snapshotHash !==
        // recorded.snapshotHash or live.policyRevision !== recorded.policyRevision -> superseded snapshot-changed with
        // liveSnapshotHash = live.snapshotHash; else { kind: 'current' }.

    This file lives in packages/core/src/ownership/, which a conformance test scans: the file must import no file-system or
    network module and must not contain the text `fetch(` anywhere (comments included). Import only from './artifacts.js' (types
    and newestOwnershipArtifact).

    Test data: name 'steward-ownership-issue-29'; items like { id, name, createdAt: '2026-09-28T10:00:05Z', expiresAt:
    '2026-12-27T10:00:05Z', expired: false, workflowRunId }; own run 36081628326 with artifact id 900.

    Conventions: ESM relative imports end in '.js' (type-only imports use `import type`); strict tsconfig (noUncheckedIndexedAccess,
    exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters); Prettier (single quotes, semicolons, trailing commas, printWidth
    132) only on this step's files; comments only for a non-obvious WHY; no planning identifiers in code, comments, or test titles;
    never write raw control, bidi, or zero-width characters. Do not edit packages/core/src/index.ts. Tests are pure: no temp files,
    no child processes, no network.
- actions: |
    1. Create packages/core/src/ownership/freshness.ts per context.
    2. Create packages/core/src/ownership/freshness.test.ts (describe 'publish freshness'), plain it(...) with EXACTLY these titles:
       - 'the own artifact is found by workflow run id'
       - 'a missing, duplicated, or incomplete own artifact is not found' (missing -> 'missing'; two items for the run ->
         'duplicate'; complete false -> 'incomplete'; an expired own item -> 'missing')
       - 'the unique newest own artifact is fresh at the top'
       - 'a newer artifact by creation time is found even with a smaller id' (other artifact id 5, createdAt one second later ->
         { kind: 'newer' } with that artifact; with the other artifact older but a larger id -> 'own-newest')
       - 'a tie at the greatest creation time is unknown' (two other artifacts share a createdAt later than own -> 'tie')
       - 'a tie that includes the own artifact is unknown' (own and another share the greatest createdAt -> 'tie')
       - 'an own artifact that changed since it was read is unknown' (same run, other id -> 'own-changed'; other createdAt ->
         'own-changed')
       - 'an unavailable or incomplete listing is unknown' (null -> 'listing-unavailable'; complete false ->
         'listing-incomplete'; an unparsable createdAt on another item -> 'listing-incomplete')
       - 'a newer owner supersedes with the successor attempt' (successor { kind: 'valid', runId: newer.workflowRunId, runAttempt:
         2 } -> superseded newer-owner with successor { run_id, run_attempt: 2, artifact_created_at: newer.createdAt })
       - 'a newer owner without a valid record is unknown' (successor null, 'unavailable', or a different runId ->
         'successor-unavailable')
       - 'a changed live snapshot or policy revision supersedes' (both variants -> snapshot-changed with the live hash)
       - 'an unchanged live snapshot is current'
       - 'a failed recapture is unknown' (live null or 'unavailable' -> 'recapture-unavailable')
       IMPORTANT: an existing conformance test ('ownership modules import no file system or network module' in
       packages/core/src/conformance/never-pass-hosted.test.ts) scans EVERY .ts file in packages/core/src/ownership/, test files
       included: freshness.test.ts must import only 'vitest' and './freshness.js' / './artifacts.js' (no node: or fs module) and
       must not contain the text `fetch(` anywhere.
    3. Run: pnpm exec prettier --write packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/ownership/freshness.test.ts packages/core/src/conformance/never-pass-hosted.test.ts --reporter=json --outputFile=node_modules/.m6-p3-3.4.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p3-3.4.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['the own artifact is found by workflow run id','a missing, duplicated, or incomplete own artifact is not found','the unique newest own artifact is fresh at the top','a newer artifact by creation time is found even with a smaller id','a tie at the greatest creation time is unknown','a tie that includes the own artifact is unknown','an own artifact that changed since it was read is unknown','an unavailable or incomplete listing is unknown','a newer owner supersedes with the successor attempt','a newer owner without a valid record is unknown','a changed live snapshot or policy revision supersedes','an unchanged live snapshot is current','a failed recapture is unknown','ownership modules import no file system or network module'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. grep -c "fetch(" packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts
       -> prints two lines ending in :0 (grep exit status 1 is expected)
    4. pnpm vitest run -> exit 0 (includes the existing check that ownership modules import no file system or network module)
    5. pnpm typecheck -> exit 0
    6. pnpm exec eslint packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts -> exit 0
    7. pnpm exec prettier --check packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts -> exit 0
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/ownership/freshness.ts packages/core/src/ownership/freshness.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
