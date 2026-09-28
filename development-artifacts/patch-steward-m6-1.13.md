# Step 1.13

- id: 1.13
- depends_on: [1.1, 1.2]
- route: mechanical
- objective: Add a pure, bounded, escaped Markdown job-summary renderer for the hosted gate and publish jobs.
- files_in_scope:
    - packages/core/src/pipeline/job-summary.ts
    - packages/core/src/pipeline/job-summary.test.ts
    - development-artifacts/patch-steward-m6-1.13-report.md
- context: |
    Repo: pnpm monorepo (Node 24, TypeScript ESM, Vitest), commands run in Git Bash from the worktree root.
    Domain: the hosted `gate` and `publish` jobs append a short Markdown summary to GITHUB_STEP_SUMMARY: submission, disposition or
    outcome, snapshot hash, policy revision, owner kept or committed, cap counts, evidence commit and store location, freshness,
    ownership artifact retention, and the failure code on failure. Every derived value is shown as a code span through the existing
    report escaper; the summary never contains a title, body, login, or report text (the input type has no such fields); total length
    is at most JOB_SUMMARY_MAX_LENGTH characters. A later step writes the text to the file; this step is the pure renderer only.

    Existing building blocks (read them): packages/core/src/report/escape.ts exports reportCodeSpan(value: string): string (escapes
    newlines, control, bidi, and zero-width characters as visible text, truncates values over 200 code units with ' (truncated)',
    and fences with enough backticks) and reportCharacterViolations(text): readonly string[] (code points that must not appear raw;
    empty for clean text). packages/core/src/policy/bounds.ts: JOB_SUMMARY_MAX_LENGTH = 65536 and OWNERSHIP_RETENTION_DAYS = 90
    (step 1.1). packages/core/src/vocabulary.ts: Outcome, WaitingState, SubmissionType, and (step 1.2) GateDisposition.

    Required API of packages/core/src/pipeline/job-summary.ts (exact names; export nothing else):
      export type JobSummaryJob = 'gate' | 'publish';
      export type JobSummaryStatus = GateDisposition | Outcome | WaitingState | 'failed';
      export type JobSummaryFreshness = 'confirmed' | 'superseded' | 'unknown';
      export interface JobSummaryInput {
        readonly job: JobSummaryJob;
        readonly repository: string;
        readonly subjectType: SubmissionType;
        readonly subjectNumber: number;
        readonly runId: number;
        readonly runAttempt: number;
        readonly status: JobSummaryStatus;
        readonly snapshotHash: string | null;
        readonly policyRevision: string | null;
        readonly owner: { readonly action: 'kept' | 'committed'; readonly runId: number; readonly runAttempt: number } | null;
        readonly caps: { readonly dailyCount: number; readonly dailyLimit: number; readonly authorCount: number;
                         readonly authorLimit: number } | null;
        readonly evidence: { readonly commit: string; readonly location: string } | null;
        readonly freshness: JobSummaryFreshness | null;
        readonly retentionDays: number | null;
        readonly failureCode: string | null;
      }
      export function renderJobSummary(input: JobSummaryInput): string;
      export function fitJobSummary(lines: readonly string[], maxLength: number): string;
    Exact output of renderJobSummary: the lines below joined with '\n' plus one trailing '\n' (S(x) = reportCodeSpan(x); numbers
    through String(n)), passed through fitJobSummary(lines, JOB_SUMMARY_MAX_LENGTH):
      '## Patch Steward gate' or '## Patch Steward publish'
      ''
      '- Submission: ' + S(repository) + ' ' + ('pull request' for pull_request, 'issue' for issue) + ' ' + S(String(subjectNumber))
      '- Run: ' + S(runId + '-' + runAttempt)
      '- Status: ' + S(status)
      '- Snapshot: ' + S(snapshotHash)                                  only when snapshotHash !== null
      '- Policy revision: ' + S(policyRevision)                         only when policyRevision !== null
      '- Owner: ' + owner.action + ' ' + S(owner.runId + '-' + owner.runAttempt)   only when owner !== null
      '- Caps: daily ' + S(dailyCount) + ' of ' + S(dailyLimit) + ', author ' + S(authorCount) + ' of ' + S(authorLimit)
                                                                        only when caps !== null
      '- Evidence: commit ' + S(commit) + ' at ' + S(location)          only when evidence !== null
      '- Freshness: ' + S(freshness)                                    only when freshness !== null
      '- Ownership artifact retention: ' + S(String(retentionDays)) + ' days', plus ' (shorter than requested)' when retentionDays <
        OWNERSHIP_RETENTION_DAYS                                        only when retentionDays !== null
      '- Failure: ' + S(failureCode)                                    only when failureCode !== null
    fitJobSummary: text = lines.join('\n') + '\n'; if text.length <= maxLength return text; otherwise keep the first line always and
    drop lines from the end until kept.join('\n') + '\n' + '- Summary truncated.\n' fits within maxLength, and return that.

    Conventions: ESM relative imports end in '.js' (`import { reportCodeSpan } from '../report/escape.js';`); `import type` for types;
    tsconfig strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; ESLint recommended. The module lives in
    packages/core/src/pipeline/, which a conformance scan checks: import only '../report/escape.js', '../policy/bounds.js', and
    '../vocabulary.js' (no module whose path contains llm, model, copilot, openai, anthropic, sandbox, container, docker, or runner).
    Prettier (single quotes, semicolons, trailing commas, printWidth 132) only on this step's .ts files. No comments except short WHY;
    no planning identifiers in source or titles. Tests pure; build hostile characters with String.fromCharCode (10, 13, 0x202e,
    0x200b). Do not edit packages/core/src/index.ts.
