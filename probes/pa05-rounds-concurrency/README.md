# PA05 — Round expansion and concurrency

Probes PA05 (round expansion and concurrency): a reusable workflow's fixed-maximum round pairs with
skip-when-unneeded `if` conditions, and job-level `concurrency` for per-submission serialization without
cancelling unrelated jobs in the same shared run.

## Sub-claims

- PA05.1 (assumption): a reusable workflow declaring a fixed maximum of `execute-N`/`assess-N` job pairs skips
  unused rounds through job-level `if` on the previous assess job's output; used rounds chain; `publish` still
  runs; outputs and artifacts hand off between rounds.
- PA05.2 (assumption): job-level `concurrency` keyed per submission serializes same-submission jobs across runs
  without cancelling jobs of other submissions inside the same shared run.
- PA05.3 (assumption): replacement semantics of job-level `concurrency` — with `cancel-in-progress: false`, what
  happens to an already-pending job when another job joins the same group; with `cancel-in-progress: true`,
  whether only the group's job or the whole run is cancelled.
- PA05.4 (measurement): limits relevant to fixed round expansion (jobs per run, reusable-workflow nesting depth
  and count per run, `needs` fan-in, practical maximum of rounds).

## Fixtures

- concurrency groups `probe-pa05-sub-A`, `probe-pa05-sub-B` (one per submission key dispatched); no branches.
- artifacts `probe-pa05-round-1`, `probe-pa05-round-2`, `probe-pa05-round-3` (retention 1 day), one per executed
  round, uploaded by `execute-N` and downloaded by `assess-N`.

## Deployment list

- probe-pa05-rounds.yml: org-public
- probe-pa05-run.yml: org-public
- probe-pa05-concurrency.yml: org-public

## Procedure

1. `cd <W> && pnpm install --frozen-lockfile`.
2. The canonical files are already in `probes/pa05-rounds-concurrency/` ([ADR-0023](../../docs/adr/0023-probe-suite-location.md)); actionlint all three.
3. `bash probes/smoke/tools/deploy.sh steady-orchard/patch-steward-testbed-public master "probe(PA05): deploy PA05 workflows" <W>/probes/pa05-rounds-concurrency/workflows/probe-pa05-rounds.yml <W>/probes/pa05-rounds-concurrency/workflows/probe-pa05-run.yml <W>/probes/pa05-rounds-concurrency/workflows/probe-pa05-concurrency.yml` → exit 0.
4. PA05.1: for r in 1 3 2: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa05-run.yml master rounds_needed=<r>`; collect jobs and facts of each run.
5. S1 (labels s1-r1-<k>, s1-r2-<k>, s1-r3-<k>):
   a. non-blocking dispatch R1: subs ["A","B"], sleep_seconds 150, cancel_in_progress false.
   b. read loop (every 20 s, <=4 min) until R1's jobs `work-A` and `work-B` are in_progress.
   c. dispatch R2: subs ["A"], sleep_seconds 30, cancel_in_progress false.
   d. read loop (every 20 s, <=2 min) until R2's run exists and its work-A is not in_progress (queued/waiting/pending).
   e. dispatch R3: subs ["A"], sleep_seconds 30, cancel_in_progress false.
   f. read loop until R1, R2, R3 are completed (<=12 min); collect jobs with times for all three and R1's facts.
6. S2 (labels s2-r4-<k>, s2-r5-<k>): dispatch R4: subs ["A","B"], sleep 150, cancel_in_progress true; wait until its
   work-A is in_progress; dispatch R5: subs ["A"], sleep 30, cancel_in_progress true; wait until both completed;
   collect jobs with times and the run conclusions.
7. Write the result file and README, citing run URLs `https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/<id>`.
   Then `cd <W> && pnpm exec prettier --write probes/pa05-rounds-concurrency/README.md probes/pa05-rounds-concurrency/results/org-public.md`.

## Decision rules

- PA05.1 (runs with `rounds_needed` 1, 3, 2): confirmed iff for each r: `execute-1..r` and `assess-1..r` concluded
  success, rounds r+1..3 were skipped, `publish` ran (`job=publish ran=yes`), each assess logged the artifact of
  its own round, and budgets decreased 100→90→80→70 as far as rounds ran; refuted iff an unused round ran, a
  needed round was skipped, `publish` did not run, or an output/artifact handoff failed.
- Scenario S1 (cancel false): R1 = subs ["A","B"], sleep 150; R2 = ["A"], sleep 30, started while R1's work-A
  runs; R3 = ["A"], sleep 30, started while R2's work-A is pending. Scenario S2 (cancel true): R4 = ["A","B"],
  sleep 150; R5 = ["A"], sleep 30, started while R4's work-A runs.
- PA05.2 confirmed iff in S1 no other work-A job started before R1's work-A completed (compare started/completed
  times) AND R1's work-B and `other` concluded success; refuted iff a work-A job ran concurrently with R1's
  work-A, or R1's work-B or `other` was cancelled.
- PA05.3 records (i) S1: R2's work-A conclusion after R3 joined (cancelled = the documented single-pending
  replacement) and R3's work-A timing; (ii) S2: R4's work-A, work-B, `other` conclusions and R4's run conclusion.
  Confirmed iff in S2 only R4's work-A was cancelled (work-B and `other` concluded success); refuted iff S2
  cancelled R4's work-B or `other` (the whole run); undetermined/ambiguous if R5 never overlapped R4's work-A. In
  the evidence, (i) cancels a PENDING job whatever event queued the newer one, so the design depends on ignored
  events never joining a submission's group.
- PA05.4 confirmed when the rows below are recorded (exercised values from the runs; documented values with URL):
  `jobs per run (exercised)` (the rounds=3 run's job count), `matrix jobs per run` (256, documented), `reusable
nesting depth` (2 exercised; 10 documented), `reusable workflows per file` (50 documented), `needs fan-in` (7
  exercised by publish; not documented), `round pairs` (3 exercised), `pending per concurrency group` (1
  documented default; 100 documented with `queue: max`).