- actions: |
    1. FIRST, verify the base: `grep -c "export const JOB_SUMMARY_MAX_LENGTH = 65536;" packages/core/src/policy/bounds.ts` prints 1
       and `grep -c "export const GATE_DISPOSITIONS" packages/core/src/vocabulary.ts` prints 1. If either prints 0, STOP and report
       status missing-base naming the missing step (1.1 or 1.2) in the report file; do not fetch, merge, or improvise.
    2. Create packages/core/src/pipeline/job-summary.ts exactly as specified.
    3. Create packages/core/src/pipeline/job-summary.test.ts (describe 'job summary') with plain it() tests and exactly these titles:
       - 'gate summaries list disposition, snapshot, owner, and caps' (assert the exact full text for a runnable gate input with
         owner committed, caps 3/50 and 1/2, retention 90)
       - 'publish summaries list outcome, evidence, and freshness' (exact full text; evidence commit 40 hex, location a
         https://github.com/.../tree/steward-evidence/... URL under 200 characters)
       - 'absent fields are omitted' (all nullable fields null -> exactly five lines plus the trailing newline)
       - 'derived values render as code spans'
       - 'hostile values cannot break the summary layout' (failureCode and location containing a backtick, newline, carriage return,
         '@user', '#12', '<b>', String.fromCharCode(0x202e) and String.fromCharCode(0x200b): the output has exactly the expected
         number of '\n' characters, every line is empty or starts with '## ' or '- ', and reportCharacterViolations(output) is empty)
       - 'short retention is flagged' (89 -> ' (shorter than requested)'; 90 -> no flag)
       - 'summaries never exceed the bound' (fitJobSummary with a small maxLength keeps the heading and ends with
         '- Summary truncated.' plus newline; renderJobSummary output length <= JOB_SUMMARY_MAX_LENGTH)
    4. Run: pnpm exec prettier --write packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
- acceptance: |
    Run each from the worktree root in Git Bash; each must give exactly the stated result.
    1. pnpm vitest run packages/core/src/pipeline/job-summary.test.ts --reporter=json --outputFile=node_modules/.m6-p1-1.13.json
       -> exit 0
    2. node -e "const r=require('./node_modules/.m6-p1-1.13.json');const got=new Set();for(const f of r.testResults)for(const a of f.assertionResults)if(a.status==='passed')got.add(a.title);const need=['gate summaries list disposition, snapshot, owner, and caps','publish summaries list outcome, evidence, and freshness','absent fields are omitted','derived values render as code spans','hostile values cannot break the summary layout','short retention is flagged','summaries never exceed the bound'];const miss=need.filter(t=>!got.has(t));console.log(miss.length?'MISSING '+JSON.stringify(miss):'titles ok')"
       -> prints exactly: titles ok
    3. pnpm vitest run -> exit 0 (includes the zero-execution conformance scan over packages/core/src/pipeline)
    4. pnpm typecheck -> exit 0
    5. pnpm exec eslint packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts -> exit 0
    6. pnpm exec prettier --check packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts -> exit 0
    7. cat packages/core/src/pipeline/job-summary.test.ts | grep -cE "mkdtemp|tmpdir|writeFile" -> prints 0 (grep exit status 1 is expected)
    8. node -e "const fs=require('fs');const R=[[0,8],[11,12],[14,31],[127,159],[8203,8207],[8232,8238],[8288,8292],[8294,8297],[65279,65279]];let bad=0;for(const f of process.argv.slice(1)){const s=fs.readFileSync(f,'utf8');for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(R.some(([a,b])=>c>=a&&c<=b)){console.log('BAD '+f);bad++;break}}}console.log(bad?'dirty':'clean')" packages/core/src/pipeline/job-summary.ts packages/core/src/pipeline/job-summary.test.ts
       -> prints exactly: clean
- rollback: |
    git revert <this step's commit> (removes the two new files).
