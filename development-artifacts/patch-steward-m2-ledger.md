# patch-steward-m2 — Ledger

Single source of truth for execution state. Sections are owned by different agents — the planner seeds Plan + Phases; the
decomposer fills Steps per phase; the supervisor updates Steps and appends Revisions.

## Plan

- plan-name: patch-steward-m2
- current-phase: 7 — DONE (all phases 1–7 done). Phase 7 first completed at `1282496`; REOPENED 2026-09-25 for owner order 13 (amendment 13 at `6e8dd0d`, revision `f5ba028`) and completed again after step 7.5 (`74b29af`, the three fixes) and gate re-run 7.6 (`77fa769`, OVERALL: PASS; supervisor DoD verification in the Phase 7 notes, "PHASE 7 COMPLETE AGAIN"). Phase 7 added by amendment 9, answers recorded by amendment 10, `CLAUDE.md` persistence bullet by amendment 11, RS1–RS10 by amendment 12; decomposed at `e60adde`, revised at `342fbd8` and `f5ba028`
- working-branch: milestone/2-platform-assumption-probes
- starting-commit: 10fcaf2d575037be7c13e0ba0719feb53d51d71f
- default-branch: develop
- artifacts-dir: development-artifacts

## Phases

| Phase | Status  | Notes                                                                                                                                                                                                                                                                                                                                                         |
| ----: | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | done    | Harness, test-bed baseline, smoke. May end in one `needs-human` batch of owner actions.                                                                                                                                                                                                                                                                       |
|     2 | done    | Live probes PA01–PA09. Outcomes are findings, never acceptance conditions. PA08 cap step (owner decision 8) runs last; cap session ceiling `S = 10` (amendment 2).                                                                                                                                                                                            |
|     3 | done    | Findings record, measured limits, steady state, decision packet. Owner gate follows: answers return through a planner amendment of the brief.                                                                                                                                                                                                                 |
|     4 | done    | Re-probes Q3 (org-private schedule files, bound 6 h per file) and Q4 (PA04.1 wirings W1/W2 on all three test-beds), steady state, follow-up packet 2 (F1 always; F2 only if a re-probed PA03 cell is not `confirmed`). Unblocked by amendment 5. No Copilot request; allow-listed write forms only; foreground agents only. |
|     5 | done    | Governing-document changes for Q1, Q2, Q5–Q9, C1, plus the unconditional items (`probes/`, PA01–PA09, `.prettierignore` statements; owner decision 9, DoD item 3); decided dispositions. Does not wait for the F1/F2 answers; F1-reserved text untouched (brief K25). Q1E (amendment 7) is Phase 6 work: Phase 5 steps 5.1–5.6 unchanged; the ledger's Phase 5 "LEAD ITEM" is resolved by amendment 7. |
|     6 | done    | F1 B document changes (explicit per-name `secrets:` mapping; never `secrets: inherit`), PA04.1 ×3 and PA04 roll-up dispositions, milestone verification. Unblocked by amendment 6 (F1 = B; F2 not raised); decomposable after Phase 5 is done. Content checks: brief K28–K36. Amendment 7 adds Q1E (owner's Q1 extension: evidence-store push restriction and required code-owner review unavailable where the plan and visibility offer no rulesets; `steward init` and SP02 steps 4 and 8 detect and report it; no disposition change); checks K37–K52; qualifies the Phase 5 Q5 sentences (A03 §6.4, P02 SP02 step 7). Amendment 8 adds §13 row "Compromised steward release" (clause "review updates through protected policy/wrapper paths") to the Q1E restatements; checks K53–K55; K35 pins X13s (canary) instead of X13c; width rule 471 characters of cell text. |
|     7 | done    | Done again 2026-09-25 after the post-completion revision for owner order 13 (amendment 13 at `6e8dd0d`, "Fix, then merge": ADR-0002/ADR-0004 dated 2026-09-16 with their derivation and index rows, ADR-0025 evidence links placed by claim, `CLAUDE.md` format-check bullet = brief `LF`; check K80): step 7.5 `74b29af`, gate re-run 7.6 `77fa769` (OVERALL: PASS); supervisor re-ran gate7.sh local → GATE7-LOCAL OK and dod → GATE7-DOD OK; DoD 6 incl. owner order 13 judged PASS (Phase 7 notes); completed steps 7.1–7.4 untouched. First completion: done 2026-09-25 (steps 7.1–7.4; gate OVERALL: PASS; supervisor re-ran gate7.sh local → GATE7-LOCAL OK and dod → GATE7-DOD OK; DoD 6 judged PASS, see Phase 7 notes). Owner order 2026-09-25 (amendments 9, 10, 11, and 12): 33 MADR ADRs in `docs/adr` (ADR-0001–ADR-0016 = architecture §1.2 decisions 1–16; ADR-0017–ADR-0033 chronological; Source lines fixed, persistent locations only), §1.2 table becomes a pointer; plan §9 and `PDxx` citations unchanged (owner: decisions in the planning document are not removed); architecture decision-number citations rewritten to ADR ids; persistence rule: no persistent document cites a planning or implementation document or identifier (K74; fixes: whitepaper "(M01)", fixtures/README.md lines 3 and 12); `CLAUDE.md` states the rule as one bullet, exactly brief `LP` (amendment 11; K78; K74 and NOCITE′ exclude that line); `probes/` exception (only the P7-Q3 rewrites and the pa04 ADR-0033 line); no `development-artifacts/` path outside it (K69, no exception); milestone re-verification re-baselined (brief "Milestone re-verification after Phase 7": k6 summaries FAIL 1, findings FAIL 1, all FAIL 3, project-dod FAIL 4, milestone-verify OK — amendment 12: RS5 restates R10's anchor). Amendment 12 (owner order 12): before the §1.2 removal, six §1.2 clauses no governing section stated (C4.1, C5.2, C5.3, C13.3, C14.3, C16.3) are restated byte-exact as brief RS1–RS10 (RS1–RS6 architecture, with the removal; RS7–RS10 processes); K79 (literals + coverage audit `restated=39 not-restated=0`); K71 RS exception. Answers: P7-Q1 A, P7-Q2 A revised, P7-Q3 A, P7-Q4 A, P7-Q5 A. Content checks K56–K79 and NOCITE′. Decomposable. Local only; foreground agents only. |

## Steps

<!-- decomposer fills per phase: id | phase | status | files | commit,
     plus a "Phase <N> notes" block: dependency graph, couplings, emergent contracts -->

| id   | phase | status  | files | commit |
| ---- | ----- | ------- | ----- | ------ |
| 1.1  | 1     | done | probes/README.md, development-artifacts/patch-steward-m2-1.1-report.md | fd7cb76a7b9b486bc418105e5e21765d080535c3 |
| 1.2  | 1     | done | probes/smoke/README.md, probes/smoke/workflows/probe-smoke-machinery.yml, probes/smoke/tools/deploy.sh, probes/smoke/tools/dispatch.sh, probes/smoke/tools/wait-run.sh, probes/smoke/results/org-public.md, development-artifacts/patch-steward-m2-1.2-report.md | 9091c0f5f990dd55775b8683a7bdf35212845989 (in-tree) |
| 1.3  | 1     | removed | (none — see Phase 1 notes) | |
| 1.4  | 1     | done (verify-only: 50fc483 verified against the corrected acceptance; merged report keeps its honest `status: fail` against superseded line 1) | development-artifacts/patch-steward-m2-1.4-report.md | e084dbf363b07b92ada5f37ef0f78bc891668060 |
| 1.5  | 1     | done | probes/smoke/results/org-private.md, development-artifacts/patch-steward-m2-1.5-report.md | fed6b8cdd43b944342034bdbe771078a8873c8e5 (in-tree) |
| 1.6  | 1     | done | probes/smoke/results/personal.md, development-artifacts/patch-steward-m2-1.6-report.md | 2999f4e658c4dde33c39006cc2d3a3f507e92ada (in-tree) |
| 1.7  | 1     | done (attempt 2; attempt 1 = 30c2e0b reverted by b81356a) | probes/smoke/tools/environment.sh, probes/smoke/tools/capabilities.sh, probes/testbeds.md, development-artifacts/patch-steward-m2-1.7-report.md | 126f250b0927d8f38896b63e35a9c4dbbee7c9a8 (in-tree) |
| 1.8  | 1     | done | probes/pa03-trusted-triggers/workflows/probe-pa03-schedule.yml, probes/pa03-trusted-triggers/workflows/probe-pa03-schedule-env.yml, probes/pa03-trusted-triggers/fixtures/probe-pa03-base/probe-pa03-schedule.yml, development-artifacts/patch-steward-m2-1.8-report.md | 620095d219b015b45a52bccdc2808adff20b0e88 (in-tree) |
| 1.9  | 1     | done | probes/testbeds.md, development-artifacts/patch-steward-m2-1.9-report.md | 031d29a13feaea0d919b31f537cc470b2f7a4671 (in-tree) |
| 1.10 | 1     | done (gate OVERALL: PASS; revised 2026-09-24 twice: depends_on + 1.11, + 1.12; base assertion + 1.11, + 1.12; DoD items unchanged) | development-artifacts/patch-steward-m2-1.10-report.md | 1e66164dbca970be8b8e6c0b40da1f0e84a08795 (in-tree) |
| 1.11 | 1     | done | probes/testbeds.md, development-artifacts/patch-steward-m2-1.11-report.md | 3105c0747e191d45196a94dbf15f1ab5ff5f28a6 (in-tree) |
| 1.12 | 1     | done | probes/testbeds.md, development-artifacts/patch-steward-m2-1.12-report.md | e339d1d46959fd12ec339afd2fe6022d4fc0e5f9 (in-tree) |
| 2.1  | 2     | done | probes/pa01-required-checks/README.md, probes/pa01-required-checks/workflows/probe-pa01-sequence.yml, probes/pa01-required-checks/fixtures/ruleset-required.json, probes/pa01-required-checks/fixtures/base.txt, probes/pa01-required-checks/fixtures/head.txt, probes/pa01-required-checks/results/org-public.md, development-artifacts/patch-steward-m2-2.1-report.md | 273bbf64c61955dc4c5d4c471d95513145837b12 |
| 2.2  | 2     | done | probes/pa02-ownership-artifacts/README.md, probes/pa02-ownership-artifacts/workflows/probe-pa02-upload.yml, probes/pa02-ownership-artifacts/workflows/probe-pa02-list.yml, probes/pa02-ownership-artifacts/results/org-public.md, development-artifacts/patch-steward-m2-2.2-report.md | 9b100ec5eb237ded1db3105d9083e3c6724fe2e8 |
| 2.3  | 2     | done | probes/pa03-trusted-triggers/README.md, probes/pa03-trusted-triggers/workflows/probe-pa03-events.yml, probes/pa03-trusted-triggers/workflows/probe-pa03-upstream.yml, probes/pa03-trusted-triggers/fixtures/probe-pa03-base/probe-pa03-events.yml, probes/pa03-trusted-triggers/fixtures/probe-pa03-base-noguard/probe-pa03-events.yml, probes/pa03-trusted-triggers/fixtures/probe-pa03-head/probe-pa03-events.yml, probes/pa03-trusted-triggers/fixtures/head-marker.txt, probes/pa03-trusted-triggers/results/org-public.md, development-artifacts/patch-steward-m2-2.3-report.md | 2f024bebd4d31c9f4fd8099f3d91515a1e834d5b |
| 2.4  | 2     | done | probes/pa04-privilege-separation/README.md, probes/pa04-privilege-separation/workflows/probe-pa04-callee.yml, probes/pa04-privilege-separation/workflows/probe-pa04-envs.yml, probes/pa04-privilege-separation/workflows/probe-pa04-callee-perms.yml, probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-issues.yml, probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-copilot.yml, probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-grant.yml, probes/pa04-privilege-separation/workflows/probe-pa04-pipeline.yml, probes/pa04-privilege-separation/workflows/probe-pa04-publish.yml, probes/pa04-privilege-separation/results/org-public.md, development-artifacts/patch-steward-m2-2.4-report.md | f466b6323928139203bad8eb0386e4b6ef1f8c90 |
| 2.5  | 2     | done | probes/pa05-rounds-concurrency/README.md, probes/pa05-rounds-concurrency/workflows/probe-pa05-rounds.yml, probes/pa05-rounds-concurrency/workflows/probe-pa05-run.yml, probes/pa05-rounds-concurrency/workflows/probe-pa05-concurrency.yml, probes/pa05-rounds-concurrency/results/org-public.md, development-artifacts/patch-steward-m2-2.5-report.md | 56d499af646c67e43943b2c7fdc6a15831e4c58e |
| 2.6  | 2     | superseded by 2.24 (attempt 1 = 1ef339a on wt/patch-steward-m2-2.6, unmerged: enqueued with the job GITHUB_TOKEN, whose events start no merge_group run; revision 2026-09-25) | probes/pa06-merge-queue-relay/README.md, probes/pa06-merge-queue-relay/workflows/probe-pa06-relay.yml, probes/pa06-merge-queue-relay/workflows/probe-pa06-steward.yml, probes/pa06-merge-queue-relay/workflows/probe-pa06-control.yml, probes/pa06-merge-queue-relay/fixtures/ruleset-queue.json, probes/pa06-merge-queue-relay/fixtures/entry.txt, probes/pa06-merge-queue-relay/fixtures/base.txt, probes/pa06-merge-queue-relay/results/org-public.md, development-artifacts/patch-steward-m2-2.6-report.md |  |
| 2.7  | 2     | superseded by 2.25 (attempt 1 = 50e9dbc on wt/patch-steward-m2-2.7, unmerged: local permission denial + App-token mint without contents write; revision 2026-09-25) | probes/pa07-app-token-writes/README.md, probes/pa07-app-token-writes/workflows/probe-pa07-listen.yml, probes/pa07-app-token-writes/workflows/probe-pa07-write.yml, probes/pa07-app-token-writes/fixtures/marker.txt, probes/pa07-app-token-writes/results/org-public.md, development-artifacts/patch-steward-m2-2.7-report.md |  |
| 2.8  | 2     | done (completed by 2.26 at 97b50c9733ca9538a3a5ae3c41a3e9c43804837a; its SDK-derived rows rewritten there; 2.8's own merge is the commit) | probes/pa08-copilot-inference/README.md, probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml, probes/pa08-copilot-inference/results/personal.md, development-artifacts/patch-steward-m2-2.8-report.md | e2ccf32240ede6253cad6e006a55930ad7c6f7be |
| 2.9  | 2     | done | probes/pa09-run-list-caps/README.md, probes/pa09-run-list-caps/workflows/probe-pa09-listen.yml, probes/pa09-run-list-caps/workflows/probe-pa09-follow.yml, probes/pa09-run-list-caps/workflows/probe-pa09-act.yml, probes/pa09-run-list-caps/workflows/probe-pa09-count.yml, probes/pa09-run-list-caps/fixtures/marker.txt, probes/pa09-run-list-caps/results/org-public.md, development-artifacts/patch-steward-m2-2.9-report.md | c5f96e3ac4e2c861c8a6206537a4f8e431eb1eea |
| 2.10 | 2     | done | probes/pa01-required-checks/results/org-private.md, probes/pa06-merge-queue-relay/results/org-private.md, development-artifacts/patch-steward-m2-2.10-report.md | bb78ac30831a41ae6b7d79f02d96af24c0729de9 |
| 2.11 | 2     | done | probes/pa01-required-checks/results/personal.md, development-artifacts/patch-steward-m2-2.11-report.md | 6ed82156356ab77c19940cf38e9ecb4ede602568 |
| 2.12 | 2     | done | probes/pa02-ownership-artifacts/results/org-private.md, development-artifacts/patch-steward-m2-2.12-report.md | 6db83fbb9211a57f2e60c20707968e84d9721ebe |
| 2.13 | 2     | done | probes/pa03-trusted-triggers/results/org-private.md, development-artifacts/patch-steward-m2-2.13-report.md | 2be30c9b4cbfff9763a4964099cfb728daba4316 |
| 2.14 | 2     | done | probes/pa03-trusted-triggers/results/personal.md, development-artifacts/patch-steward-m2-2.14-report.md | 1c7e3198017240fad7c723890e2fcb21e6a40beb |
| 2.15 | 2     | done | probes/pa04-privilege-separation/results/org-private.md, development-artifacts/patch-steward-m2-2.15-report.md | 83749428c2610d097c4c9bf617571613126b1c6b |
| 2.16 | 2     | done | probes/pa04-privilege-separation/results/personal.md, development-artifacts/patch-steward-m2-2.16-report.md | 9fa31d669e32843eebe6ffa179dfbab815cf0f26 |
| 2.17 | 2     | done (PA07.1, PA07.2 confirmed on org-private; app pass run 36097211695, 13 listener runs; github pass run 36097398127, none) | probes/pa07-app-token-writes/results/org-private.md, development-artifacts/patch-steward-m2-2.17-report.md | eed926f5668a0fb401c4f3dd195dbf00bf7d1b1a |
| 2.18 | 2     | done (PA07.1, PA07.2 confirmed on personal; app pass run 36097230397, 13 listener runs; github pass run 36097417893, none) | probes/pa07-app-token-writes/results/personal.md, development-artifacts/patch-steward-m2-2.18-report.md | a2d41255552dc9de3812c9691f0ab3c8b2b50426 |
| 2.19 | 2     | done | probes/pa08-copilot-inference/results/org-public.md, development-artifacts/patch-steward-m2-2.19-report.md | ff4f7cee377baf75580600612296ea66239be6a6 |
| 2.20 | 2     | done | probes/pa08-copilot-inference/results/org-private.md, development-artifacts/patch-steward-m2-2.20-report.md | 09ce72e0d241c37b9eefe7ee26a0650030604221 |
| 2.21 | 2     | done (CAP-STATE sessions=5 sends=200 terminal=none next_prompt_kchars=320 resizes=1; 60-s gap breached twice, see Revisions) | probes/pa08-copilot-inference/workflows/probe-pa08-cap.yml, probes/pa08-copilot-inference/README.md, probes/pa08-copilot-inference/results/personal.md, development-artifacts/patch-steward-m2-2.21-report.md | 805c56ec2015ecf9c11877150c848a59dd798a84 |
| 2.22 | 2     | done (cap stop reason allowance-exhausted in cap-06; chain 6 cap sessions, 220 cap sends, 180.982 AI credits reported; jambolo Copilot exhausted until 2026-10-01T00:00:00Z) | probes/pa08-copilot-inference/README.md, probes/pa08-copilot-inference/results/personal.md, development-artifacts/patch-steward-m2-2.22-report.md | 2d5a2f750ad29ddc3f6d12004eb6db4200678989 |
| 2.23 | 2     | done (gate OVERALL: PASS, 13 of 13 checks; supervisor re-ran D1–D6e at ffa95e6/a2aa89e: all hold) | development-artifacts/patch-steward-m2-2.23-report.md | a2aa89e1b5aba5d1a5eef3636ec42b9a43796f5b (in-tree) |
| 2.24 | 2     | done (retry 2, model opus; attempt 1 and retry 1 declined before any live write) | probes/pa06-merge-queue-relay/README.md, probes/pa06-merge-queue-relay/workflows/probe-pa06-relay.yml, probes/pa06-merge-queue-relay/workflows/probe-pa06-steward.yml, probes/pa06-merge-queue-relay/workflows/probe-pa06-control.yml, probes/pa06-merge-queue-relay/fixtures/ruleset-queue.json, probes/pa06-merge-queue-relay/fixtures/entry.txt, probes/pa06-merge-queue-relay/fixtures/base.txt, probes/pa06-merge-queue-relay/results/org-public.md, development-artifacts/patch-steward-m2-2.24-report.md | d24fef3ce1037fad6124aa9c0289bc4be0bd1058 |
| 2.25 | 2     | done (PA07.1–PA07.3 confirmed on org-public; no write-refused with contents write; attempt-1 residue #2, #3, #4, #20, #21 closed; Samples corrected 12 → 13 by the supervisor, see Revisions) | probes/pa07-app-token-writes/README.md, probes/pa07-app-token-writes/workflows/probe-pa07-listen.yml, probes/pa07-app-token-writes/workflows/probe-pa07-write.yml, probes/pa07-app-token-writes/fixtures/marker.txt, probes/pa07-app-token-writes/results/org-public.md, development-artifacts/patch-steward-m2-2.25-report.md | e401949ad92fd237453c2795af5c6fa6ae49b720 (in-tree) |
| 2.26 | 2     | done | probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml, probes/pa08-copilot-inference/README.md, probes/pa08-copilot-inference/results/personal.md, development-artifacts/patch-steward-m2-2.26-report.md | 97b50c9733ca9538a3a5ae3c41a3e9c43804837a |
| 3.1  | 3     | done | probes/findings.md, probes/pa04-privilege-separation/results/personal.md, development-artifacts/patch-steward-m2-3.1-report.md | e1341da8ef1edb78ee828ac94d5507a113ddc2a3 |
| 3.2  | 3     | done | probes/smoke/tools/steady-state.sh, probes/README.md, probes/smoke/README.md, development-artifacts/patch-steward-m2-3.2-report.md | 30103275e0a36091fdc9b8330a1004e8de023a85 |
| 3.3  | 3     | done (in-tree; all three applies ran with no permission refusal; supervisor live re-read: probe workflows active 0 of 29/16/16, head branches 0; fork keeps 3 head branches) | probes/testbeds.md, development-artifacts/patch-steward-m2-3.3-report.md | 50068daeaf7cd32f32b55b6181417ccc658fbf30 (in-tree) |
| 3.4  | 3     | done (route judgment, executed by the supervisor in-tree; Q1–Q7 cover the 24 cells, Q8/Q9 confirmed-cell leads, C1; 35 design quotes verified exact) | development-artifacts/patch-steward-m2-decision-packet.md, development-artifacts/patch-steward-m2-3.4-report.md | 5f32ca7a9391fb037ccf6fdcfb93ba7fed3ae22f (in-tree) |
| 3.5  | 3     | done (gate OVERALL: PASS, 14 of 14 checks; supervisor re-ran G1a–G5e at 6c4e975: all hold) | development-artifacts/patch-steward-m2-3.5-report.md | 6c4e9756eb9d626a97fd894d0cd64b2bd2eaf670 (in-tree) |
| 4.1  | 4     | done (W1 run 36112857842, W2 run 36112899071, both success; W1 callee_with_env=org-public, W2 empty; siblings empty) | probes/pa04-privilege-separation/README.md, probes/pa04-privilege-separation/workflows/probe-pa04-callee-secrets.yml, probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-org-public.yml, probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-org-public.yml, probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-personal.yml, probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-personal.yml, probes/pa04-privilege-separation/results/org-public.md, development-artifacts/patch-steward-m2-4.1-report.md | 91741546af41dad29174a7b750eababa2e024657 |
| 4.2  | 4     | done (E=2026-09-25T08:24:55Z; window A no scheduled run; both files active at window A end) | development-artifacts/patch-steward-m2-4.2-report.md | de7c8406cb247a9450f0ed774a8ec01a9cecf7d9 |
| 4.3  | 4     | done (4 runs success: W1/W2 × host org-public/personal; callee_with_env org-private except W2 host personal empty; siblings empty) | probes/pa04-privilege-separation/results/org-private.md, development-artifacts/patch-steward-m2-4.3-report.md | 3b9cb52f55ed5d7ce55c01b1b37e39604bab0a6f |
| 4.4  | 4     | done (W1 run 36128934079 callee_with_env=personal, W2 run 36128974266 empty; siblings empty) | probes/pa04-privilege-separation/results/personal.md, development-artifacts/patch-steward-m2-4.4-report.md | e3d2bab88ce177127e2eb32a46f930b8fcb94fce |
| 4.5  | 4     | done (captured: -env run 36144833081 created 14:02:25Z, disabled 14:03:58Z; schedule run 36145289811 created 14:06:36Z, disabled 14:09:20Z; both disabled_manually inside E+6h) | development-artifacts/patch-steward-m2-4.5-report.md | 92f22a8eb6ab5d42111fa3f86bd6a6a492c5acbb |
| 4.6  | 4     | done (in-tree; PA03.4, PA03.5 org-private undetermined/blocked → confirmed/none; E11 run 36145289811, E12 run 36144833081) | probes/pa03-trusted-triggers/results/org-private.md, development-artifacts/patch-steward-m2-4.6-report.md | acc83bdf43c406e292466a96d599fa744b608870 (in-tree) |
| 4.7  | 4     | done (PA03.4/.5 org-private confirmed/none; PA03 roll-up confirmed/none; PA04.1 Evidence ×3 extended) | probes/findings.md, development-artifacts/patch-steward-m2-4.7-report.md | ef3278efcd45005d196aeb522ddd87f0e462dc6e |
| 4.8  | 4     | done (all three apply steady on first run; Fixtures refreshed; T30–T32; five PA04 drift rows) | probes/testbeds.md, probes/README.md, development-artifacts/patch-steward-m2-4.8-report.md | f1ce105df6dee1fbab42af045e35e77f3ec00e1a |
| 4.9  | 4     | done (route judgment, executed by the supervisor in-tree; F1 only, F2 not raised; recommendation B; CHECK-PACKET2 OK) | development-artifacts/patch-steward-m2-decision-packet-2.md, development-artifacts/patch-steward-m2-4.9-report.md | 353c2ad58cf69168a4e84b03b1448a26ec9e2d78 (in-tree) |
| 4.10 | 4     | done (gate OVERALL: PASS, 23 of 23 checks; supervisor re-ran G1a–G8e at 7fc5e9c: all hold) | development-artifacts/patch-steward-m2-4.10-report.md | 7fc5e9cc180c4424d3b7318c1776fedff53a8d4b (in-tree) |
| 5.1  | 5     | done (in-tree; apply 17/17, k-checks arch OK, supervisor re-ran all 7 acceptance lines) | docs/architecture.md, development-artifacts/patch-steward-m2-5.1-report.md | 7aacb6b0198ac054db9586062b4ff376fbf7ea21 (in-tree) |
| 5.2  | 5     | done (apply 12/12; k-checks proc+arch OK; supervisor re-ran all 8 acceptance lines in the worktree) | docs/processes.md, development-artifacts/patch-steward-m2-5.2-report.md | b67c7439783ab76da5e00135e2c1e9c614b57b54 |
| 5.3  | 5     | done (apply 1/3/5; k-checks manual OK; supervisor re-ran all 10 acceptance lines in the worktree) | docs/user-manual/installation.md, docs/user-manual/configuration.md, docs/user-manual/troubleshooting.md, development-artifacts/patch-steward-m2-5.3-report.md | 4c154fd28da088f65570b849992bdbf5d9851096 |
| 5.4  | 5     | done (apply 2/2/3; k-checks summaries OK; supervisor re-ran all 9 acceptance lines in the worktree) | docs/whitepaper.md, README.md, CLAUDE.md, development-artifacts/patch-steward-m2-5.4-report.md | 711e0b8e3c51918c9197d058028c1cff6dc289bc |
| 5.5  | 5     | done (set 25/25; k-checks findings OK; PENDING 4; supervisor re-ran all 8 acceptance lines in the worktree) | probes/findings.md, development-artifacts/patch-steward-m2-5.5-report.md | b641b590641f77005d72c573f4016eb7d92a6254 |
| 5.6  | 5     | done (in-tree; gate OVERALL: PASS, 15 of 15 checks D1–D6e, D7 NOT-RUN; supervisor re-ran D1–D6e at aa4adac: all hold; D7 judged PASS by the supervisor, see Phase 5 notes) | development-artifacts/patch-steward-m2-5.6-report.md | aa4adace0687702047e79b8dc73dcccba06d1b77 (in-tree) |
| 6.1  | 6     | done (in-tree; apply 9/9, re-apply already=9; k6 arch OK; supervisor re-ran all 7 acceptance lines at e4be1fc) | docs/architecture.md, development-artifacts/patch-steward-m2-6.1-report.md | e4be1fc558197c406e9772994203a23914e1e626 (in-tree) |
| 6.2  | 6     | done (apply 8/8; k6 proc+arch OK; supervisor re-ran all 8 acceptance lines in the worktree; merged 1st of wave 2) | docs/processes.md, development-artifacts/patch-steward-m2-6.2-report.md | cb8f61d96492c6f86be7804a11e4c07f5808503d |
| 6.3  | 6     | done (apply 1/1; k6 whitepaper OK; supervisor re-ran all 7 acceptance lines in the worktree; merged 2nd) | docs/whitepaper.md, development-artifacts/patch-steward-m2-6.3-report.md | e3d7bcd9a43efc9d534c24f4314ecfa57afa2f4e |
| 6.4  | 6     | done (apply 2/2; k6 manual OK; supervisor re-ran all 8 acceptance lines in the worktree; merged 3rd) | docs/user-manual/installation.md, docs/user-manual/configuration.md, development-artifacts/patch-steward-m2-6.4-report.md | 32f5948ebd84c257a0db8946674344e39d8ea71a |
| 6.5  | 6     | done (apply 4/4; k6 findings OK; CHECK-FINDINGS-FINAL OK; PENDING 0; supervisor re-ran all 9 acceptance lines in the worktree; merged 4th; post-merge k6 all OK) | probes/findings.md, development-artifacts/patch-steward-m2-6.5-report.md | 5ff145e558dcca05fc19d6f8ad2171e66becabd8 |
| 6.6  | 6     | done (in-tree; gate OVERALL: PASS, 12 of 12 run checks, G3/G6 NOT-RUN by design; supervisor re-ran G1, G2, G4 project-dod.sh LIVE GET reads → PROJECT-DOD OK, G5, G7a–G8e at 89a7317: all hold; G3/G6 judged PASS by the supervisor, see Phase 6 notes) | development-artifacts/patch-steward-m2-6.6-report.md | 89a73171fbbc03d20b6c63da5609ca47addc210d (in-tree) |
| 7.1  | 7     | done (worktree at 342fbd8, step commit 304a494; supervisor re-ran acceptance 1–8 in the worktree: k7 adr OK, k7 arch OK, k6 arch OK, MILESTONE-VERIFY OK, already=8, 34 no DIFF, format:check and lint exit 0; scope 36 paths ⊆ files_in_scope) | docs/adr/0001-browser-code-role.md, docs/adr/0002-browser-secrets.md, docs/adr/0003-submission-types.md, docs/adr/0004-security-reports.md, docs/adr/0005-deployment-and-triggers.md, docs/adr/0006-sandbox-model.md, docs/adr/0007-local-cli-scope.md, docs/adr/0008-llm-provider.md, docs/adr/0009-evidence-store.md, docs/adr/0010-automated-participation.md, docs/adr/0011-distribution.md, docs/adr/0012-repository-layout.md, docs/adr/0013-orchestration.md, docs/adr/0014-llm-authentication.md, docs/adr/0015-preflight-inference.md, docs/adr/0016-inference-admission.md, docs/adr/0017-first-ecosystems-for-result-parsing.md, docs/adr/0018-self-screening-of-this-repository.md, docs/adr/0019-lockstep-versioning-and-cd-manifest.md, docs/adr/0020-node-24-only.md, docs/adr/0021-test-tiers-and-ci-placement.md, docs/adr/0022-shared-fixture-corpus-home.md, docs/adr/0023-probe-suite-location.md, docs/adr/0024-platform-assumption-identifiers.md, docs/adr/0025-ruleset-dependent-controls-limitation.md, docs/adr/0026-ownership-artifact-ordering.md, docs/adr/0027-wrapper-permission-ceiling.md, docs/adr/0028-publish-after-cancellation.md, docs/adr/0029-copilot-organization-policy-limitation.md, docs/adr/0030-per-submission-concurrency-after-commitment.md, docs/adr/0031-merge-queue-relay-membership.md, docs/adr/0032-organization-billing-unverified-marker.md, docs/adr/0033-explicit-secrets-mapping.md, docs/adr/README.md, docs/architecture.md, development-artifacts/patch-steward-m2-7.1-report.md | 26a96000e8d945d9de74b48840c452dc3a63e034 |
| 7.2  | 7     | done (worktree at 342fbd8, step commit 054f76b; supervisor re-ran acceptance 1–7 in the worktree: k7 summaries OK, k6 proc OK, k6 whitepaper OK, k6 summaries only NOCITE FAIL CLAUDE.md new=1 old=0 then FAIL 1, already=5/2/1/7, format:check and lint exit 0; scope 5 paths = files_in_scope; post-merge k7 adr/arch/summaries OK) | docs/processes.md, docs/whitepaper.md, README.md, CLAUDE.md, development-artifacts/patch-steward-m2-7.2-report.md | 402488d6449f4165b00e28999df80d55bab79e42 |
| 7.3  | 7     | done (in-tree, lone step, base 96727db; supervisor re-ran acceptance 1–5: k7 rest OK, k6 findings only PROBES6, already=8/11/2/1/1/1/1/2, format:check and lint exit 0; scope 9 paths = files_in_scope) | docs/deferred.md, docs/project-development-plan.md, fixtures/README.md, probes/pa01-required-checks/README.md, probes/pa03-trusted-triggers/README.md, probes/pa04-privilege-separation/README.md, probes/pa05-rounds-concurrency/README.md, probes/pa08-copilot-inference/README.md, development-artifacts/patch-steward-m2-7.3-report.md | fc4bce73b05e2bae13352de12b3ad6f1fba615f5 (in-tree) |
| 7.4  | 7     | done (in-tree, base 78ec005; gate OVERALL: PASS, G1–G12 PASS, D6 NOT-RUN by design; supervisor re-ran acceptance 1–5 (18 × `<id> 1`, 1, 16, 1, scope = report only) and both gate7.sh modes in-tree after the commit: GATE7-LOCAL OK, GATE7-DOD OK (project-dod FAIL lines exactly P5, P10 ×2, P11; P9 PASS); D6 judged PASS by the supervisor, see Phase 7 notes) | development-artifacts/patch-steward-m2-7.4-report.md | c1c2da55f3477781d07e382bb38ba9458b654fec (in-tree) |
| 7.5  | 7     | done (in-tree, lone step, base f5ba028; supervisor re-ran acceptance 1–5 after the commit: K80 PASS (a)–(d), K7-CHECKS all OK; k6 summaries only NOCITE FAIL CLAUDE.md new=1 old=0 then FAIL 1; re-apply already 2/2/2/1/1; format:check and lint exit 0; scope 6 paths = files_in_scope; CLAUDE.md bullet byte-equal to brief `LF`) | CLAUDE.md, docs/adr/0002-browser-secrets.md, docs/adr/0004-security-reports.md, docs/adr/0025-ruleset-dependent-controls-limitation.md, docs/adr/README.md, development-artifacts/patch-steward-m2-7.5-report.md | 74b29af6da1e74094e0af37faf2939d2e6665f36 (in-tree) |
| 7.6  | 7     | done (in-tree, base c96b65c; gate OVERALL: PASS, G1–G12 PASS, D6 NOT-RUN by design; supervisor re-ran acceptance 1–5 (18 × `<id> 1`, 1, 16, 1, scope = report only) and both gate7.sh modes in-tree after the commit: GATE7-LOCAL OK (K80 PASS (a)–(d), COVERAGE-AUDIT 39/39, MILESTONE-VERIFY OK), GATE7-DOD OK (project-dod FAIL lines exactly P5, P10 ×2, P11; P9 PASS); D6 judged PASS by the supervisor, see Phase 7 notes) | development-artifacts/patch-steward-m2-7.6-report.md | 77fa769809e191c3e71d6ddd1ba12052c7377c1a (in-tree) |

### Phase 1 notes

- READ FIRST — foreground execution (lead, on the owner's instruction, 2026-09-24). Every `worker`, `decomposer`, and
  `planner` invocation runs in the FOREGROUND (`run_in_background: false`); a parallel wave is several foreground Agent calls
  in ONE message. A supervisor that launches background agents and then ends its turn is forced to hand back before they
  finish, and their results reach the lead instead of the supervisor (Revisions, phase-1 hand-back row). Scheduling after
  1.1 and 1.4 merge: 1.2 alone in the main working tree; then 1.5, 1.6, 1.7 one at a time in the main tree; then 1.8, 1.9,
  1.10. Workers run each tool as a standalone command `bash probes/smoke/tools/<tool>.sh <literal args>` from the main-tree
  root — no `cd`, no pipe (`tee`), no shell variables — so it matches the allow rule `Bash(bash probes/smoke/tools/*)`.
- READ FIRST — step 1.4 is VERIFY-ONLY (decomposer revision, 2026-09-24; Revisions row "1.4 — acceptance line 1"). Its
  worker already executed every action: commit `50fc4834f9c0817a4f2fdbca3280d63b7136610b` (report only) on branch
  `wt/patch-steward-m2-1.4`, worktree `C:/Users/John/Projects/steady-orchard/worktrees/patch-steward-m2-1.4`, base
  `bcc52ae`. The GitHub work is complete and cleaned up (fork kept; PR #1 closed; no `probe-canary-*` branch). Launch NO
  worker for 1.4 and re-execute none of its actions. Run the corrected acceptance block of `patch-steward-m2-1.4.md` from
  that worktree's root — it pins HEAD = `50fc483`, the scope against `bcc52ae` (the report alone), and exactly one canary PR
  — then on PASS merge `wt/patch-steward-m2-1.4` as usual and mark 1.4 `done` with the merge SHA. The merged report keeps
  `status: fail`: it is the worker's honest record of the run against the superseded acceptance line 1 and is never edited;
  the Revisions row records why the step is nevertheless done. On FAIL: remove the worktree and branch, re-execute
  nothing, escalate. 1.7's base assertion needs the merged 1.4 report (`test -f`) plus the FORK-OK line.
- READ FIRST — validation boundary. The brief lets the decomposer validate workflows and API shapes live with `probe-scratch-*`
  fixtures. The decomposer's first such action (an SSH push of a scratch workflow to `org-public` `master`) was DENIED by the
  local permission system ("Modify Shared Resources"). It was not retried by any other route (no raw `git push`, no API
  writes); `git ls-remote` afterwards confirmed `org-public` `master` is still `e787442…` with 0 workflows. Consequences:
  - NOTHING in the payloads has run on GitHub. Validated only: actionlint (brief's exact command) and Prettier on all four
    YAML files; `bash -n` on all five scripts; `deploy.sh`'s git logic OFFLINE against a local bare repository (first deploy,
    idempotent repeat, new branch with `src:dest` mapping, rejected push → fetch → real rebase → push, linear history);
    read-only `gh`/jq expressions against existing data. NOT validated: SSH push from a worker, the contents-API identity read,
    `dispatch.sh`/`wait-run.sh`/`environment.sh`/`capabilities.sh` end to end, the App-token/check-run/artifact steps, the
    Copilot CLI flags (`--no-custom-instructions`, `--disable-builtin-mcps`, `--no-ask-user`, `--no-color` are from GitHub's
    CLI reference fetched 2026-09-18, never executed), the ruleset/Environment request bodies.
  - Workers may hit the SAME denial on their first push (1.2, 1.4) — every live step tells the worker to STOP with
    `status: fail` and the denial verbatim, and to try no other route. That outcome is a HUMAN PERMISSION DECISION, not a
    decomposition defect: do not send it to the decomposer as a revision; return `needs-human` asking whether pipeline agents
    may push to / write on the three test-beds and the fork.
  - Because payloads are unproven, ownership follows first live use: the step that first runs a file owns it and may fix it
    (≤3 deploy–fix iterations, each fix recorded under `deviations`). Repeats (1.5, 1.6) own only their result file and fail
    rather than edit shared files → that IS a revision for the decomposer (fix the owner's file).
- Payload convention (new; not in the shared artifact table): verbatim files live in
  `development-artifacts/patch-steward-m2-<id>-payload/` (1.2, 1.7, 1.8) and workers `cp` them — no transcription. They match
  the constraint glob `development-artifacts/patch-steward-m2-*`, are Prettier-ignored there, and are never edited by workers.
  The canonical copies under `probes/` may legitimately DIFFER from the payload after a worker's fix: no acceptance pins a hash.
- 1.3 `removed`: enumerated as "author the PA03 scheduled-trigger workflows (static acceptance only)". Superfluous once
  ownership-by-first-live-use was adopted: a separate author step would own files that 1.8 — the first step to run them —
  could then not fix. 1.8 installs and owns them. No work was lost; the id stays registered.
- Dependency graph: wave 1 = 1.1, 1.2, 1.4 (independent; disjoint scopes). Wave 2 = 1.5, 1.6 (need 1.2) and 1.7 (needs 1.2
  for tools, 1.4 so the fork's `probe-canary-*` branches are gone before 1.7's active `refs/heads/probe-canary-*` rulesets
  exist). Wave 3 = 1.8 (needs 1.2 tools and 1.7's `environment.sh`). Wave 4 = 1.9 (needs 1.5–1.8; second writer of
  `probes/testbeds.md` after 1.7 — sequenced, never parallel). Wave 5 = 1.11 (revision 2026-09-24; needs 1.9; third writer of
  `probes/testbeds.md` — sequenced, alone). Wave 6 = 1.12 (revision 2026-09-24, owner decision on OA1; needs 1.11; fourth
  writer of `probes/testbeds.md` — sequenced, alone, in-tree; no GitHub interaction, runs in minutes). Wave 7 = 1.10 gate (all,
  1.11 and 1.12 included; report only; an honest FAIL report is a successful step — route the verdicts).
- 1.12 (revision 2026-09-24, supervisor's note relaying the owner's answer "A — record the `personal` `ruleset-merge-queue`
  cell as `unavailable` (the platform refused; the 422 is the evidence)"): matrix personal cell `owner-action-pending` →
  `unavailable`; the whole `### OA1 — …` block is replaced by ONE prose line under `## Owner actions` ("No owner action is
  open. OA1 (…) was closed on 2026-09-24 without an owner action, by owner decision: … The id OA1 is not reused."). Why not
  `- status: declined` (the supervisor's suggestion): the roadmap Phase 1 escalation point maps "a declined action becomes
  `owner-declined`", and `probes/README.md` / the brief ("If the owner declines one, the affected cells are `undetermined` /
  `blocked`") give `declined` a consequence — `declined` would record the option the owner did NOT choose. `done` needs the
  verifying command's output (the canary would still print `outcome=refused`). The brief's closed status set has no value for
  "no owner action exists"; the plan's own precedent — org-private rulesets, HTTP 403 → `unavailable` with no entry — shows a
  platform refusal needs no entry, so the entry is closed, not re-statused. No brief amendment needed (no gate, DoD, or closed
  set changes; the brief's `unavailable` definition "the platform refused; the refusal is the evidence" covers T6 because the
  byte-identical body was created on org-public, T3; PA06 has no `personal` cells, so no probe cell depends on this). 1.12
  pins its base: action 1 asserts blob `bee2655e18e2afa0736dbdb3652b7d6ee185ae25` of `probes/testbeds.md` (= 075868c/3105c07)
  and the acceptance diffs Inventory, matrix (modulo Prettier padding), and `## Fixtures`→EOF against 075868c. Run 1.12 BEFORE
  any DoD 7 follow-up capture step; such a step `depends_on` 1.12. If a capture step lands first, 1.12 reports `missing-base`
  → request a revision (re-pin), not a re-run. Dry-run: the edits applied in a scratch worktree at 075868c (LF and CRLF
  renderings, Prettier-formatted) → every acceptance line as expected, `pnpm format:check` and `pnpm lint` exit 0; the
  unmodified 1.11 file → matrix/OA diffs, `0`, and counts `1 1 1`.
- 1.11 (revision 2026-09-24, supervisor's coverage-gap note): 1.9 was the only scheduled-run capture point, but the PA03
  fixture fires after it, and DoD 7 is judged against GitHub state at gate time. 1.11 captures on org-public and personal only
  (org-private untouched: disabled, uncaptured, Phase 2 re-enables): per file, first completed scheduled run (earliest
  `createdAt`) → disable; bounded wait ≤60 min from its T0 for org-public files still uncaptured, then leave them enabled; then
  a SETTLE loop (≤3 calls) so runs created just before a disable are completed and recorded — the gate's `--limit 1` prints the
  LATEST id, so every completed scheduled id is recorded (evidence T25), not only the first. Wall time up to ~90 min: run the
  worker in the FOREGROUND and let it finish. Its report carries one `SCHEDULE-OUTCOME <key> <file> captured <id> <createdAt>
  | uncaptured after 60 min` line per public file. Supervisor routing after 1.11: (a) an org-public file left `enabled` can fire
  between 1.11 and gate 1.10 → DoD 7 FAIL on org-public (the run id is not in `probes/testbeds.md`); (b) org-public
  `probe-pa03-schedule.yml` captured but `-env` uncaptured → DoD 7 FAIL (its state check covers both files). Both are honest
  race outcomes, not decomposition defects of 1.11: request a follow-up capture revision (same pattern) rather than editing
  1.11's acceptance. 1.11's acceptance re-reads live GitHub state, so a supervisor re-run after a new scheduled run on an
  enabled org-public file prints `BAD` for that file — same routing.
- Batching of owner actions (roadmap escalation point): 1.7 deliberately does NOT depend on 1.5/1.6, so canary-derived owner
  actions surface even if a smoke repeat fails. A smoke run failing at "Mint an App installation token" on `personal` (1.6) or
  `org-private` (1.5) = owner action "install the test App on that repository": escalate once, after 1.7 and 1.8 finish; after
  the owner acts, re-run the failed step unchanged (1.6 action 5 guards against a second Copilot prompt on re-run).
- Judgment NOT delegated to workers (supervisor's): (a) 1.7 classifies a refusal as `unavailable` only for the one wording
  actually observed ("Upgrade to GitHub …"); every other genuine refusal becomes `owner-action-pending` + entry, per the
  brief's own default. A request defect (HTTP 400, or HTTP 422 "Validation Failed" faulting the request's own parameters —
  brief amendment 4, "Test-bed record format") is never a refusal: the 1.7 worker fixes its script within FIX BOUNDS or ends
  `status: fail`; 1.7's context classifies with rules R1 (defect) / R2 (refusal) and quotes the attempt-1 wildcard 422 as the
  R1 example. Possible for the exact-ref `ruleset-merge-queue` on `personal` (brief amendment 4: merge queue is expected not
  to be offered on user-owned repositories, and the canary records the actual answer; `created` → `available`): on a pending
  entry, decide with the owner whether it is `owner-declined` or the cell is `unavailable`, then request a revision step — no
  worker decides it (RESOLVED 2026-09-24: owner chose `unavailable`; revision step 1.12). Also for the supervisor: a 1.7 report that turned an R1-shaped response into a cell or entry is a
  worker misclassification — reject it. (b) 1.9 adds a Copilot owner-action entry for any Copilot
  failure that does not name allowance/quota/credits/plan limit (the brief's words); whether it is truly an account setting
  is for the supervisor and owner. Post-owner-action verification steps are NOT pre-planned: request them by revision with the
  owner's answers.
- Budgets: Phase 1 sends at most ONE Copilot prompt (1.6; the brief allows 2) → 23 of 24 standard prompts remain for Phase 2
  if it was spent; read `prompts spent` in `probes/smoke/results/personal.md`. `org-private` billed dispatches: ≤3 in 1.5, ≤2
  in 1.8, plus scheduled runs (1 job each, every 15 min) until 1.9, which ALWAYS disables both `probe-pa03-schedule*.yml`
  there (after a ≤20-minute bounded wait for a capture). Public test-beds keep an uncaptured fixture enabled for Phase 2.
- Bootstrap: run `pnpm install --frozen-lockfile` sequentially in each worktree before launching a wave (M01 pattern); every
  step also runs it (fast no-op). Tools must be run from the worktree root with relative paths; Bash tool timeout 600000 for
  `dispatch.sh`/`wait-run.sh` (they wait ≤540 s and exit 3 when the run is still going).
- Emergent contracts later phases must honor:
  - Tools: `probes/smoke/tools/deploy.sh <owner/repo> <branch> <message> <src>[:<dest>]…` (exit 0 = blob-identical; creates
    the branch from `master` if absent; never forces); `dispatch.sh <owner/repo> <workflow> <ref> [k=v…]` (exit 0 completed,
    1 failed, 3 still running); `wait-run.sh <owner/repo> <run-id>`; `environment.sh <owner/repo> <env> <secret> <dummy>`
    (exit 0 ready, 10 platform refusal); `capabilities.sh <owner/repo> <prefix>`. `PROBE_REMOTE_BASE` is an offline-test seam
    of `deploy.sh` only.
  - Every dispatchable probe workflow declares a string input `nonce` and a `run-name` containing `${{ inputs.nonce }}`
    (`dispatch.sh` finds its run that way). Workflow facts are log lines with a fixed prefix (`PROBE-SMOKE `, `PROBE-PA03 `;
    Phase 2: `PROBE-PA0N `), collected with `gh run view <id> --log | grep -a`.
  - Every Copilot request is logged as `copilot_request_utc=<YYYY-MM-DDTHH:MM:SSZ>` immediately BEFORE the request and copied
    verbatim into the result file: the cap step's ordering check and DoD 12 grep for exactly that token.
  - Fork identity check (revision 2026-09-24): `gh api repos/jambolo/patch-steward-testbed-public --jq
    '"\(.full_name) \(.fork) \(.parent.full_name)"'` → `jambolo/patch-steward-testbed-public true
    steady-orchard/patch-steward-testbed-public` (one line). Never `gh repo view … --json parent` with
    `.parent.nameWithOwner`: with the installed `gh` 2.93.0 that `parent` object holds only `id`, `name`, `owner`, so it
    prints `null`.
  - GitHub write forms (revision 2026-09-24; project `.claude/settings.json` allow list, default mode `auto`): only
    `bash probes/smoke/tools/<tool>.sh <literal args>`, `gh api repos/<test-bed or fork>/… [-X METHOD …]` (path directly
    after `gh api`), and `git push git@github.com:<test-bed or fork>.git …` are allow-listed — each ONE standalone command
    with literal values (no `cd`, `&&`, `;`, pipe, redirection, `$(...)`, variable, or loop; Bash-tool variables do not
    persist across calls anyway). No allow rule matches `gh workflow disable|enable`, `gh pr create|close`, `gh repo fork`,
    or `gh api -X METHOD repos/…` (flag before path); a write outside the list goes to the auto-mode classifier, which
    denied the decomposer's first test-bed push. Workflow disable/enable = `gh api
    repos/<owner>/<repo>/actions/workflows/<file>/disable -X PUT` (or `/enable`). Reads are unrestricted. Phase 1 steps
    1.2 and 1.4–1.9 follow this; Phase 2 step files must too.
  - Identity check form: a step that authors AND deploys in one commit uses `git hash-object <src>` (verified CRLF-safe under
    `core.autocrlf=true`: equals the committed blob id); steps whose base already contains the file use the brief's
    `git rev-parse HEAD:<path>` form.
  - App token mint uses `actions/create-github-app-token@v3` with `app-id: ${{ secrets.STEWARD_APP_ID }}`: v3.2.0 prefers
    `client-id`, but actionlint 1.7.12's bundled metadata rejects it and the brief fixes the actionlint command. `app-id` is
    deprecated-with-warning inside v3, not removed. Other pins: `actions/upload-artifact@v7`, `actions/setup-node@v7`.
  - Smoke result files use Kind `setup` and capability ids in the Sub-claim column (the brief defines no smoke rows); they
    never match the brief's Results-row pattern `^\| PA0[1-9]\.…`, so Phase 3 counts are unaffected.
  - `probes/testbeds.md`: the closed cell values may appear ONLY as real matrix cells and `- status:` lines (legend lives in
    `probes/README.md`); owner-action entries are `### OA<n> — …` blocks with `- status: pending|done|declined`. OA1 has no
    block after 1.12: closed without an owner action (owner decision 2026-09-24), kept as one prose line under
    `## Owner actions` ending "The id OA1 is not reused."; the next owner-action entry is `OA2`. A future entry the owner closes
    because no owner action exists follows the same pattern (prose line, id reserved); `declined` is only for an action the
    owner could take and chose not to (cell `owner-declined`).
  - Pending-cell consistency checks on `probes/testbeds.md` count OCCURRENCES — `grep -o 'owner-action-pending' F | wc -l |
    tr -d ' '` — never lines (`grep -c`): one matrix row holds every test-bed's cell, so two pending cells share a line (1.7
    attempt 1 failed on exactly this). Zero checks (`grep -c … → 0`, 1.10 DoD 5) are unaffected. One entry per pending cell.
  - `capabilities.sh` merge-queue canary: ruleset `<prefix>-merge-queue` on exactly `refs/heads/<prefix>-merge-queue`; the
    required-check canary stays on `refs/heads/<prefix>-*` (accepted live in attempt 1). Phase 2 steps recording
    `plan-unavailable` or owner actions apply the brief's refusal definition (a 422 faulting the request is a request defect).
  - PA03 fixture (Phase 2's PA03 step collects, and owns the directory's README): workflows `probe-pa03-schedule.yml` (cron
    `7,22,37,52`) on all three test-beds and `probe-pa03-schedule-env.yml` (cron `12,27,42,57`) only where Environment
    `probe-pa03-default-branch` could be created; Environment secret `PROBE_PA03_ENV_MARKER` = dummy `probe-pa03-env-marker-v1`;
    branch `probe-pa03-base` holds a variant differing only in `PROBE_DEFINITION`, sourced from
    `probes/pa03-trusted-triggers/fixtures/probe-pa03-base/` — under `fixtures/`, NOT `workflows/`, so project DoD 6's
    default-branch blob check never sees it. Both workflows skip the fork by an explicit `github.repository` guard.
    Capture record (1.9, 1.11): `probes/testbeds.md` `## Fixtures` has per public test-bed one row per file,
    `scheduled-trigger fixture (<file>)`, Details `captured run <first id>; disabled` or `no scheduled run within 60 min;
    enabled`; org-private keeps one row `scheduled-trigger fixture` (`no scheduled run within the bounded wait; disabled for
    the minutes budget`). All completed scheduled run ids per public file are in evidence T25; T22–T24 hold the capture pass.
    Known before 1.11 ran: personal `probe-pa03-schedule.yml` first = 36062978420 (2026-09-24T21:40:39Z, success), second
    = 36064228359 (21:53:07Z); `probe-pa03-schedule-env.yml` first = 36063493816 (21:45:45Z, success); org-public none as of
    21:57:31Z (live since 21:32:25Z). Phase 2's PA03 step reads the captured ids from the file (never re-captures a
    disabled public file) and enables only what it still has to capture (org-private; an uncaptured public file is already
    enabled).
- Supervisor record, 1.7 attempt 2 (126f250, 2026-09-24): matrix environment available/available/available; ruleset-required-check
  available/unavailable/available; ruleset-merge-queue available/unavailable/owner-action-pending (org-public/org-private/
  personal); fork-pr available on org-public. `personal` merge-queue refusal (T6) verbatim: HTTP 422 `{"message":"Validation
  Failed","errors":["Invalid rule 'merge_queue': "],...}`. Supervisor judgment: R2 refusal, not an R1 request defect — the
  byte-identical request body was CREATED on org-public (ruleset 23963955, T3), so the 422 faults the repository (user-owned),
  not the request. OA1 (personal, ruleset-merge-queue) is pending: the owner decides `owner-declined` vs cell `unavailable`
  (judgment (a)); escalate in the single batched owner-action `needs-human` after 1.8 finishes, then request a revision step.
- Supervisor record, 1.9 (031d29a, 2026-09-24): machinery rows available on all three; installation ids org-public and
  org-private 162868612, personal 162875728; Copilot smoke confirmed (no Copilot owner action); 1 Copilot prompt spent (23 of 24
  standard prompts remain for Phase 2). Scheduled fixture at the worker's query time: no scheduled run anywhere; org-private
  polled only ~3 min (within, not using, the 20-min bound) and BOTH `probe-pa03-schedule*.yml` disabled there uncaptured;
  org-public and personal left enabled. Supervisor read at 2026-09-24T21:47:19Z (AFTER 1.9's record, not in `probes/testbeds.md`):
  personal already ran `probe-pa03-schedule` run 36062978420 (schedule, master, 21:40:39Z, success) and
  `probe-pa03-schedule-env` run 36063493816 (schedule, master, 21:45:45Z, success); org-public none yet. Leads for Phase 2's PA03
  collection step, which captures and disables per the schedule rules; org-private must be re-enabled there to capture.
- Supervisor record, 1.11 (3105c07, 2026-09-24): personal captured (36062978420 schedule, 36063493816 schedule-env) and both
  disabled; org-public NO scheduled run of either file from deployment (~21:30Z) through 23:05:17Z (T0 22:01:18Z + 60 min) — both
  stay `active`, recorded `no scheduled run within 60 min; enabled` (a PA03 lead for Phase 2: personal fired within ~10 min,
  org-public never). org-private disabled, uncaptured. DoD 7 race stays open for org-public until the gate: if it fires first,
  route a follow-up capture revision. Gate 1.10 held until the owner decides OA1 (judgment (a)); after the answer: revision step
  for the OA1 cell/entry, then 1.10.
- Supervisor record, 1.12 + gate 1.10 (2026-09-24): owner answer A relayed by the lead — personal `ruleset-merge-queue` cell
  `unavailable` (T6 is the evidence); OA1 closed without an owner action as one prose line (decomposer revision 13ad59c; step
  1.12 e339d1d; next owner-action id OA2). Gate 1.10 (1e66164) OVERALL: PASS, pending owner actions none. Supervisor re-ran all
  eight phase DoD checks at 23:55:29Z: all hold. DoD 7 at gate time: org-public still NO scheduled run of either
  `probe-pa03-schedule*.yml` (both `active`, ~2 h 25 min after deployment; recorded `no scheduled run within 60 min; enabled`),
  so the capture clause does not apply there; org-private both `disabled_manually`, no run; personal both `disabled_manually`,
  all four completed scheduled ids (36062978420, 36063493816, 36064228359, 36064938300) in `probes/testbeds.md`. Phase 2 lead:
  org-public may fire any time; its PA03 step captures from live state (the enabled org-public files are its to capture).

### Phase 2 notes

- READ FIRST — revision 2026-09-25 (decomposer revise operation; supervisor's revision notes 1–3 after wave 1). New
  steps 2.24 (supersedes 2.6), 2.25 (supersedes 2.7), 2.26 (completes 2.8); revised in place, never run: 2.17, 2.18,
  2.19, 2.20, 2.21 (+ its payload), 2.22, 2.23. Graph now: 2.24 and 2.26 have no pending dependency (2.26 needs 2.8,
  merged) and may start at once — scopes disjoint from each other and from the running 2.11–2.16. 2.25 is ready too
  but LAUNCH IT ONLY AFTER THE OWNER ANSWERS the 2.7 local-permission-denial question (the classifier refused `gh api
  repos/steady-orchard/patch-steward-testbed-public/issues/21 -X PATCH -f state=closed --jq .state`); its action 4 runs
  exactly those closes first and STOPs on a repeat denial. 2.17, 2.18 ← 2.25; 2.19, 2.20 ← 2.8 + 2.26; 2.21 ← 2.8,
  2.19, 2.20, 2.26; 2.22 ← 2.21; gate 2.23 ← all non-superseded steps (2.24–2.26 instead of 2.6, 2.7).
  - 2.26 (PA08 SDK follow-up, personal, mechanical, <=5 prompts, plan 3). Root cause verified three ways: SDK 1.0.14
    source (`useLoggedInUser: false` → `--no-auto-login`; `gitHubToken` → `--auth-token-env COPILOT_SDK_AUTH_TOKEN`);
    GitHub's server-to-server article ("Do not pass an installation token through the SDK's `gitHubToken` ... That
    option is for user tokens"; troubleshooting: an installation token in the explicit option yields 403 "Resource not
    accessible by integration"); and an OFFLINE decomposer run of SDK 1.0.14 with dummy tokens (no session, no send):
    `useLoggedInUser: false` + COPILOT_GITHUB_TOKEN=`ghs_…` → `{"isAuthenticated":false,"statusMessage":"Not
    authenticated"}` (reproduces 2.8); default options + the same env → `{"isAuthenticated":true,"authType":"env",
    ...,"statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}`; `gitHubToken` →
    `authType":"token"` (the user-token path). So the fix is NOT the revision note's `gitHubToken: token` (it
    contradicts the docs and the brief's "Documented Copilot behavior" inference "never through the `gitHubToken`
    option"; no amendment needed) but dropping `useLoggedInUser: false` and keeping the env token — the docs' GitHub
    Actions / "Environment variables" path, the same one the working CLI legs use. Payload
    `patch-steward-m2-2.26-payload/workflows/probe-pa08-infer.yml` = merged blob b22271c + that change in all four SDK
    jobs + `auth_status=` log (client.getAuthStatus, no inference) + SDK pinned to 1.0.14; the 2.21 cap payload carries
    the identical sdk-setup block (blob f2c4d4bc…; infer payload 10a2c988…), pin, and auth_status log. 2.26's GATE:
    after detect, the `detect` job's auth_status must show isAuthenticated true / authType env, else STOP before any
    send (status fail, 0 prompts) — route that as a new revision, never retry blindly. Also: 2.8 left a copy of each of
    3 request lines inside its R4/R5/R6 blocks (its acceptance compared unique vs total lines, and the copies differ by
    prefix), so gate D5a would count 7 standard prompts for 2.8 instead of 4; 2.26 deletes the copies and its acceptance
    requires every request line to sit in E1/E2 (2.19/2.20 acceptances tightened the same way). 2.26 also converts the
    Measurements table to the brief's 6 columns (2.8 used 3) and fixes the README's PA08.5 kind (`assumption`).
    Supervisor judgment before the cap launch now covers 2.26's cells too.
  - LEAD (not evidence; for the supervisor / owner / Phase 3 PA08.6): the first offline test variant used a non-`ghs_`
    dummy token, which the runtime rejected and then fell back to the local gh CLI login (jambolo) and answered ONE
    account.getQuota read (no inference, no credits): `chat` entitlementRequests 200, usedRequests 10,
    remainingPercentage 95, tokenBasedBilling true; `completions` 2000 / 26; resetDate 2026-09-25T02:26:29.665Z. The
    brief states the pipeline cannot read how much of jambolo's allowance is used; the local user credentials apparently
    can read a quota snapshot through the SDK. Whether it measures the AI-credit allowance is unknown; no step reads it.
  - 2.24 (PA06 attempt 2, org-public). Enqueue/dequeue with token=app ONLY (attempt 1's GITHUB_TOKEN enqueues formed
    groups but started no merge_group run: re-read `actions/runs?event=merge_group&created=2026-09-25T01:00:00Z..
    2026-09-25T02:00:00Z` → 0; timeline actor github-actions[bot]; every removal reason `checks_timed_out`, except PR 15
    `invalid_merge_commit` 15 s after enqueue). Heads now branch from probe-pa06-base (REST ref at the base SHA, then
    deploy.sh adds the entry file) so each PR diff is one file; attempt-1 heads came from master and carried master's
    newer workflow files (a plausible cause of `invalid_merge_commit`: the queue's enqueuer lacks workflow-write
    rights — unverified). New steward (payload `patch-steward-m2-2.24-payload/`): job `record` (any sender, no token)
    decides PA06.2; job `write` only for sender jambolo (allowlist + "no App write in response to an App-bot event");
    with an App enqueuer the sender is expected to be the App bot or a GitHub bot, so the worker's DRIVER RULE writes
    the same App check through probe-pa06-control.yml (a default-branch dispatch run) when `write` is skipped — PA06.3
    accepts either writer and records which. The old routing note (below) is superseded: GITHUB_TOKEN enqueue is
    evidence, not a fallback; if the App token cannot enqueue (response verbatim, status fail) → owner decision
    (`needs-human`: e.g. grant the test App a merge-queue permission, or allow-list a local GraphQL mutation).
    Residue outside any step: org-public `allow_auto_merge` = true (attempt 1 flipped it; read 2026-09-25). No
    allow-listed form reaches `PATCH repos/<repo>` (`gh api repos/<repo>/` with a trailing slash → HTTP 404), so no
    step reverts it: an owner decision (revert by hand, or approve a one-off command) — Phase 3 steady state must list it.
  - 2.25 (PA07 attempt 2, org-public). Writer payload `patch-steward-m2-2.25-payload/`: job `contents: write` and mint
    `permission-contents: write` added (the GraphQL draft mutations need it — community reports, e.g. cli/cli#8910;
    attempt-1 run 36081670744 shows the refusal with issues + pull-requests only); a still-refused draft mutation is
    logged `write-refused=<kind> ... response=` and the sequence continues; PA07.1 then becomes `undetermined` /
    `blocked` unless something refutes (same rule in 2.17/2.18). Fresh fixtures k=2; attempt-1 residue #2, #3, #4,
    #20, #21 closed first.
- READ FIRST — execution. Foreground agents only (Phase 1 rule stands). Phase 2 steps MAY run in their own worktrees:
  every worker runs tools as `bash probes/smoke/tools/<tool>.sh <literal args>` with the Bash cwd = the MAIN tree root
  (it resets there every call; the allow rule matches only that form), and passes its own sources as ABSOLUTE Git-Bash
  paths into its worktree (`<W>` = worktree path with `C:/` → `/c/`; never `C:`, because deploy.sh splits `<src>:<dest>`
  at the first colon). Verified offline: `git hash-object -- /c/...` on an out-of-tree CRLF file equals the LF blob id.
  Consequences: (a) the tools under probes/smoke/tools/ must not change during Phase 2 — no Phase 2 step edits them;
  (b) the main tree must keep the Phase 1 tools checked out while waves run (merging step commits into it is fine);
  (c) run `pnpm install --frozen-lockfile` sequentially in each worktree before launching a wave (M01 pattern). Running a
  step in the main tree instead also works (`<W>` = /c/Users/John/Projects/steady-orchard/patch-steward).
- READ FIRST — validation boundary. NOTHING in the Phase 2 payloads ran live. Validated offline only: all 27 payload
  workflows pass actionlint TOGETHER in a scratch repo mirroring `.github/workflows/` (so reusable-call inputs and
  wiring are checked; a lone-file actionlint of a caller reports the false positive "could not read reusable workflow
  file", which the PA04/PA05 steps suppress with a second `-ignore`); all 84 `run:` blocks pass `bash -n`; the embedded
  SDK scripts pass `node --check` after YAML dedent; the `BEGIN sdk-setup` … `END sdk-setup` block is identical in
  probe-pa08-infer.yml and probe-pa08-cap.yml; payload YAML/JSON are Prettier-clean (checked with
  `pnpm exec prettier --ignore-path /dev/null --check`); the three checkers were dry-run on good, bad, and CRLF samples;
  the acceptance lines of 2.10 and 2.21 were dry-run on rendered sample files. No scratch deployment was made and no
  Copilot request was spent (every request must be recorded in a worker's result file). SDK API facts come from
  github/copilot-sdk nodejs/README.md, docs/features/session-limits.md, and docs/features/usage-and-billing.md
  (fetched 2026-09-25; SDK 1.0.14 on npm, CLI 1.0.88).
- Ownership follows first live use (Phase 1 rule): each primary (2.1–2.9) installs its payload
  (`development-artifacts/patch-steward-m2-<id>-payload/`, mirroring the probe directory) and may fix the copies under
  probes/ (<=3 deploy-fix iterations); 2.21 owns probe-pa08-cap.yml. Repeats (2.11–2.20) and 2.22 own only their result
  file (2.22 also the PA08 README/result) and FAIL rather than edit a shared file → that is a revision: fix the primary's
  file in a new step that then owns it.
- Shared checkers (decomposer artifacts, read-only for workers; Phase 3 may reuse them):
  `development-artifacts/patch-steward-m2-phase2-checks/` — check-result.sh `<file> <ID:kind>...` (title/bullets,
  section order, exact Results IDs and kinds, closed sets, cause rule, measurement never refuted, fixed = undetermined/pd03,
  evidence ids exist as `### <id> — ` headings here or in probes/testbeds.md, confirmed measurements have Measurements
  rows, fences open with ```text and hold <=60 lines; CRLF-safe); check-readme.sh `<probe dir>` (headings `## Sub-claims`,
  `## Fixtures`, `## Deployment list`, `## Procedure`; one `- <file>.yml: <keys>` line per workflows/ file); check-deploy.sh
  `<probe dir> [<key>...]` (blob identity per deployment line); coverage.txt (21 result files, 89 cells = the brief's
  coverage matrix; the gate and Phase 3 count against it).
- Dependency graph. Wave 1 = 2.1–2.10 (no dependencies; pairwise disjoint scopes; 2.10 is repository-only). The supervisor
  may narrow the wave (one `gh` token, 5000 req/h, shared by all). Long steps: 2.1 (~30–45 min sequencer run), 2.3 (event
  legs + up to 60 min scheduled-run wait), 2.6 (merge-queue transitions, 5-min check timeout, ~40–60 min). Wave 2 = repeats
  as their primary merges: 2.11←2.1; 2.12←2.2; 2.13, 2.14←2.3; 2.15, 2.16←2.4; 2.17, 2.18←2.25 (was 2.7); 2.19, 2.20←2.8
  and 2.26. Wave 3 = 2.21 (←2.8, 2.19, 2.20, 2.26). Wave 4 = 2.22 (←2.21). Wave 5 = gate 2.23 (←all non-superseded).
  Revision 2026-09-25 adds 2.24, 2.25, 2.26 (see the revision bullet at the top of these notes). Only the PA08 chain 2.8 → 2.26 → 2.21 → 2.22 shares
  files (probes/pa08-copilot-inference/README.md, results/personal.md) — strictly sequential by depends_on.
- CAP LAUNCH GATE (roadmap Phase 2 DoD 7; not delegated): launch 2.21 only after 2.8, 2.26, 2.19, 2.20 are verified and merged
  AND every refuted, blocked, or ambiguous PA08 cell they wrote has passed your evidence check (re-fetch at least one cited
  run or API path per refuted cell). After 2.21 starts, no Copilot reply is obtainable on jambolo until the monthly reset,
  so no PA08 revision can be redone. 2.21/2.22 are `mechanical` but irreversible and long (up to 11 session runs of <=45
  min): launching their workers with the Agent tool's `model: opus` override is recommended. A failed cap step is never
  re-run blindly: its RESUMPTION rule counts every cap run already on personal against the chain bounds (S = 10 cap
  sessions, 405 sends incl. the probe session). If 2.8 reports `EARLY-EXHAUSTION yes`, still run 2.21: it records
  `exhausted-before-start` or `allowance-exhausted` as the brief's stop reasons define.
- Copilot budget (brief: at most 24 standard prompts). Smoke spent 1 (Phase 1). Allocation: 2.8 <= 8 (plan 5), 2.19 <= 6
  (plan 3), 2.20 <= 6 (plan 3) → at most 21; 3 unallocated. REVISED 2026-09-25: 2.8 spent 4 (closed); 2.26 <= 5 (plan
  3); 2.19 <= 6; 2.20 <= 6 → at most 1 + 4 + 5 + 6 + 6 = 22; 2 unallocated. 2.26's requests sit in `### E2 — every
  Copilot request sent by step 2.26` of results/personal.md. Every request is logged `copilot_request_utc=<UTC>` BEFORE it
  is sent and copied into the sending step's result file exactly once (PA08 steps put the standard ones in `### E1 —
  every Copilot request sent by step <id>`); cap requests carry `cap_session=<label>` and sit in `### C<n> — cap session
  <label> (run <id>)` sections. Standard vs cap is told apart by `cap_session=` (gate D5a/D5c). The org steps order their
  legs omit-cli → cli → sdk so part (a) of PA08.3 survives a quota-shaped refusal.
- Routing notes for the supervisor.
  - A local permission denial of an allowed-form command → `needs-human` (owner decision), never a revision.
  - 2.6 (SUPERSEDED by 2.24 — see the revision bullet at the top of these notes): if the control workflow cannot
    enqueue with the App token (response verbatim in the report, status fail), that is an owner decision (grant the
    test App a merge-queue permission, or allow-list a local GraphQL mutation) → `needs-human`, not a revision. The
    job GITHUB_TOKEN is no fallback: its enqueues start no merge_group run (attempt 1). The expectation that
    merge_group runs are sent by the merge-queue bot rather than the enqueuer was unverified; 2.24 records the sender.
  - 2.3 PA03.1 "deletes" is exercised as a PR head whose tree LACKS the workflow file (same-repo head at the initial commit;
    fork head from the fork's master e787442): the permitted tooling can add and change files but not delete them. If you
    judge that insufficient, it is a scope question for the planner/owner, not a worker defect.
  - PA04.2 and PA04.4 decision rules deliberately refute on a run-level startup failure (the design presumes the rest of
    the run executes) and on publish completing after a cancellation (design: "A workflow cancellation can still prevent
    publication"); PA05.3 records the documented single-pending replacement as a platform fact whose design impact depends
    on ignored events never joining a submission's group. These are findings for the decision packet, not step failures.
  - No Phase 2 step writes probes/testbeds.md. Every step lists what it left on a test-bed under `## Residue`; Phase 3
    syncs `## Fixtures` from those sections plus live queries.
- Emergent contracts (Phase 3 and later).
  - Fixtures left on the test-beds: rulesets probe-pa01-required (org-public, personal; exactly refs/heads/probe-pa01-base)
    and probe-pa06-queue (org-public; exactly refs/heads/probe-pa06-base; merge_queue + required check probe-pa06/gate from
    4993303); Environments probe-pa04-env (org-public, org-private, personal; dummy markers probe-pa04-marker-<key>) besides
    Phase 1's probe-pa03-default-branch; branches probe-pa01-base, probe-pa01-head-1, probe-pa03-base-noguard,
    probe-pa03-head-{modify,absent,nd}, probe-pa06-base, probe-pa06-head-<k>-<n>, probe-pa07-base, probe-pa07-head-<k>-{app,github},
    probe-pa09-base, probe-pa09-head-<k> on the test-beds, and probe-pa03-head-fork-{modify,absent}, probe-pa09-head-fork-<k>
    on the fork; label probe-pa07:x; the PA04 callee also on personal master. All probe workflows stay ENABLED after Phase 2
    except both probe-pa03-schedule*.yml, which are disabled on every test-bed (2.3 org-public, 2.13 org-private, Phase 1
    personal); Phase 3 disables every probe-* workflow and deletes probe-pa0N-head-* branches on the three test-beds.
  - README `## Deployment list` lines `- <file>.yml: <key>[, <key>...]` are machine-read (check-readme/check-deploy);
    Phase 3's exact drift re-run can iterate them. The PA08 README has `## Cap procedure` with the phrase "owner approval
    required: consumes the repository owner's whole monthly Copilot allowance" and the line `Outcome (step 2.22): cap stop
    reason <value>`.
  - PA08 personal cap Measurements rows live under sub-claim PA08.3: `cap stop reason`, `cap sessions run`, `cap sends`,
    `cap AI credits reported`.
  - Known lead: org-public's two scheduled fixtures first fired at 2026-09-24T23:58Z (runs 36075348546 probe-pa03-schedule,
    36075339713 probe-pa03-schedule-env; decomposer read 2026-09-25T00:14Z); 2.3 captures and disables them.

- Supervisor record, 2026-09-25 (phase 2 run 1). Wave 1 (2.1–2.10) and wave 2 (2.11–2.16) verified and merged; DoD 7 re-fetches: PA02.3 (artifacts 10842251268 R2 01:17:26Z vs 10841479189 R1a2 01:17:56Z — id order disagrees with creation order), PA04.1 (runs 36081250289, 36085093481, 36085098011: every callee/with-env leg secret_origin=empty), PA04.2 (36081332331, 36085145726, 36085159972: startup_failure, 0 jobs), PA04.4 (36081813865: publish success after execute/assess cancelled), PA03.4/PA03.5 org-private blocked (both schedule files 0 scheduled runs, disabled_manually), PA08.2 org-public/org-private (36090488535 and 36090453864 cli "Access denied by policy settings"; 36090536212 and 36090494181 sdk session.error authorization 403 with auth_status isAuthenticated:true) — all supported. 2.6 failed (GITHUB_TOKEN enqueue, see Revisions) → 2.24; 2.7 failed (local permission denial + App mint without contents write) → 2.25, held for the owner; 2.8 SDK defect → 2.26 (GATE passed; 3 prompts). Standard Copilot prompts spent: smoke 1 + 2.8 4 + 2.26 3 + 2.19 3 + 2.20 3 = 14 of 24. CAP LAUNCH GATE passed at 09ce72e: 2.8, 2.26, 2.19, 2.20 verified and merged; every refuted PA08 cell re-fetched; no blocked/ambiguous PA08 cell; cap payload sdk-setup block identical to the merged infer block; probe-pa08-cap.yml never deployed (HTTP 404). 2.21 and 2.24 retry 2 launched with the Agent model override opus (ledger recommendation for 2.21/2.22; repeated worker refusal for 2.24).

- Supervisor record, 2026-09-25 (phase 2 run 1, hand-back). Done and merged: 2.1–2.5, 2.8 (+2.26), 2.9–2.16, 2.19–2.22, 2.24, 2.26. 2.22 re-fetch (run 36093046569): send=19 attempts 04:08:06Z and 04:13:07Z both `You have exceeded your monthly quota` (402 quota_exceeded) → `allowance-exhausted`; no Copilot reply is obtainable on jambolo until 2026-10-01T00:00:00Z, so no PA08 personal revision can be redone before then. Budgets: standard prompts 14 of 24 (smoke 1, 2.8 4, 2.26 3, 2.19 3, 2.20 3); cap sessions 6 of 10; cap sends 220 of 405. Remaining: 2.25 (held: the 2.7 local permission denial goes to the owner via needs-human), then 2.17, 2.18 (←2.25), then gate 2.23. Open probe items on org-public now: issues #4, #20, #21 and draft PRs #2, #3 (2.7 residue; 2.25 action 4 closes them), so phase DoD 4 cannot hold until 2.25 runs. Open owner decision also: org-public `allow_auto_merge` true since 2.6 (no allow-listed form reaches `PATCH repos/<repo>`). HEALTH at 2d5a2f7: format:check 0, lint 0, `.prettierignore` pin empty, frozen-path diff vs `<start>` empty.

- Owner answers (2026-09-24, relayed by the lead to the phase 2 resume run). (1) 2.7 permission denial (`gh api
  repos/steady-orchard/patch-steward-testbed-public/issues/21 -X PATCH -f state=closed --jq .state`, denied by the auto mode
  classifier as "External System Writes"): the owner took the session OUT of auto mode for the rest of phase 2, so the
  classifier no longer screens those writes. Launch 2.25 as written (action 4 closes issues #21, #20, #4 and PRs #2, #3 on
  org-public, one standalone command each), then 2.17, 2.18, gate 2.23. Every GitHub write stays in the step files'
  allow-listed standalone forms and on the four test-beds only. A permission prompt or denial that still blocks a worker →
  returned verbatim via `needs-human`; no other route. (2) org-public `allow_auto_merge`: set true by the 2.6 worker outside
  its instructions (2026-09-25 read); the owner reverted it to false; the lead verified `gh api
  repos/steady-orchard/patch-steward-testbed-public --jq .allow_auto_merge` → `false`; supervisor re-read at resume →
  `false`. Closed: no step touches it; Phase 3 steady state lists it as changed-then-reverted, not as residue. Rules restated:
  every spawned Agent in the FOREGROUND; tools as standalone `bash probes/smoke/tools/<tool>.sh <literal args>` from the
  main-tree root; further owner decisions via `needs-human`.

- Supervisor record, 2026-09-24 (phase 2 resume run, after the owner answers). 2.25 in-tree (e401949): PA07.1–PA07.3
  confirmed on org-public with contents write (no `write-refused=`); attempt-1 residue #2, #3, #4, #20, #21 closed by action 4
  with no permission denial; supervisor correction of the PA07.3 Samples count (12 → 13; Revisions). 2.17 (eed926f) and 2.18
  (a2d4125) in parallel worktrees: PA07.1, PA07.2 confirmed on org-private and personal; supervisor re-fetched each listener
  list (13 app-pass runs each, none for the github-pass numbers). Gate 2.23 (a2aa89e) OVERALL: PASS; supervisor re-ran D1–D6e:
  D1 21 OK / 21 files, D2 9 OK, D3 9 OK, D4 `issues=0 prs=0` ×3, D5a 14 (<= 24), D5b 4 rows (allowance-exhausted, 6, 220,
  180.982), D5c cap-after-standard (03:29:15Z < 03:39:44Z), D5d 6 × `disabled_manually`, D6a/b exit 0, D6c–e empty. DoD 7:
  refuted PA02.3, PA04.1, PA04.2 (×3), PA04.4, PA08.2 (org-public, org-private) and blocked PA03.4/PA03.5 org-private were
  re-fetched in run 1 (record above) and are unchanged; 2.22, 2.24, 2.25, 2.17, 2.18 added no refuted, blocked, or ambiguous
  cell. org-public `allow_auto_merge` re-read `false`. Phase 2 complete; current-phase 3.

### Phase 3 notes

- READ FIRST — execution (owner, 2026-09-24, relayed with the phase 3 decomposition request). Every spawned agent runs in
  the FOREGROUND. The session is in auto mode again: test-bed writes may be refused by the classifier even in the
  allow-listed standalone forms. Phase 3 has exactly THREE GitHub writes, all in step 3.3, all in the allow-listed tool
  form run from the MAIN tree root: `bash probes/smoke/tools/steady-state.sh <test-bed> apply` for org-public,
  org-private, personal. 3.1, 3.2, 3.4, 3.5 make no GitHub write (3.3's plan runs, the helper, and every checker are GET
  reads). A permission denial or prompt in 3.3 → the worker STOPs with `status: fail` and the refusal verbatim → the
  supervisor returns it via `RESULT: needs-human`; it is an owner decision, never a revision, and no other route is
  tried. No Phase 3 step sends a Copilot request (jambolo's allowance is exhausted until 2026-10-01T00:00:00Z).
- READ FIRST — validation boundary (decomposer, 2026-09-25, reads only on GitHub). Validated: `steady-state.sh plan` live
  on all three test-beds and the fork (org-public 27 workflows to disable + 19 head branches; org-private 14 + 5;
  personal 14 + 5; fork 0 + 3 — the fork is never passed to the tool); `apply` control flow (disable, delete, re-read,
  steady/not-steady exit) against a fake `gh` shim; `gen-findings.sh` + `check-findings.sh` on a scratch extract of
  b813eef with 3.1's personal.md fix applied → `CHECK-FINDINGS OK`, Prettier-clean (repo config), CRLF-safe, negative
  variants (changed value, dropped row, marker in prose, wrong roll-up, wrong key, missing Deviations cell) each FAIL;
  `check-probes-readme.sh` on a sample README drafted to 3.2's spec → OK, negatives (unmodified README, dropped table
  row, edited frozen section, missing Tools entry, altered cap phrase) FAIL, CRLF OK; `fixtures-section.sh` live (read
  only, 139 lines) and `check-fixtures.sh` against it with the offline seam → OK (without the seam it FAILs today: not
  steady yet — expected); `check-packet.sh` on a sample packet → OK, negatives (PA08.7 included, cell missing, one
  option, recommendation not an option, C2, misnumbered Q, extra cell) FAIL; every 3.1 and 3.3 acceptance line on
  rendered post-step files. NOT validated: `apply` against GitHub (a write), the README text 3.2's worker drafts, the
  packet 3.4 writes.
- Dependency graph. Wave 1 = 3.1, 3.2, 3.4 (no dependencies; pairwise disjoint scopes). Wave 2 = 3.3 (needs 3.2 MERGED
  INTO THE MAIN TREE: the tool must exist at the main-tree root, where the allow-listed command runs; 3.3's action 1
  asserts it by blob 3246395a42448eb8bd40ce243eac36b17f7ec698). Wave 3 = gate 3.5 (all). 3.3 may run in a worktree
  (edits in `<W>`, tool from MAIN) or in-tree; if in-tree, merge nothing into the main tree while it runs.
- 3.4 is route `judgment` (brief: the packet needs design judgment over architecture and processes): launch it with the
  Agent tool's `model: opus` override (or hand it to a human), foreground. Supervisor judgment on its output, not
  delegated: options are real alternatives naming exact sections, quotes are exact, the recommendation is reasoned and
  decides nothing for the owner; the PA08.2 question carries the plan's three risk options (enable organization Copilot
  and re-probe; `openai-compatible`; accept the limitation). The brief's two conditional mandatory options do not apply
  (no PA08 cell is undetermined/blocked; cap stop reason `allowance-exhausted`); `check-packet.sh` enforces them
  conditionally anyway. 24 cells: PA01.1–.7 and PA06.1–.5 org-private (plan-unavailable), PA03.4/.5 org-private
  (blocked), PA02.3 org-public, PA04.1 ×3, PA04.2 ×3, PA04.4 org-public, PA08.2 org-public/org-private (refuted).
- Decisions taken at decomposition (no brief amendment needed; none changes a gate, DoD, or closed set):
  - New tool `probes/smoke/tools/steady-state.sh` (payload `patch-steward-m2-3.2-payload/`, owned by 3.2, never edited
    by 3.3). Why: the steady state needs 55 workflow disables + 29 branch deletes = 84 standalone commands, above the
    worker's 80-turn cap; the tool makes it one allow-listed command per test-bed and gives the drift re-run (DoD 3) its
    exact disable step. Inside the brief's constraint (Phases 1–3 change only `probes/**` and
    `development-artifacts/patch-steward-m2-*`); the five Phase 1 tools are unchanged.
  - Fork head branches `probe-pa03-head-fork-absent`, `probe-pa03-head-fork-modify`, `probe-pa09-head-fork-1` are KEPT:
    the brief's steady state is "of the test-beds", DoD 2 queries only the three test-beds, "the fork stays", and the
    owner prefers fewer writes. They are listed as fork `branch` rows in `## Fixtures`; `check-fixtures.sh` compares them.
  - Result-file defect found: `probes/pa04-privilege-separation/results/personal.md` (step 2.16) records PA04.1/PA04.2
    `refuted` with "Deviations from the design" = "None."; its E1–E3 show the org-private outcome exactly. 3.1 copies
    org-private's two bullets verbatim and sets `- step: 2.16, 3.1`; Results rows and evidence untouched (no
    re-judgment). check-result.sh (phase 2) never inspected Deviations bodies; `check-findings.sh` now does.
  - `probes/findings.md` is generated (`gen-findings.sh`) and verified independently (`check-findings.sh`). Layout:
    `## Roll-up` `| Assumption | Title | Result | Test-beds | Result files | Disposition |`; `## Cells`
    `| Sub-claim | Test-bed | Kind | Result | Cause | Evidence | Result file | Disposition |` (Evidence and link columns
    serve project DoD 1 "every row cites evidence that exists"; the Test-bed column keeps Cells rows from matching the
    brief's Results-row pattern); `## Measured limits` one table per result file under `### PA0N — <key>`
    (`| Sub-claim | Test-bed | Quantity | Value | Unit | Method | Samples | Date | Feeds |`; per-file tables cut the
    padding from ~150 KB to ~94 KB), Date = date of the file's last `probed:` timestamp, Feeds fixed per sub-claim in
    the generator (§15 item and/or milestone); generated not-measured rows use Quantity `(all)` (PA01.7, PA06.5
    org-private) — PA06.5 org-public has a genuine Measurements row whose Value is `not measured`, copied as-is;
    `## Deviations` one `### PA0N — <key> — <ids>` sub-section per result file with refuted cells, body copied verbatim.
    PA08.7 disposition is bare `accepted-limitation` (Phase 4 adds the document §). PENDING appears exactly 30 times
    (24 cells + 6 assumptions) and nowhere else.
  - Retention canary expiry (optional PA02.6 observation): 25 h thresholds org-public 2026-09-25T21:57:38Z, org-private
    2026-09-25T22:01:52Z; before them the helper records "expiry not yet observable" — never a failure.
  - org-public `allow_auto_merge` appears in `## Fixtures` as kind `setting`, changed then reverted by the owner, with a
    live read (3.3 acceptance expects `false`; a different value is a finding for the owner, not a worker fix).
- Shared checkers (decomposer artifacts, read-only for workers): `development-artifacts/patch-steward-m2-phase3-checks/`
  — `gen-findings.sh` (stdout only), `check-findings.sh`, `check-probes-readme.sh` (base blobs 9943a0eb… README,
  45df45d0… smoke README), `fixtures-section.sh` (live GET reads → the `## Fixtures` table), `check-fixtures.sh` (live
  comparison + steady state; `CHECK_FIXTURES_SEAM=any-state` is an offline seam no step uses), `check-packet.sh`.
- Emergent contracts (Phase 4 and later):
  - Phase 4 fills Disposition cells of `## Roll-up` and `## Cells` in place (and PA08.7's `accepted-limitation: <§>`);
    it must NOT re-run `gen-findings.sh` (that resets every disposition). `check-findings.sh` asserts Phase 3
    dispositions and FAILs by design once they are filled — Phase 4 needs its own disposition check (brief: `grep -c
    "PENDING" probes/findings.md` → 0).
  - Decision packet ids `Q1`…`Qn` and `C1` are what the owner answers and the planner amendment cites.
  - `steady-state.sh` interface: `bash probes/smoke/tools/steady-state.sh <owner/repo> plan|apply`; `STEADY ...` lines;
    exits 0/1/2/3. The drift re-run in `probes/README.md` depends on it.
  - `probes/testbeds.md` `## Fixtures` row kinds: workflow, branch, environment, ruleset, label (live-compared by
    `check-fixtures.sh`), artifact, issues-prs, setting, fixture, fixture-set, fork; evidence ends at T29 — next id T30.
- Budgets: no Copilot request; GitHub API use ~300 GET/PUT/DELETE calls for 3.3 plus the checkers (5000/h shared).

- Supervisor record, 2026-09-24 (phase 3 run). Wave 1: 3.1 (merge e1341da) and 3.2 (merge 3010327) in parallel worktrees
  at 0cf800c; post-merge re-run CHECK-FINDINGS OK, CHECK-README OK. findings.md equals gen-findings.sh output modulo
  Prettier padding. 3.2 `## Running and budgets` compared by the supervisor with brief "Running, waiting, and budgets" and
  "Copilot cap step": agrees (R1–R13). 3.3 in-tree (50068da): all three `steady-state.sh ... apply` commands ran with no
  permission refusal; supervisor live re-read: probe workflows active 0 of 29 / 16 / 16, head branches 0, fork keeps
  probe-pa03-head-fork-absent, probe-pa03-head-fork-modify, probe-pa09-head-fork-1. 3.4 (route judgment) executed by the
  supervisor in-tree (5f32ca7), not by a worker: Q1–Q7 cover the 24 cells (Q1 org-private plan 12 cells; Q2 PA02.3; Q3
  PA03.4/.5 org-private; Q4 PA04.1 ×3; Q5 PA04.2 ×3; Q6 PA04.4; Q7 PA08.2 ×2 with the plan's three risk options), Q8 (PA05.3)
  and Q9 (PA06 org-public) are confirmed-cell leads with `- cells: none`; C1 three options; 35 design-text quotes verified
  exact against docs/ (whitespace-normalized). PA08.5/PA08.1 leads not raised (no design text at stake). Gate 3.5 in-tree
  (6c4e975) OVERALL: PASS; supervisor re-ran G1a–G5e: G1b 89 89, G2c include entries refs/heads/probe-pa01-base (org-public,
  personal) and refs/heads/probe-pa06-base (org-public), all others as expected. Phase 3 complete; current-phase 4. Phase 4
  stays blocked until the owner answers the packet and the planner amends "Post-probe owner decisions".

### Phase 4 notes

- Phase-4 base (roadmap `<phase-4 base>`): `0e49479649c624a161d76cec5c40f39634422d09` (working-branch HEAD at
  decomposition, the amendment-5 commit). Every phase-4 checker pins it. Base blobs: probes/findings.md 0865d699…,
  probes/testbeds.md f736f2d9…, PA03 org-private result 5645014f…, PA04 README f631ac21…, PA04 results org-public
  cde5ae21…, org-private 85d9b469…, personal afe339e7…. `grep -rF 'copilot_request_utc=' probes/ | wc -l` = 245.
  org-private Actions usage 2026-09 read at decomposition: 69.00 (brief: 69.000016819); 2026-10: none.
- READ FIRST — execution (owner, relayed with the phase 4 decomposition request). Every spawned agent runs in the
  FOREGROUND; a parallel wave is several foreground Agent calls in ONE message. Auto mode: test-bed writes only as
  standalone `git push git@github.com:<testbed>.git …`, `gh api repos/<testbed>/… [-X …]`, or
  `bash probes/smoke/tools/<tool>.sh <literal args>` from the MAIN-tree root; the classifier may still refuse them. A
  permission denial or prompt → the worker STOPs `status: fail` with the refusal verbatim → return it via
  `RESULT: needs-human` (owner decision; never a revision; no other route). No step sends a Copilot request (jambolo
  exhausted until 2026-10-01T00:00:00Z).
- READ FIRST — Q3 TIMING (hard; owner bound = each schedule file's enable time E + 6 h, no second enable window).
  Step 4.2 records E in its report (`Q3-ENABLE … enable_utc=<E>` and `Q3-TIMES enable_utc=<E> window_a_end=<E+2h50m>
  window_b_end=<E+5h45m> bound=<E+6h>`) and watches until E + 2 h 50 min; step 4.5 watches from the same E until
  E + 5 h 45 min and then disables what is still enabled. Scheduling: launch 4.1 and 4.2 TOGETHER (wave 1). When
  wave 1 returns, verify and merge 4.2 FIRST and launch 4.5 (with 4.3 and 4.4, wave 2) at once — 4.5 must start
  before window_b_end. Safety net (supervisor, not delegated): if 4.5 cannot start before window_b_end, or 4.5
  returns with a file not `disabled_manually`, run the standalone disable commands yourself
  (`gh api repos/steady-orchard/patch-steward-testbed-private/actions/workflows/<file>/disable -X PUT`) before the
  bound and record it under Revisions. Before ANY `needs-human` return while a schedule file is enabled, disable it
  (brief) — which ends the re-probe early — so hold other escalations until 4.5 has finished; independent steps
  finish first anyway. Never re-enable a file.
- READ FIRST — validation boundary (decomposer, 2026-09-25; reads only on GitHub, no write, no scratch fixture).
  Validated: payload `patch-steward-m2-4.1-payload/workflows/` (five files) — actionlint (brief's command, singly
  and together in a scratch `.github/workflows/`, placeholders and real-looking pins), Prettier (repo config, ignore
  path overridden), `bash -n` of every `run:` block, marker digests recomputed; `q3-watch.sh` state/runs/poll live
  against org-private and personal (reads) plus hit/continue/window-end/none-active paths against a fake `gh`;
  `check-watch.sh` A/B, `check-q3.sh`, `check-q4.sh`, `check-findings-scope.sh`, `check-packet2.sh` on rendered
  post-step samples in a scratch worktree at 0e49479 (good LF/CRLF → OK; negatives — unmodified base, >6 h interval,
  updated_at mismatch, Q3-ENABLE in the 4.5 report, captured without a run, row contradicting the decision rule,
  E10 line tampered, live ids differing, Deviations not updated, origin contradicting its PROBE line, PA04.1
  Evidence missing an id, E1 edited, wrong leg set, out-of-scope findings row, Deviations edited elsewhere, F2 absent
  when raised / present when not, extra option letter, missing "unsupported by the evidence" when nothing delivered →
  FAIL); phase-4 `fixtures-section.sh` live (differs from Phase 3's only in the two org-private scheduled-trigger
  rows), spliced and passed `check-fixtures.sh`; `check-probes-readme.sh` FAILs once the five PA04 deployment lines
  exist ("Drift re-run does not name probe-pa04-w…") and passes with 4.8's five rows (Prettier re-pads nothing);
  every 4.1/4.3/4.4/4.8 acceptance line that needs no live write; gate G6b live. NOT validated: any test-bed write,
  the payload on GitHub (W1/W2 behavior is exactly what the re-probe measures), startup-failure page text.
- Dependency graph. Wave 1 = 4.1 (PA04 primary, org-public; ~45 min) ∥ 4.2 (Q3 enable + window A, ≤ ~2 h 55 min;
  report only). Wave 2 = 4.3, 4.4 (Q4 repeats, ←4.1) ∥ 4.5 (Q3 window B, ←4.2; ends ≤ E + 5 h 47 min). Wave 3 = 4.6
  (Q3 record, ←4.2, 4.5; reads only). Wave 4 = 4.7 (findings) ∥ 4.8 (steady state, testbeds.md, probes/README.md drift
  rows) ∥ 4.9 (packet 2, route judgment: the supervisor executes it itself — or an Agent with `model: opus` — as for
  3.4). Wave 5 = gate 4.10 (all). Scopes pairwise disjoint within every wave. Worst-case wall time ≈ 6 h + ~1.5 h.
- Couplings. 4.3 and 4.4 read 4.1's workflow files (pins, legs) and write only their result files; a needed change to
  a shared workflow file → `status: fail` → revision (4.1 owns them; ownership by first live use). 4.8 must follow
  every test-bed write (4.1, 4.3, 4.4 deploy/dispatch; 4.2, 4.5 enable/disable): `steady-state.sh apply` disables
  every probe-* workflow, so running it earlier would end the Q3 watch prematurely. 4.7 copies values from the
  4.1/4.3/4.4/4.6 result files (check-findings.sh compares them). 4.9 reads the same result files.
- Decisions taken at decomposition (no brief amendment; none changes a gate, DoD, or closed set):
  - No repository-level dummy secret, no new tool: W1 maps `${{ secrets.PROBE_PA04_ENV_MARKER }}` in a `uses:` job,
    which cannot declare an Environment, so the mapping passes an empty value (no repository- or organization-level
    secret of that name exists on any test-bed — read 2026-09-25); that is the design-faithful wiring (the design
    keeps the App key only in an Environment). Whatever the called with-env job reads therefore comes from
    Environment resolution, and the digest names whose Environment. A same-name repository dummy would also change
    the Phase 2 envs probe's sibling results on a drift re-run.
  - Callee hosts = org-public and personal only (org-private's `actions/permissions/access` is `access_level: none`;
    opening it is a repository setting). Legs: org-public → host personal; org-private → hosts org-public (the only
    same-owner cross-repository leg) and personal; personal → host org-public. One caller file per wiring and host
    (probe-pa04-w1|w2-host-org-public|personal.yml): a refused `secrets: inherit` fails the WHOLE run at startup
    (PA04.2 precedent), so W1 and W2 never share a run. W2 puts the caller's repository secrets (STEWARD_APP_*) in the
    callee's secrets context; the callee references only PROBE_PA04_ENV_MARKER (4.1 acceptance asserts it).
  - Startup-failure detail: the API/CLI give only "This run likely failed because of a workflow file issue."; the
    public run page HTML carries the error ("… is not valid. … Error calling workflow …" — verified on run
    36081332331); org-private pages need a browser.
  - Q3 split into 4.2 (enable + window A), 4.5 (window B), 4.6 (record) for the 80-turn worker cap: each watch step
    is ≤ ~22 calls of the read-only helper `q3-watch.sh poll` (3 polls 150 s apart per call, ~8 min; never faster
    than 120 s, also across calls; rate-limit guard 500). Record lines `Q3-ENABLE/Q3-DISABLE/Q3-END` live in the
    two watch reports; check-watch.sh compares them with live state (disable ≤ 6 h after enable; live `updated_at`
    within 600 s before the recorded disable); 4.6 copies them into E10 and check-q3.sh requires equality.
  - probes/README.md `## Drift re-run` gains the five new PA04 rows in 4.8: not in the roadmap Phase 4 scope list,
    but inside the brief's constraint (Phases 1–4 change only probes/**); without them check-probes-readme.sh
    (Phase 3) FAILs and project DoD 6's drift procedure would omit the new probes. Precedent: Phase 3's
    decomposition-time tool.
  - check-findings.sh (Phase 3) stays valid through Phase 4 (Phase 4 writes only `none` for re-probed cells that
    become confirmed); from Phase 5 on, when decided dispositions are filled, it FAILs by design.
- Checkers (decomposer artifacts, read-only for workers): `development-artifacts/patch-steward-m2-phase4-checks/` —
  q3-watch.sh (helper: state | poll A|B <E> | runs <E>), check-watch.sh A|B, check-q3.sh, check-q4.sh <key>,
  check-findings-scope.sh, fixtures-section.sh (phase-4 variant), check-packet2.sh. Offline seams Q3_WATCH_REPO /
  Q3_WATCH_SLEEP exist for the decomposer's validation only; no step sets them.
- Routing notes for the supervisor. A W2 (or W1) startup failure while the other wiring to the same host ran is a
  finding, not a step failure; both wirings of one host failing at startup is a probe defect (4.1 fixes; 4.3/4.4
  fail → revision of 4.1's files). A Q3 file that never fires within the bound is a finding (F2 raised), not a
  failure. 4.6 FAILs (by design) if scheduled runs are still open after 3 settle reads: re-run 4.6 later, unchanged.
  DoD 9 (supervisor judgment): re-fetch at least one cited run per re-judged PA03 row and per test-bed's Q4 evidence;
  packet 2 decides nothing for the owner.
- Emergent contracts (Phases 5, 6).
  - `u` of brief K27 = the number of PA03.4/PA03.5 org-private rows not `confirmed` after 4.6; F2 is raised in packet
    2 exactly when u > 0.
  - PA04 result files: re-probe evidence ids org-public E8, E9; org-private E5–E8; personal E5, E6; each holds one
    `Q4-OUTCOME key=… wiring=… host=… run=… conclusion=… caller_with_env=… caller_sibling=… callee_with_env=…
    callee_without_env=…` line (F1's evidence). PA04.1 rows stay `refuted` / `none`; Deviations unchanged.
  - PA03 org-private: E10 (enable/disable record lines), E11 (probe-pa03-schedule.yml runs), E12
    (probe-pa03-schedule-env.yml runs); `- step: 2.13, 4.6`.
  - New workflows (PA04 README deployment list, 30 DEPLOYMENT pairs): probe-pa04-callee-secrets.yml (org-public,
    personal), probe-pa04-w1|w2-host-org-public.yml (org-private, personal), probe-pa04-w1|w2-host-personal.yml
    (org-public, org-private); all `disabled_manually` after 4.8; probes/README.md drift table lists them.
  - probes/testbeds.md evidence ends at T32 — next id T33; org-private has two scheduled-trigger rows now.
  - Packet 2: `development-artifacts/patch-steward-m2-decision-packet-2.md`, items F1 (+ F2), options B and C each;
    Phase 6 stays blocked until a planner amendment records the answers.

- Supervisor record, 2026-09-25 (phase 4 run). Wave 1 (worktrees at 1dc7cdf): 4.1 (merge 9174154) and 4.2 (merge de7c840),
  launched together. Q3: E = 2026-09-25T08:24:55Z (window_a_end 11:14:55Z, window_b_end 14:09:55Z, bound 14:24:55Z); window A
  saw no scheduled run. 4.2 verified and merged first; wave 2 (4.3, 4.4, 4.5 at ded6ca3) launched 11:19Z, before window B.
  4.5: probe-pa03-schedule-env.yml first scheduled run 36144833081 created 14:02:25Z (disabled 14:03:58Z), probe-pa03-
  schedule.yml first run 36145289811 created 14:06:36Z (disabled 14:09:20Z) — about 5 h 38–42 min after enable, inside
  window B; supervisor live read 14:11:19Z: both disabled_manually; no safety-net disable needed. 4.6 in-tree (acc83bd):
  PA03.4, PA03.5 org-private confirmed / none (supervisor re-fetched both runs: definition=default-branch,
  ref=refs/heads/master; secret_digest=match). Q4: 8 runs, all success; W1 delivered the caller's Environment marker on all
  4 legs (same owner and cross-owner); W2 `secrets: inherit` delivered on the 1 same-owner leg (org-private → org-public) and
  was silently empty on the 3 cross-owner legs; siblings empty everywhere; supervisor re-fetched 36112857842, 36112899071,
  36129037034, 36128934079. 4.4's deploy.sh reported `DEPLOY identical` (personal master commit a87dc5f 11:21:13Z carries the
  callers; blob identity verified by check-deploy.sh). Wave 4: 4.7 (merge ef3278e), 4.8 (merge f1ce105; all three apply
  steady first run). 4.9 (route judgment) executed by the supervisor in-tree (353c2ad): packet 2 = F1 only (F2 not raised),
  options B/C with packet 1 changes lists, recommendation B; decides nothing. Gate 4.10 in-tree (7fc5e9c) OVERALL: PASS;
  supervisor re-ran G1a–G8e: all hold (org-private Actions usage 2026-09: 87.00, October none; total 87 ≤ 300). Copilot
  requests 245 = base. Phase 4 complete; current-phase 5. Owner gate: packet 2
  development-artifacts/patch-steward-m2-decision-packet-2.md goes to the owner via the lead; Phase 5 does not wait, Phase 6
  does.

### Phase 5 notes

- Phase-5 base (roadmap `<phase-5 base>`): `67909efd5a6ffb4b9607e3c3ccca55c650650235` (working-branch HEAD at
  decomposition, the amendment-6 commit; `git diff --stat 10fcaf2 67909ef -- docs README.md CLAUDE.md` empty). Pinned by
  k-checks.sh (BASE5, findings SCOPE) and gate D5a/D5b. Base blobs: architecture d73d7484, processes 048e1d55, whitepaper
  6c3b2e63, README 4cf3cce4, CLAUDE.md 90b057cd, installation 3eaa08b9, configuration a2eea7fc, troubleshooting 590188ee,
  probes/findings.md 4b073223.
- READ FIRST — execution. Foreground agents only (Phase 1 rule); a parallel wave is several foreground Agent calls in ONE
  message. Phase 5 is LOCAL ONLY: no test-bed write, no GitHub API call, no Copilot request in any step (k-checks.sh reads
  git only). Run `pnpm install --frozen-lockfile` sequentially in each worktree before a wave (M01 pattern). Windows
  cleanup: `git worktree remove --force` on a worktree holding node_modules failed at decomposition ("Result too large");
  use `rm -rf <path>` then `git worktree prune`. Never chain `cd <worktree>` behind a command that can fail and then run
  further newline-separated commands: when the chain breaks they run in the MAIN tree (happened once during the
  decomposer's replay; the main tree's tracked files were restored with `git checkout --` before anything was committed).
- READ FIRST — validation boundary. Validated: every payload on a scratch worktree at 67909ef and replayed step by step
  (5.1 → 5.5, each step's literal actions and acceptance lines): apply first runs 17/12/1/3/5/2/2/3 applied and
  set-dispositions 25 applied; `pnpm prettier --write` re-pads only the tables named in each step's context (processes,
  installation, whitepaper, README, CLAUDE.md unchanged by Prettier); every re-apply after Prettier prints `applied=0
  already=<n>`; `k-checks.sh arch|proc|manual|summaries|findings|all` → OK; `pnpm format:check` and `pnpm lint` pass
  (lint covers the two payload .mjs files); gate D1–D6e give the expected values (D3a counts 1/1/2, D3b 1/1, D3c 0,
  D5/D6 empty, `.prettierignore` blob ba4ec991…); the gate acceptance awk passes a good report (16/16, 1) and fails a
  bad verdict or a missing row (15/16). At 67909ef k-checks FAILs every K item that needs a change (the checker
  discriminates). NOT validated: the worker runs themselves.
- Dependency graph. Wave 1 = 5.1 (architecture). Wave 2 = 5.2 (processes), 5.3 (user manual), 5.4 (whitepaper,
  README.md, CLAUDE.md), 5.5 (findings dispositions) — each depends_on 5.1 (base check `k-checks.sh arch` → OK);
  pairwise disjoint scopes. Wave 3 = gate 5.6 (all). MERGE ORDER inside wave 2 (brief precedence: governing documents,
  then summaries, then user manual): 5.2, 5.4, 5.3, 5.5.
- Decisions taken at decomposition (no brief amendment; none changes a gate, DoD, or closed set):
  - Text authored by the decomposer, applied by script. All Phase 5 wording lives in
    `development-artifacts/patch-steward-m2-phase5-checks/edits-*.txt` (45 blocks) and `set-dispositions.mjs` (header +
    20 cells + 4 roll-ups), applied by `apply-edits.mjs` (all-or-nothing, idempotent, CRLF-preserving). Why:
    governing-document wording with byte-exact literals (K1–K24, C1 markers) and the table-width constraint below;
    workers write no design text. Wording follows the brief's must-state items and the packet's chosen option texts.
  - Must-state map for the supervisor's DoD 7 judgment (block ids): Q1 A09, A11, A13, P03, P06, U01; Q2 A04, A10, P12;
    Q5 A03, A16, P02, P05, P10, U08, U09; Q6 A03, A06, A16, P08, P11; Q7 A02, A17, P05, P10, U06–U09; Q8 A05, A14, P09;
    Q9 A07, P07, U05; C1 table form A02, A08, A12, U02, U06, U08 and sentence form A15, A17, P01, P04, P05, P10, U03;
    unconditional A01, R01, R02, C01, C02, C03, U04; summaries W01 (§10, Q6 ripple), W02 (§14 mirrors reworded §15).
  - K25 vs Prettier (found at decomposition). K25 compares whole §7 rows (X7w, X7e) including padding, while the brief
    expects Prettier to realign edited tables. Resolved within the brief: every edited §7 "Use" cell is at most 304
    characters and the Copilot SDK inference cell is exactly 304 (the column width at `<start>`), so the column keeps its
    width and X7w/X7e stay byte-identical. To fit the C1 marker the Copilot SDK inference row was reworded, same meaning:
    "…organization-owned repositories bill the organization under the policy "…" (unverified; …), others the owner's
    seat; …". Phase 6 changes X7w/X7e (K25 void there) and may re-pad §7 freely.
  - Ripple decisions (each step's context carries a RIPPLE RECORD the worker copies into its report): whitepaper §10
    `publish`/cancellation sentence CHANGED (restated the removed Q6 rule); troubleshooting row "Check stays pending
    after job failure" unchanged (still true); CLAUDE.md invariants unchanged (none contradicted).
  - probes/findings.md header bullet `- dispositions:` rewritten now: Phase 6 DoD 7 allows only PA04/PA04.1 row changes,
    so the header must be final after Phase 5 (it contains no open-marker word).
  - Grouping: user manual in one step (5.3), summaries in one step (5.4) — small scripted edits.
- LEAD ITEM (not an owner decision; no Phase 5 text addresses it; nothing in the pipeline acts on it): Q1 A's text covers
  enforcement and the merge-queue relay only. The same plan refusal on a Free-plan organization's private repository
  (every ruleset → HTTP 403 "Upgrade to GitHub Pro or make this repository public…", probes/testbeds.md T8/T9) also
  removes the rulesets the design uses for evidence-branch push restriction (architecture §11, processes SP02 step 4)
  and for required code-owner review of policy and wrapper paths (processes SP01 step 2 and SP02 step 8, architecture §7
  row "Rulesets"), on which Q5 A's "wrapper edits stay on the CODEOWNERS-reviewed path" relies. The lead may raise it
  with the owner; a decision would return through a planner amendment.
- Emergent contracts (Phase 6).
  - k-checks.sh is Phase-5-specific in two places: K25 for X64p1, X7w, X7e, XP02a (void in Phase 6: F1 B changes them)
    and K27 (open-marker count 4, PA04.1 ×3 and PA04 roll-up expected open; Phase 6 K36 expects 0). Phase 6 must not use
    the `arch`, `proc`, `findings`, or `all` groups unchanged as its gate; `manual` and `summaries` stay valid (XCL still
    pinned by K35); the K1–K24 and K26 logic can be reused.
  - set-dispositions.mjs covers the Phase 5 targets only; Phase 6 needs its own setter for PA04.1 ×3 and the PA04
    roll-up. Never re-run phase-3 gen-findings.sh or check-findings.sh.
  - SP02 step 3 C1 sentence (Phase 6 keeps it byte-for-byte): "This organization billing path is unverified: no probe
    has run in an organization with Copilot (`probes/findings.md`, PA08.7)." — on the lines after "owner's Copilot seat
    instead (architecture §6.3)." and before " For" / "`env`, store the provider key…" (block P01).
  - Phase 5 text in §6.4 that F1 B must leave true: the Q5 sentences after the job table ("A wrapper that grants less
    than the pinned reusable workflow's jobs request fails the whole run at startup … `steward init` therefore writes
    wrapper permissions equal to the pinned reusable workflow's job permissions …"), the Q6 cancellation sentences, the
    Q8 concurrency bullet; SP02 step 7 (P02) and SP19 Failure handling (P10–P12).
  - probes/findings.md after Phase 5: exactly 4 open-marker lines (PA04.1 org-public, org-private, personal; PA04
    roll-up).
  - The §7 "Use" column is 304 characters wide, set by the Copilot SDK inference row.
- Budgets: none (no GitHub API, Actions, or Copilot use).
- Supervisor record, Phase 5 (2026-09-25). Waves ran as decomposed, no retry, no revision: 5.1 in-tree (7aacb6b); wave 2
  worktrees at 39b7c2f, merged 5.2 (b67c743), 5.4 (711e0b8), 5.3 (4c154fd), 5.5 (b641b59), no conflict; post-merge
  `k-checks.sh all` OK; gate 5.6 in-tree (aa4adac) OVERALL: PASS. Windows cleanup: `git worktree remove` succeeded but left
  untracked `node_modules/` + `packages/*/node_modules` directories behind; removed with `rm -rf` (earlier phases' leftover
  directories under `../worktrees/` were not touched). D7 (supervisor judgment) PASS, read against the brief's
  "Governing locations and must-state content (Phase 5)" and the merged text: Q1 (a)–(d) in A09, A11, A13, P03, P06, U01;
  Q2 (a)–(c) in A04, A10, P12; Q5 (a)–(d) in A03, A16, P02, P05, P10, U08, U09; Q6 (a)–(e) in A03 (`if:` unchanged; the
  sentence "A workflow cancellation can still prevent publication." removed), A06, A16, P08, P11; Q7 (a)–(d) in A02, A17,
  P05, P10, U06–U09; Q8 (a)–(c) in A05, A14, P09; Q9 (a)–(c) in A07, P07, U05; C1 T/S markers at every row of the brief's
  billing-location table incl. §12 "Spending" (gate INFO grep: every hit lies in a marked passage). Summaries: whitepaper
  §10 (W01) and §14 (W02, mirrors reworded §15) agree; whitepaper §11–§13, README, CLAUDE.md invariants re-read, not
  contradicted. F1-reserved: no diff hunk in the §6.4 first paragraph, job table, or wrapper table, §7 rows "Reusable
  workflows" / "Environments…", §13 "Compromised steward release", SP02 steps 1–2, CLAUDE.md "Intended architecture" (K25
  plus hunk list). Added lines in docs/README/CLAUDE.md citing `Mxx`/`PDxx`/plan file: 0.

### Phase 6 notes

- Phase-6 base (roadmap `<phase-6 base>`): `3c4583dea0ec4f5454ef7bd1b0fbc9d44a6f3a6d` (working-branch HEAD at
  decomposition = the amendment-8 commit). Pinned by k6-checks.sh (`BASE6`: SCOPE6, PROBES6, FROZEN6) and gate G7a–G7c.
  Amendment 8 came out of this decomposition: the decomposer's amendment note (§13 row "Compromised steward release"
  restates required code-owner review, but K35 pinned it) → planner option A (Q1E qualifies that clause; K35 pins the
  §13 canary X13s instead of X13c; new K53–K55; §13 width rule corrected to 471 characters of cell text; §1.2 decision
  14 recorded as not contradicted by F1 B). The planner appended its own Revisions row.
- READ FIRST — execution. Foreground agents only (Phase 1 rule); a parallel wave is several foreground Agent calls in ONE
  message. Steps 6.1–6.5 are LOCAL ONLY (no GitHub API call, no push, no Copilot request). Gate 6.6 makes GitHub GET
  reads only (project-dod.sh: check-deploy blob identity, steady-state lists, rulesets, org-private billing usage,
  check-q3/q4) — no test-bed write, no Copilot request; Bash timeout 600000 (the script takes 2–4 min: it also runs
  pnpm install/build/test/lint/format:check). Run `pnpm install --frozen-lockfile` sequentially in each worktree before
  a wave. Windows cleanup (Phase 5): `git worktree remove --force` fails on node_modules ("Result too large") — use
  `rm -rf <path>` then `git worktree prune`. Never chain `cd <worktree>` behind a command that can fail followed by more
  commands: a broken chain runs them in the MAIN tree.
- READ FIRST — validation boundary. Validated in a scratch worktree at 3c4583d with the payload committed (so every
  payload file was a CRLF checkout, as workers get it): each step's literal actions and acceptance in the order 6.1 →
  6.2 → 6.3 → 6.5 → 6.4, then every gate command. Apply counts 9/8/1/4/2+2; every re-apply after Prettier prints
  `applied=0 already=<n>`; `pnpm prettier --write` re-pads only the whole §7 table and the three edited §13 rows (the
  other files are Prettier-clean straight after the apply); `k6-checks.sh arch|proc|whitepaper|manual|findings|all` →
  OK; `pnpm format:check` and `pnpm lint` exit 0; `check-findings-final.sh` → OK; `project-dod.sh` LIVE → PROJECT-DOD
  OK (P6 check-deploy 9/9 dirs + smoke blob on 3 test-beds, P7 steady state, P12 org-private usage 87 ≤ 300);
  `milestone-verify.sh` → OK (15 plan quotes, 17 ripple anchors found); gate G1/G2/G5/G7a–G8e give the expected values;
  gate acceptance awk → `rows=14/14 overall-lines=1` on a good sample, 13/14 with a row missing, and the milestone
  diff fails when the output is pasted twice. Discrimination at 3c4583d (no Phase 6 edits): k6 arch FAIL 11, proc 7,
  whitepaper 1, manual 4, findings 6; check-findings-final FAIL (4 cells + open marker); project-dod FAIL 3 (P1, P3,
  P5). NOT validated: the worker runs themselves.
- Dependency graph. Wave 1 = 6.1 (architecture). Wave 2 = 6.2 (processes), 6.3 (whitepaper), 6.4 (user manual:
  installation + configuration), 6.5 (findings dispositions) — each depends_on 6.1 (base check `k6-checks.sh arch` →
  OK); pairwise disjoint scopes. MERGE ORDER inside wave 2 (brief precedence: governing documents, summaries, user
  manual): 6.2, 6.3, 6.4, 6.5. Wave 3 = gate 6.6 (all; also the final verification report).
- Decisions taken at decomposition (no further brief amendment; none changes a gate, DoD, or closed set):
  - Text authored by the decomposer, applied by script (Phase 5 pattern): 24 blocks in
    `development-artifacts/patch-steward-m2-phase6-checks/edits-*.txt` (A61–A69, P61–P68, W61, U61–U64, F61–F64),
    applied by the unchanged Phase 5 `apply-edits.mjs`. Workers write no design text.
  - No README.md or CLAUDE.md step: the ripple check found no contradiction (roadmap step-shaping rule); the record is
    in the gate report (milestone-verify.sh RIPPLE RECORD R1–R17). Each per-file step also copies a RIPPLE RECORD
    for its own file into its report.
  - Final verification merged into the gate: roadmap "A final verification step produces the evidence for the project
    DoD and LISTS … stale" and "The gate step depends on all others" are one step. milestone-verify.sh prints the
    exit-criteria map (EC1–EC8), stale plan text S1–S15 (S1–S5 `stale`, S6–S15 `note`; decomposer's reading of
    docs/project-development-plan.md at 3c4583d, re-verified by quote), plan-level notes L1–L3, ripple record R1–R17.
  - §7: the F1/Q1E cells exceed the old 304-character "Use" width, so Prettier re-pads the whole §7 table (allowed;
    K25 is void for X7w/X7e; every §7 check counts literals). §13 edited cells: 177, 264, 307 characters (≤ 471); X13s
    unchanged (K35).
  - probes/findings.md: the Disposition column is 46 wide, so the 40-character string keeps each row's width: exactly
    4 lines change (SCOPE6; roadmap DoD 7). `check-findings-final.sh` = the Phase 3 checker with the final
    dispositions; never run the Phase 3 gen-findings.sh or check-findings.sh.
  - DoD 1 "no row of the Decisions table says open or conditional" is checked on whole rows (13 rows).
  - NOCITE also guards `Q1E` (brief Q1E evidence bounds: the documents cite no `Q1E`).
  - The Q1E text quotes no refusal message (the brief allows it; "Upgrade to GitHub Pro or make this repository public"
    could read as the remedy the brief forbids).
- Must-state map for the supervisor's judgment (gate G3 and G6 are NOT-RUN by design; roadmap Phase 6 DoD 3 and 6):
  - F1: (a) A61; (b) A61, A63; (c) A61, A64; (d) A61; (e) P62; (f) P63; (g) P64. Evidence bounds as written: "across
    owners, between an organization and a user account in either direction, it delivered the secret empty, silently,
    with no error" (no same-owner claim, no organization-to-organization claim); each called job "receives the target
    repository's Environment value" (not the mapped expression's). `secrets: inherit` occurs only in A61 ("The design
    does not use"), A63 ("never"), P62 ("never") — k6-checks.sh `all` prints them as INFO lines. Relay stays
    credential-free: P62 "the credential-free `steward-relay.yml` passes no secrets"; §6.4 wrapper table unchanged (K35
    X64t).
  - Q1E: (a) A65, A66, P61, P65, P67; (b) A66, P65; (c) A66, P65, P67; (d) P61; (e) A62, P66; (f) A62, A65, A66, P61,
    P65, P66 (P67's Phase 5 sentence already names the case), also W61, U61, U63; (g) A67, A68, A69, P68, W61, U61, U62,
    U63, U64. Bounds: "as on / as it did on a Free-plan organization's private repository" refers to the general
    rulesets refusal (listing and creation), not to a push-restriction or code-owner-review ruleset; no claim about
    classic branch protection, CODEOWNERS files, or review requests; no remedy; modes, outcomes, admission, reports, and
    `inconclusive` causes unchanged.
  - Phase 5 sentences: A62 and P66 qualify the two Q5 sentences Q1E made false (K11/K13 `startup` kept); the C1
    sentence of SP02 step 3 is untouched (K24 XP02s3 S=1).
- Checkers (decomposer artifacts, read-only for workers): `development-artifacts/patch-steward-m2-phase6-checks/` —
  edits-*.txt, k6-checks.sh (groups arch, proc, whitepaper, manual, summaries, findings, all), check-findings-final.sh,
  project-dod.sh (project DoD 1–14; GET reads), milestone-verify.sh (local). Reused unchanged: phase2 check-result.sh,
  check-readme.sh, check-deploy.sh, coverage.txt; phase3 check-probes-readme.sh; phase4 check-q3.sh, check-q4.sh,
  check-packet2.sh; phase5 apply-edits.mjs. The Phase 5 k-checks.sh groups `arch`, `proc`, `findings`, `all` FAIL by
  design after Phase 6 (K25/K27); nothing in Phase 6 runs them.
- Emergent contracts: none for a later phase (Phase 6 is the last). For the lead: the gate report's
  `## Milestone verification` section (stale plan text, plan-level notes L1 Q7 C/M09, L2 F1 org-to-org untested,
  L3 allowance exhausted until 2026-10-01T00:00:00Z).
- Budgets: no Copilot request; GitHub API ~150 GET calls in the gate (5000/h).
- Supervisor record, Phase 6 (2026-09-25): no revision, retry, or amendment. 6.1 in-tree (e4be1fc); wave 2 in
  worktrees at 65315ca, merged 6.2 cb8f61d, 6.3 e3d7bcd, 6.4 32f5948, 6.5 5ff145e; post-merge `k6-checks.sh all` OK
  (INFO secrets-inherit: architecture.md:299 A61, :570 A63, processes.md:183 P62 only) and CHECK-FINDINGS-FINAL OK;
  gate 6.6 in-tree (89a7317). Worktrees removed with `rm -rf` + `git worktree prune`; `wt/` branches deleted.
- Supervisor judgment, roadmap Phase 6 DoD 3 — PASS. The only Phase 6 disposition string
  `design-change: docs/architecture.md §6.4` (PA04.1 ×3, PA04 roll-up) names §6.4, whose first paragraph now holds the
  F1 text (A61); Phase 5 dispositions unchanged (K27). Summaries: whitepaper §12 qualified (W61); §3 (ownership), §9
  (feature list), §10 "Only `gate`/`publish` hold App credentials…", §11 agree with F1/Q1E. `CLAUDE.md` and `README.md`
  unchanged since 3c4583d and restate neither the push restriction nor required code-owner review; "Intended
  architecture" (separate default-branch-only `env` Environment; no job holds both credentials) agrees with F1.
  Architecture §15 and whitepaper §14 untouched in Phase 6 (diff hunks end at §13), so the Phase 5 D7 mirror judgment
  stands.
- Supervisor judgment, roadmap Phase 6 DoD 6 — PASS. F1 (a)–(d) in §6.4 first paragraph (one paragraph, opening kept),
  (b) §7 "Reusable workflows" row incl. issues/maintenance runs, (c) §7 "Environments" row, (e) SP02 step 1 incl.
  relay "passes no secrets", (f) SP02 step 2, (g) SP02 step 3 (C1 sentence byte-kept). Bounds held: failure stated only
  "across owners, between an organization and a user account in either direction"; value = "target repository's
  Environment value"; no org-to-org claim; every `secrets: inherit` is "does not use"/"never". Relay credential-free
  (§6.4 wrapper table unchanged). Q1E (a) §7 "Rulesets" (cites §11), §11, SP01 step 2, SP02 steps 4 and 8; (b) §11,
  SP02 step 4; (c) §11 cites "SP02 step 4", SP02 steps 4 and 8; (d) SP01 step 2 rest unchanged; (e) §6.4 and SP02 step 7
  Q5 sentences qualified, `startup` kept; (f) Free-plan organization's private repository at each location; (g) §13 ×3,
  SP18, whitepaper §12, installation steps 4 and 8, configuration ×2. Added text scanned: no branch protection, upgrade,
  "make public", separate-repository remedy, `Q1E`/`PDxx`/`Mxx` cite, or refusal quote; no Phase 5 sentence left false
  (K11/K13/K17/K21/K24 hold).
- For the lead (not edited here; `docs/project-development-plan.md` untouched, G7c): gate report
  `## Milestone verification` lists stale plan text S1–S5 (`stale`) and S6–S15 (`note`), plan-level notes L1–L3.

### Phase 7 notes

- Phase-7 base (brief `<phase-7 base>`): `67a326f90a7a197cd2643ebeb65895d7225fa556` (working-branch HEAD at
  decomposition = the amendment-11 commit; `docs/`, `README.md`, `CLAUDE.md`, `fixtures/`, `probes/` unchanged since
  `<P7>` = `5faf6f4`). Re-grepped at decomposition: the K67 sweep prints the brief's 37 lines exactly; the PAT dry-run
  prints the brief's 5 lines exactly. Pinned by k7-checks.sh (`BASE7`: K71, K72, K73, K75, K77) and gate7.sh (`BASE7`: G9).
- READ FIRST — post-completion revision of 2026-09-25 (owner order 13, amendment 13 at `6e8dd0d`; the owner's "Fix,
  then merge", relayed by the lead after the milestone evaluation). Phase 7 REOPENED; completed steps 7.1–7.4 and
  their reports stay untouched (they ran against the old text; the 7.1–7.3 payloads under P7/adr and P7/edits-*.txt
  other than edits-fix-* are history and are not re-applied). New steps, `<R7>` = `128249625790799e02a03284844495cc6557d0de`
  (Phase 7 completion commit; docs/, README.md, CLAUDE.md, fixtures/, probes/ unchanged through `6e8dd0d` and the
  revision commit):
  - 7.5 (mechanical; depends_on 7.1, 7.2 — both done, so it is ready at once): applies P7/edits-fix-0002.txt (V71–V72),
    edits-fix-0004.txt (V73–V74), edits-fix-adr-index.txt (V75–V76), edits-fix-0025.txt (V77), edits-fix-claude.txt
    (V78) with the phase-5 apply-edits.mjs; files CLAUDE.md, docs/adr/0002-browser-secrets.md,
    docs/adr/0004-security-reports.md, docs/adr/0025-ruleset-dependent-controls-limitation.md, docs/adr/README.md;
    apply counts 2/2/2/1/1; no Prettier --write (all five files Prettier-clean as applied). Lone step: run it in-tree
    or in a short-path worktree (see "worktree path length").
  - 7.6 (gate re-run; depends_on 7.5): identical to 7.4 except the report path, the base check (7.5 merged), G1's
    expectation (K56–K80), D6 covering the owner-order-13 judgment, and `## For the lead` also copying the four `K80 `
    lines. Run in-tree after 7.5 is merged (like 7.4). Roadmap Phase 7 DoD (as amended: DoD 1 K56–K80, DoD 6 adds the
    owner-order-13 judgment) is the phase check; the supervisor re-runs both gate7.sh modes and judges D6.
  - Texts (decomposer-authored, brief D1 / "ADR content rules" evidence-link bullet / `LF`): ADR-0002 and ADR-0004
    `- Date: 2026-09-16`; their More Information History line: "[Whitepaper §14](../whitepaper.md) states that the
    decisions recorded with the architecture were revised on September 16, 2026; this record takes that stated
    revision date as its date." plus "first committed in commit `f79de29` (2026-09-16); its present text, … was
    committed in commit `0da65aa` (2026-09-17)" (no docs/deferred.md mention: K76 allows one DF line per ADR); index
    rows → 2026-09-16 (same width, no re-pad); ADR-0025 context: the refusal sentence's parenthesis now also links
    "that repository's [PA01 results](…/pa01-required-checks/results/org-private.md) and [PA06
    results](…/pa06-merge-queue-relay/results/org-private.md)" (both record T8/T9 copies as E1), and the confirmation
    sentence links pa01 org-public.md, pa01 personal.md, pa06 org-public.md (no word of the ADR changes otherwise);
    CLAUDE.md format-check bullet = `LF` (inserts "`docs/adr/*.md`, " only).
  - Checkers: k7-checks.sh gains K80 (brief; (a) dates, (b) ADR-0025 links in group adr; (c) `LF` in summaries — LF
    read from the brief's one `LF: ` line like `LP`; (d) the set of files changed since `<R7>` outside
    development-artifacts/ and the plan, in all) and `R7`; gate7.sh changes only G1's PASS text (K56-K80). All other
    checkers unchanged. Expectations of "Milestone re-verification after Phase 7" unchanged.
  - Validation (2026-09-25, scratch commit of this revision on `6e8dd0d`, CRLF checkouts, worktrees under
    `C:/Users/John/Projects/steady-orchard/worktrees/`): 7.5 in a fresh worktree — base check BASE-OK, apply 2/2/2/1/1,
    acceptance 1–6 exactly as written (K80 PASS (a)–(d) + `K7-CHECKS all OK`; k6 summaries only `NOCITE FAIL CLAUDE.md
    new=1 old=0`; re-apply already 2/2/2/1/1; format:check and lint exit 0; scope = the five files); then 7.6 on the
    committed 7.5 in the same worktree — base check BASE-OK, `gate7.sh local` → G1–G11 PASS, `GATE7-LOCAL OK` (3m03s;
    COVERAGE-AUDIT 39/39; STALE-PLAN-TEXT 15/15; RIPPLE-RECORD 17/17; MILESTONE-VERIFY OK), `gate7.sh dod` LIVE (GET
    reads only) → G12 PASS, `GATE7-DOD OK` (1m57s; project-dod FAIL lines exactly P5, P10 ×2, P11; P9 PASS; P13
    `CLAUDE.md:1 docs/user-manual/configuration.md:1`, lacking fifth entry 0); 7.6 acceptance on an assembled report →
    18 × `<id> 1`, 1, 16, 1, scope = report only. Discrimination: on the unfixed tree k7 all FAILs exactly K80 (a),
    (b), (c), (d); planted defects each FAIL: an org-private link left on the confirmation sentence (K80 (b)), a
    whitepaper edit (K80 (a), (d)), a doubled space in the bullet (K80 (c)). NOT validated: the worker runs themselves.
- READ FIRST — execution. Foreground agents only (Phase 1 rule); a parallel wave is several foreground Agent calls in ONE
  message. Steps 7.1–7.3 are LOCAL ONLY (no GitHub API call, no push, no Copilot request). Gate 7.4 makes GitHub GET
  reads only, inside project-dod.sh (`gate7.sh dod`); Bash timeout 600000 for each gate7.sh mode (at decomposition:
  `local` 2m46s, `dod` 1m56s). Run `pnpm install --frozen-lockfile` sequentially in each worktree before a wave (2 s,
  store cached). Windows cleanup (worked at decomposition): `rm -rf <worktree>` then `git worktree prune`. Never chain
  `cd <worktree>` behind a command that can fail followed by more commands.
- READ FIRST — validation boundary. Validated in two scratch worktrees at 67a326f with the payload and the four step
  files committed (CRLF checkouts, as workers get them): 7.1 in worktree A; 7.2 in worktree B (base WITHOUT 7.1); 7.3
  in A on top of 7.1 only; 7.2 cherry-picked into A plus a `merge(patch-steward-m2): step 7.3` commit; gate 7.4 in A.
  Every step's literal actions and acceptance lines gave the expected output: apply counts 2 / 1, 2, 1, 7 / 8, 11, 2,
  1, 1, 1, 1, 2; every re-apply `applied=0 already=<n>`; Prettier --write changes only docs/deferred.md and the plan
  (table re-padding; every other edited file and all 34 docs/adr files are Prettier-clean as applied); `pnpm
  format:check` and `pnpm lint` exit 0; `gate7.sh local` → `GATE7-LOCAL OK` (G1–G11 PASS); `gate7.sh dod` LIVE → `GATE7-DOD
  OK` (project-dod.sh FAIL lines exactly P5, P10 ×2, P11; P6 9/9 + smoke blob on 3 test-beds, P7 steady state, P12
  org-private usage 87 ≤ 300 all PASS); the 7.4 acceptance on an assembled report → 18 × `<id> 1`, `1`, `16`, `1`.
  Discrimination: at 67a326f k7-checks.sh FAILs adr 58, arch 2, summaries 10, rest 8, all 80; planted defects (a
  `deferred` line without a DF id, `M13` in an ADR, a changed Chosen title, a commit not on develop, links into the plan,
  into development-artifacts/, and to a missing file, a wrapped LP, a plan mention in README.md) each FAIL their check.
  NOT validated: the worker runs themselves.
- READ FIRST — revision of 2026-09-25 (amendment 12, owner order 12: restate the six unrestated §1.2 clauses; brief
  "Restatements of §1.2 clauses" RS1–RS10, K71 exception, K79). Revised IN PLACE, same ids, no step had run: 7.1
  (edits-architecture.txt 2 → 8 blocks: A73–A78 = RS1–RS6, table rows as whole pre-padded rows; new acceptance line 4
  `milestone-verify.sh` → `MILESTONE-VERIFY OK`; re-apply `already=8`), 7.2 (edits-processes.txt 1 → 5 blocks:
  P72–P75 = RS7–RS10; apply/re-apply 5), 7.4 (G7 and G11 expectations; `## For the lead` copies unrestated coverage
  rows, none expected); ADR payloads 0004, 0005, 0013, 0014, 0016 (Consequences name their RS locations; brief "ADR
  content rules"); k7-checks.sh, gate7.sh, coverage-audit.sh (see Checkers, Coverage audit). 7.3, graph, scopes,
  `BASE7` = 67a326f unchanged (`docs/`, `README.md`, `CLAUDE.md`, `fixtures/`, `probes/` identical 67a326f..6022bf4).
  RS texts are the brief's byte-exact (block ↔ literal check: every OLD/NEW matches; each K79 literal once in the
  applied file). Re-validated at a scratch commit of this revision on 6022bf4 (CRLF checkouts): 7.1 in worktree A
  (apply 8; acceptance 1–9 as written: k7 adr OK, k7 arch OK, k6 arch OK, MILESTONE-VERIFY OK, already=8, 34, format,
  lint, 0/35); 7.2 in worktree B without 7.1 (apply 5/2/1/7; all 8 lines as written, k6 summaries only NOCITE); 7.3
  in A on 7.1 (apply 8/11/2/1/1/1/1/2, k7 rest OK, k6 findings only PROBES6); 7.2 cherry-picked + `merge(…): step
  7.3`; `gate7.sh local` → `GATE7-LOCAL OK` (G1–G11 PASS; K71 architecture new=8 old=6, processes new=7 old=4; G7
  MILESTONE-VERIFY OK; G11 39/39) in 2m52s; `gate7.sh dod` LIVE (GET reads only) → `GATE7-DOD OK` (FAIL lines exactly
  P5, P10 ×2, P11) in 1m58s; 7.4 acceptance line 3 on the outputs → 16. Discrimination: at the pre-step commit k7 arch
  FAILs 9 (K79 ×6, audit 33/39, K66, K71); planted defects each FAIL: RS2 reworded (K71, K79, audit), RS3 with extra
  text (K71), RS3 moved to §6.5 (K79 section), RS9 duplicated (K71), RS5 removed (milestone-verify R10 MISSING).
- READ FIRST — worktree path length (Windows; found in the revision re-validation). A worktree under a long path
  (the ~140-character session scratchpad) breaks `pnpm test`: vitest fails at startup with ERR_PACKAGE_IMPORT_NOT_DEFINED
  "#module-evaluator" (package.json beyond MAX_PATH), so project-dod.sh P9 FAILs and `gate7.sh dod` G12 FAILs for an
  environmental reason. The same commit in `C:/Users/John/Projects/steady-orchard/<short>` passes (P9 PASS, GATE7-DOD
  OK). Run gate 7.4 in-tree (as planned) or in a short-path worktree; a P9 FAIL with that error is not a step defect.
- Dependency graph. Wave 1 = 7.1 (docs/adr + docs/architecture.md; ADRs land with the §1.2 removal) and 7.2
  (processes, whitepaper, README.md, CLAUDE.md; ADR ids only, no link, so no dependency). Wave 2 = 7.3 (deferred, plan,
  fixtures/README.md, five probe READMEs) depends_on 7.1 (links to docs/adr/0023-… and 0033-…). Wave 3 = gate 7.4 (all;
  in-tree like 6.6). Pairwise disjoint scopes. MERGE ORDER (roadmap): 7.1, 7.2, 7.3.
- Decisions taken at decomposition (no brief amendment; none changes a gate, DoD, or closed set):
  - Text authored by the decomposer, applied by script (Phase 5–6 pattern). P7 =
    `development-artifacts/patch-steward-m2-phase7-checks/`: `adr/` (34 files, copied verbatim), `edits-*.txt` (A71–A78,
    P71–P75, W71–W72, R71, C71–C77, D71–D78, L71–L81, X71–X72, B71–B76) applied by the unchanged Phase 5 apply-edits.mjs;
    `LP` and the deferred-features sentence were extracted from the brief byte-exact. Workers write no ADR or design text.
  - D1 dates (supervisor judgment): ADR-0002 and ADR-0004 = 2026-09-17 (last changed by `0da65aa`); ADR-0008, ADR-0014,
    ADR-0015, ADR-0016 = 2026-09-16 (architecture status line "LLM provider decisions revised on September 16, 2026 after
    the retirement of GitHub Models", read as the decisions on the LLM provider, its authentication, preflight inference,
    and inference admission; each ADR's More Information states the derivation); every other ADR-0001–0016 = 2026-09-15.
    Each records `f79de29` (2026-09-16, first commit) and, for 0002/0004, `0da65aa`. SUPERSEDED for ADR-0002 and
    ADR-0004 by owner order 13 (amendment 13, brief D1): both = 2026-09-16, applied by step 7.5 (see "READ FIRST —
    post-completion revision" above).
  - Considered options (P7-Q2 A revised; brief: ADR-0001–0016 only Choice-cell-named rejections plus the DF one-liners):
    0002 DF07, 0004 DF02, 0005 DF05, 0010 DF03 (one line each); 0008 Copilot code review, the Copilot coding agent,
    tool-enabled Copilot sessions, a default provider; 0013 persisted orchestration state; 0014 secret values in the
    policy; every other ADR-0001–0016 one option plus "No other option was recorded.". 0017 TypeScript and Python;
    0019 per-package versions (plan M01 "Decisions to settle first"); 0022 a workspace package (named by the decision);
    0023 a workspace package and this repository's `.github/workflows/` (owner decision 6 text); 0024 recording after a
    confirmation (the plan-time brief's confirmation item that "Adopt PA ids" made redundant); 0025 Q1 A, B, C plus the
    extension, chosen = the extension ("Extend the accepted limitation to every ruleset-dependent control"); 0026–0031 the
    packet options; 0032 C1 A, B, C; 0033 packet 2 B, C. Titles descriptive, never letters.
  - Reasons (`because`) only where a source records one: 0002 (§6.6), 0004 (DF02 reasons), 0006 (§4), 0008 (§13
    provider-retirement mitigation), 0009 (§11), 0010 (DF03 reason), 0015 and 0016 (Choice cell; §12), 0017 and 0018
    (decision text), 0019 (M01 brief: CD path filter and tag logic keep their semantics), 0023 (plan-time location
    decision: test-beds disposable, recreatable), 0024 (confirmation dropped as redundant), 0025–0033 (packet
    recommendations; the Q1E extension noted as having no separate rationale); every other ADR states "No rationale was
    recorded for this decision.".
  - Plan-level content omitted (brief): Q7 C's M09 consequence and "decides nothing about this project's own
    repository"; F1's organization-to-organization gap appears in ADR-0033 only as evidence ("No organization-to-
    organization call was tested"; the owner's verbatim "organization-to-organization case is untested").
  - Citation forms: processes line 8, whitepaper §14, plan line 18 use "(ADR-0001–ADR-0016 in `docs/adr`)"; deferred.md
    §0.3 uses "(ADR-0001–ADR-0016)". CLAUDE.md: the `docs/adr/` bullet follows the processes bullet; the record-only rule
    bullet follows "Precedence…"; `LP` follows "After adding or superseding an ADR…". README.md: the `docs/adr/` entry
    follows docs/processes.md.
  - Probe READMEs: pa01/pa03/pa05 steps now use/lint "the canonical files already in `probes/<dir>/`" with the ADR-0023
    link; pa08 gains one sentence with the link before its step-4 fence, its step 4 lints in place, and its follow-up
    drops the `cp` line; pa04 "The owner's decision on the wiring is recorded in [ADR-0033](…)".
  - k7-checks.sh beyond the brief's letter: K57 also requires lines 2 and 7 blank; K58 also requires "No other option was
    recorded." for single-option ADRs and "No rationale was recorded" without a because clause; K65 also matches each
    index row's title, status, and date to the ADR file; K76 counts `DF[0-9]{2}` case-sensitively (the lowercase anchor
    is not a second match) and pins the four pairs; git grep runs with --untracked (same result before the commit and
    after the merge); K71 normalizes runs of spaces and '-', excludes §1.2 for architecture, and accepts for the
    whitepaper old lines containing "(M01)" or ending "The monorepo layout in §9 is implemented" and new lines containing
    "… is implemented;" or inside the K75 sentence.
- Checkers (decomposer artifacts, read-only for workers): P7/k7-checks.sh (groups adr, arch, summaries, rest, all),
  P7/gate7.sh (local | dod; ids G1, G2, G3a–G3d, G4–G7, G8a–G8c, G9–G12), P7/coverage-audit.sh. Reused unchanged: phase5
  apply-edits.mjs; phase6 k6-checks.sh, check-findings-final.sh, project-dod.sh, milestone-verify.sh; phase2
  check-readme.sh. Since the amendment-12 revision: k7 K79 (group arch = RS1–RS6 + the coverage-audit last line; group
  summaries = RS7–RS10; all = both) and the K71 RS exception read the RS literals from the brief section "Restatements
  of §1.2 clauses" at run time (as K78 reads `LP`); a table RS is allowed as the phase-7-base row containing OLD, as is
  (old side) and with OLD→NEW (new side), a prose RS as the lines of its OLD/NEW text. gate7.sh G7 now expects every
  milestone-verify item ok (R10 found, `RIPPLE-RECORD items=17 anchors-found=17`, `MILESTONE-VERIFY OK`); G11 expects
  exactly `COVERAGE-AUDIT clauses=39 restated=39 not-restated=0 anchors-missing=0`; coverage-audit.sh exits 1 on any
  missing anchor or unrestated clause.
- Coverage audit (gate G11 and K79; brief "Not mechanical", amendment 12): 39 §1.2 Choice clauses, 39 restated by a
  governing section after the removal. The six the first decomposition found unrestated (C4.1, C5.2, C5.3, C13.3, C14.3,
  C16.3) now map to the brief's RS texts: C4.1 → RS1 (§1.1 "Submission types") + RS8 (SP08 step 4); C5.2 → RS4 (§7
  "GitHub App"); C5.3 → RS2 (§1.1 "Hosting"); C13.3 → RS3 (§6.4 first paragraph) + RS9 (SP19 step 1); C14.3 → RS5 (§8
  "Inference") + RS7 (SP02 step 3); C16.3 → RS6 (§12 "Spending") + RS10 (SP19 step 10). The audit rows anchor the
  architecture RS (so 7.1 alone yields 39/39); K79 checks the processes RS. C14.2's anchor dropped its final period
  ("References only, never secret values"), which RS5 turns into a semicolon.
- Emergent contracts: none (Phase 7 is the last phase). For the lead after the gate: stale plan text S1–S15
  (milestone-verify.sh), and the post-merge cleanup of development-artifacts/ (no persistent document or probe README
  cites a path under it: K64, K69). The coverage audit is a gate check now (zero unrestated clauses), no longer a lead
  item.
- Budgets: no Copilot request; GitHub API ≈150 GET calls in the gate (5000/h).
- PHASE 7 COMPLETE (supervisor, 2026-09-25). Execution: wave 1 = 7.1 and 7.2 in worktrees
  `C:/Users/John/Projects/steady-orchard/worktrees/patch-steward-m2-7.{1,2}` at `342fbd8` (short path; pnpm install in
  each), merged in order 7.1 → `26a9600`, 7.2 → `402488d`; worktrees and wt/ branches removed; post-merge k7 adr, arch,
  summaries OK. Wave 2 = 7.3 in-tree (lone step) → `fc4bce7`. Gate 7.4 in-tree → `c1c2da5`. No retry, no revision, no
  amendment. Local only: no GitHub write, no push, no Copilot request (gate7.sh dod GET reads only).
  - DoD 1, 2, 4, 5 (mechanical): supervisor re-ran `gate7.sh local` at `c1c2da5` → G1–G11 PASS, `GATE7-LOCAL OK`
    (COVERAGE-AUDIT clauses=39 restated=39 not-restated=0 anchors-missing=0; STALE-PLAN-TEXT items=15 found=15
    missing=0; MILESTONE-VERIFY OK) and `gate7.sh dod` → G12 PASS, `GATE7-DOD OK` (project-dod FAIL lines exactly P5,
    P10 ×2, P11, `PROJECT-DOD FAIL 4`; P6, P7, P9 install+build+test+lint+format:check, P12 all PASS). DoD 3: project-dod
    P1–P14 with the brief's P5′/P10′a/P10′b/P11′ replacements (G1, G6, G8a–G8c PASS).
  - Owner rules, verified independently of the checkers: K74 `git grep -nE "$PAT" -- $PERSIST` prints exactly 3 lines
    (CLAUDE.md `pnpm format:check` bullet, CLAUDE.md `LP`, user-manual configuration `.prettierignore` row); K69 prints
    nothing; plan §9 byte-identical to `67a326f` and PD01–PD08 counts unchanged (4 3 9 6 4 3 4 11); no
    `decision(s) N` in docs/adr; §1.2 pointer, docs/adr/README.md "Precedence", and the CLAUDE.md record-only bullet
    state owner order 3 (records govern nothing; architecture, processes, user manual govern; conflict → superseded).
  - DoD 6 (supervisor judgment) → PASS. ADR dates: 0002/0004 = 2026-09-17 (last text change `0da65aa`; 0004's change
    substantive, 0002's editorial — MADR last-change rule, history stated); 0008/0014/0015/0016 = 2026-09-16 (status-line
    "LLM provider decisions revised"; each ADR states the derivation); others 2026-09-15 — accepted. Considered options:
    only Choice-cell-named rejections, the four DF one-liners (0002 DF07, 0004 DF02, 0005 DF05, 0010 DF03; no design
    restated), plan/M01/packet options stated without ids, plan-level consequences dropped (Q7 C "M09 …" absent);
    titles descriptive — accepted. Reasons: each `because` traces to a recorded source (architecture §4/§6.6/§11/§13,
    DF02/DF03 reasons, decision texts, packet recommendations); others state "No rationale was recorded" — no invented
    rationale. ADR-0025: options = packet Q1 A/B/C + extension, chosen = extension, "No separate rationale was recorded
    for the extension"; Q1E bounds hold (no branch-protection claim, "No probe tried either control", no upgrade
    advice). ADR-0033 F1 bounds hold (inherit delivered same-owner; mapped expression empty; org-to-org untested).
    ADR-0029/0032 carry C1 S; 0032 carries T. ADR-0021's extra sentence "CI makes no live GitHub or model calls." comes
    from a planning source, unattributed (allowed by brief "ADR content rules"). RS1–RS10 faithful to C4.1, C5.2,
    C5.3, C13.3, C14.3, C16.3, no widening/narrowing, each in its owning section; gate coverage audit lists no
    unrestated clause.
  - Non-blocking observations for the lead: (1) ADR-0025 Context attaches `[PA01 results]`/`[PA06 results]` (links to
    the org-private result files, which record the refusal) to the sentence about confirmation on the PUBLIC test-beds —
    citation placement, not a false statement. (2) Pre-existing date wording left untouched by scope: whitepaper §14
    "Decisions recorded on September 15, 2026 and revised on September 16, 2026" and docs/deferred.md "ADR-0002, as
    revised September 16, 2026" versus ADR-0002/ADR-0004 `Date: 2026-09-17` (their More Information records `0da65aa`).
    (3) Lead items from the gate: stale plan text S1–S15 (milestone-verify output in the 7.4 report) and the post-merge
    cleanup of development-artifacts/.
- PHASE 7 COMPLETE AGAIN (supervisor, 2026-09-25, after owner order 13). Execution: 7.5 in-tree (lone step, base
  `f5ba028`) → `74b29af`; ledger `c96b65c`; gate 7.6 in-tree (base `c96b65c`) → `77fa769`; ledger `d9e2c0d`. No retry,
  no revision, no amendment. Local only: no GitHub write, no push, no Copilot request (gate7.sh dod GET reads only).
  - DoD 1, 2, 4, 5 (mechanical): supervisor re-ran `gate7.sh local` at `77fa769` → G1–G11 PASS, `GATE7-LOCAL OK` (K80
    PASS (a)–(d); COVERAGE-AUDIT clauses=39 restated=39 not-restated=0 anchors-missing=0; STALE-PLAN-TEXT items=15
    found=15 missing=0; RIPPLE-RECORD items=17 anchors-found=17; MILESTONE-VERIFY OK) and `gate7.sh dod` → G12 PASS,
    `GATE7-DOD OK` (project-dod FAIL lines exactly P5, P10 ×2, P11, `PROJECT-DOD FAIL 4`; P6, P7, P9, P12, P13
    `CLAUDE.md:1 docs/user-manual/configuration.md:1`, P14 all PASS). DoD 3: P1–P14 with P5′/P10′a/P10′b/P11′ (G1, G6,
    G8a–G8c PASS).
  - Owner rules, verified independently of the checkers: K74 `git grep -nE "$PAT" -- $PERSIST` prints exactly 3 lines
    (CLAUDE.md:65 format-check bullet = `LF`, CLAUDE.md:67 `LP`, docs/user-manual/configuration.md:261); files changed
    since `<R7>` outside development-artifacts/ = exactly the five fixed files (no probes/ change, so the `probes/`
    exception is untouched); plan §9 byte-identical to `67a326f` (normalized hash equal) and PD01–PD08 counts 4 3 9 6 4
    3 4 11; no `decision(s) N` in docs/adr; record-only rule unchanged (CLAUDE.md bullet, docs/adr/README.md, §1.2
    pointer untouched since `<R7>`); coverage 39/39.
  - DoD 6 (supervisor judgment) → PASS. First-completion judgment stands for every ADR the fixes did not touch.
    Owner order 13: fix 1 — ADR-0002/ADR-0004 line 4 `- Date: 2026-09-16`; History cites `[Whitepaper §14](../whitepaper.md)`
    (whitepaper line 765 "Decisions recorded on September 15, 2026 and revised on September 16, 2026" — faithfully
    stated), records `f79de29` (2026-09-16) and `0da65aa` (2026-09-17), names no docs/deferred.md; index rows
    2026-09-16; whitepaper and deferred.md unchanged. Fix 2 — ADR-0025 org-private PA01/PA06 result links (2
    occurrences) only in the refusal parenthesis; the confirmation sentence links pa01 org-public.md and personal.md
    (PA01.1–PA01.7 confirmed in each) and pa06 org-public.md (PA06.1–PA06.5 confirmed); no other word changed. Fix 3
    — CLAUDE.md bullet byte-equal to brief `LF` (inserts "`docs/adr/*.md`, " only; five `.prettierignore` entries
    kept). No new planning citation.
  - Non-blocking: the 7.6 report's `## For the lead` sentence writes "S1-S15" (hyphen) where the step text has "S1–S15"
    (en dash); no acceptance or gate reads it.

## Revisions

<!-- supervisor appends: phase | failed step | revision note | outcome -->

| phase | failed step                                                                                                                                                                                                                                                                                          | revision note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | outcome                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4   | none — amendment 1: owner's plan-review answers (2026-09-18), relayed by the lead before any decomposition                                                                                                                                                                                           | Owner decisions 5–8 recorded in the brief. (5) Fork `jambolo/patch-steward-testbed-public` approved: the brief's fork assumption became a decision. (6) Probe suite location root `probes/` approved. (7) PA01–PA09 identifier family adopted: recording it in architecture §6.1, `README.md`, and `CLAUDE.md` is unconditional in Phase 4; decision-packet confirmation item `C2` dropped as redundant (brief "Decision packet format", roadmap Phase 3 DoD 4, Phase 4 DoD 4, project DoD 5). (8) "Raise Copilot budget": the 24-prompt budget became the standard budget; a separate, last, hard-bounded "Copilot cap step" on `personal` exhausts the Copilot Free allowance (PA08.5, then part (c) of PA08.3); ordering, stop reasons, early-exhaustion rule, and drift-re-run exclusion added (brief PA08 table, coverage note, "Running, waiting, and budgets", acceptance rules, Assumptions, project DoD 12; roadmap strategy, Phase 1 scope, Phase 2 scope, dependencies, step-shaping, DoD 5 and 7, risks, Phase 3 DoD 3). Documented Copilot facts corrected and extended in the brief (usage-based billing in AI credits since 2026-06-01; Copilot Free allowance unpublished; session-limit minimum 30 AI credits; monthly reset; SDK token path).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | brief amended; the cap session ceiling `S` stays `PENDING` — GitHub publishes no Copilot Free allowance, so no defensible bound follows from documentation; owner input requested (`RESULT: needs-human`). Phase 1 is unaffected; Phase 2 decomposition is blocked until a further amendment records `S` |
| 2–3   | none — amendment 2: owner's answer ("Fixed S = 10", 2026-09-18) to the question amendment 1 returned, relayed by the lead before any decomposition                                                                                                                                                   | Cap session ceiling recorded: `S = 10`, a fixed number chosen by the owner (option B of amendment 1's question); the owner reported neither the size of the Copilot Free allowance nor the credits already used this month, so nothing is derived from them. Brief: "Copilot cap step" hard bounds (the `S` bullet rewritten with the worst case — 10 cap session runs, 405 sends, 450 runner-minutes plus the probe session run, about 300 AI credits plus overshoot; the probe session does not count toward `S`; `timeout-minutes: 45` now also binds the probe session job), stop reasons, results; owner decision 8 and the decisions' sources; test-bed inventory (allowance size and use unknown); "Decision packet format" (new mandatory option after `ceiling-reached`: continue under a new owner-approved ceiling, as the owner's chosen option states); acceptance-design rules and project DoD 12 (numeric bounds 10 and 405); Assumptions (ceiling no longer an open owner input; outcome per allowance case). Roadmap: Phase 2 dependency on this amendment and its decomposition guard removed; Phase 2 DoD 5 and risks; Phase 3 DoD 3 and 4 and owner gate (cap-continuation route). Ledger: Phase 2 note cleared.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | brief amended; Phase 2 decomposition is unblocked and depends only on Phase 1; the Phase 4 gate on the brief's "Post-probe owner decisions" is unchanged                                                                                                                                                 |
| 1–4   | none — amendment 3, GATE-AFFECTING, owner-approved: the owner added `development-artifacts/` to `.prettierignore` (committed by the lead on the working branch as `49ef1bf`); the owner's chosen option "Keep it, amend plan" (2026-09-18) was relayed verbatim by the lead before any decomposition | Owner decision 9 recorded in the brief. Conflict resolved: brief Constraints, roadmap `HEALTH`, and project DoD 10 required `.prettierignore` unchanged since the starting commit; the brief's Prettier facts, M01 lesson (1), and the worker report rules assumed that Prettier checks `development-artifacts/`. Gates WEAKENED, with the owner's approval: (1) `.prettierignore` is no longer compared with the starting commit; (2) nothing under `development-artifacts/` is format-checked any more — step files, worker reports, the decision packet, the three plan files — and the report rule "Prettier-clean, checked with `pnpm prettier --check`" is dropped. Gates KEPT or ADDED: `.prettierignore` is pinned to the owner's commit — `git diff --stat 49ef1bf7bc408da7d2676f859cf144a9b950d3c6 -- .prettierignore` prints nothing in every phase (`HEALTH`), and project DoD 10 adds blob `ba4ec991e38365369abc094c855dc3e83f22e1f7` (exactly five entries) — so still no step edits the file; no acceptance may run Prettier on a path under `development-artifacts/` (Prettier skips the file and exits 0 — a vacuous pass); fenced `text` evidence stays mandatory in the format-checked files under `probes/`; reports keep fenced verbatim output as an evidence convention, not an acceptance condition; new project DoD 13 and Phase 4 DoD 8 — the `.prettierignore` statements in `CLAUDE.md` "Documentation conventions" and in the `.prettierignore` row of `docs/user-manual/configuration.md` are corrected to the five-entry list, unconditionally. Brief sections changed: Repository facts (header, toolchain bullet, Prettier bullet, new `.prettierignore` bullet, M01 lesson 1); §0.3 applicability row 1; Owner decisions (sources, decision 9); Decision packet format; Acceptance-design rules; Worker report rules; Documentation rules for Phase 4; Constraints; Out of scope; project DoD (header `<pin>`, items 9 and 10, new item 13). Roadmap: strategy (`<pin>`), `HEALTH`, Phase 3 DoD 4, Phase 4 objective, scope, dependencies, step-shaping notes, DoD 6, new DoD 8. Ledger: Phase 4 note. | brief amended; no phase status changes; nothing was decomposed, so no step needs revision. The three plan files are Prettier-ignored themselves now: `pnpm format:check` and `pnpm prettier --check` say nothing about them                                                                              |
| 1 | 1.4 (pre-launch correction in flight, supervisor, 2026-09-24) | Spec defect found before launch: `jambolo/patch-steward-testbed-public` does not exist; org-public was transferred from `jambolo`, so that name REDIRECTS to org-public (`gh repo view` prints `isFork:false`, never "Could not resolve"), and the step's fork detection would misfire; a write to the fork name before the fork exists would land on org-public. Also the owner's allow rules cover only `git push git@github.com:<repo>.git…` and `gh api repos/<repo>/…`; the step's `gh repo fork`, `gh pr create/close`, and `git -C <clone> push origin` forms match none. Fix: FORK-OK guard (`full_name` + `fork` + parent) before any fork write; every write is a standalone `gh api repos/<repo>/…` command (fork via `POST …/forks` with `name`, refs via `git/refs`, the one non-workflow file via contents PUT, PR create/close via `pulls`, branch deletes via `git/refs … -X DELETE`); REST ref creation is safe because org-public `master` has no workflow file and 1.4 now runs before 1.2 deploys. Acceptance unchanged. Scheduling: 1.2 moved out of wave 1 to run lone in-tree after 1.1 and 1.4 merge, so `bash probes/smoke/tools/…` runs exactly in the allow-listed form with no `cd`. | step file corrected and committed before launch |
| 1 | none — supervisor process defect (first phase-1 supervisor run, 2026-09-24); recorded by the lead on the owner's instruction | The supervisor launched the 1.1 and 1.4 workers as BACKGROUND agents and then had no foreground work; a subagent's ended turn is its final report, so the harness forced its hand-back (`RESULT: failed`) while both workers still ran. Their completion notices reached the lead, not the supervisor, so nothing was verified, merged, or recorded. Unmerged results in worktrees based at `bcc52ae`: 1.1 `973fcd4`, status pass, scope `probes/README.md` + report; 1.4 `50fc483`, status fail on acceptance line 1 only — `gh` 2.93 `repo view --json parent` has no `nameWithOwner`, so the line prints `true null`; the fact holds (`gh api repos/jambolo/patch-steward-testbed-public` → `fork` true, parent `steady-orchard/patch-steward-testbed-public`). 1.4's GitHub work is complete and cleaned up (lead verified via `gh api`: fork exists; PR #1 closed; only `master` on org-public and the fork). The supervisor's unrecorded scheduling plan is now in Phase 1 notes (foreground-execution bullet). The lead sent the decomposer a revision note for 1.4 acceptance line 1 (and the same `.parent.nameWithOwner` form in 1.7). | recorded; rule "foreground only" added to Phase 1 notes; supervisor resumed |
| 1 | 1.4 — acceptance line 1 mis-specified, the work itself correct (decomposer revise operation, on the lead's revision note, owner's instruction, 2026-09-24) | Defect: 1.4 acceptance line 1 `gh repo view jambolo/patch-steward-testbed-public --json isFork,parent --jq '"\(.isFork) \(.parent.nameWithOwner)"'` → expected `true steady-orchard/patch-steward-testbed-public`; with `gh` 2.93.0 the `parent` object of `repo view --json parent` holds only `id`, `name`, `owner`, so the line prints `true null`. The fact holds (`gh api repos/jambolo/patch-steward-testbed-public` → `fork` true, parent `steady-orchard/patch-steward-testbed-public`; re-read by the decomposer). Same latent form in 1.7 action 5 (`parent: .parent.nameWithOwner`); 1.7 action 1 used the weaker `gh repo view … --json isFork`. Fix, 1.4 — corrected IN PLACE under the same id, because its work product (commit `50fc483`, report `patch-steward-m2-1.4-report.md`) is reused, not superseded: line 1 → `gh api repos/jambolo/patch-steward-testbed-public --jq '"\(.full_name) \(.fork) \(.parent.full_name)"'` → `jambolo/patch-steward-testbed-public true steady-orchard/patch-steward-testbed-public` (the FORK-OK form; `full_name` also rules out the name redirecting to org-public); new lines pin HEAD = `50fc4834f9c0817a4f2fdbca3280d63b7136610b`, scope against `bcc52ae` = the report alone, and exactly one canary PR (#1); context gains an EXECUTION STATE block and actions a guard 0 (no worker, no re-execution; actions 1–8 kept verbatim as the record of what ran); rollback covers a pre-merge rejection. Re-execution would not open a second PR (action 5's `--state all --head` selector finds closed #1) but would recreate and re-delete both canary branches and the canary file on two public repositories. Fix, 1.7: base assertion → FORK-OK line + `test -f development-artifacts/patch-steward-m2-1.4-report.md`; action 5 → `gh api repos/jambolo/patch-steward-testbed-public --jq '{full_name, fork, visibility, parent: .parent.full_name}'` (dry-run: `{"fork":true,"full_name":"jambolo/patch-steward-testbed-public","parent":"steady-orchard/patch-steward-testbed-public","visibility":"public"}`); context forbids `.parent.nameWithOwner`. Sweep, same cause class (pending step text that contradicts the lead's READ FIRST rule "literal args, no pipe, no shell variables" or matches no allow rule): 1.7 canary runs drop `mktemp` and `\| tee` and gain a HARD RULE; 1.5 and 1.6 tool commands and reads use literal repositories instead of `$T` (Bash-tool variables also do not persist across calls) and spell out exit 3 → `wait-run.sh` (1.6 PART B: waiting is not a re-send); 1.8 action 4 uses placeholder `<T>` with literal paths and no loop; 1.9 disables with `gh api repos/<owner>/<repo>/actions/workflows/<file>/disable -X PUT` (`gh workflow disable` matches no allow rule); rollbacks of 1.7, 1.8, 1.9 use the `gh api repos/… -X METHOD` form. Unchanged: every acceptance except 1.4's, all `depends_on`, all `files_in_scope`, all payloads. | step files 1.4, 1.5, 1.6, 1.7, 1.8, 1.9 revised (previous versions at `9b803a3`); 1.4 is VERIFY-ONLY against the existing commit `50fc483` (Steps status `pending (verify-only…)`, READ FIRST bullet in Phase 1 notes); decomposer dry-ran the corrected 1.4 block in the 1.4 worktree: every line matched; two emergent contracts added (fork identity check, GitHub write forms) |
| 1 | 1.7 attempt 1 (`30c2e0b`, reverted by `b81356a`) — amendment 4, brief defect, supervisor amendment note, 2026-09-24 | Defect: brief capability `ruleset-merge-queue` prescribed "a ruleset on `refs/heads/probe-canary-*` with a merge-queue rule"; the rulesets API rejects every `merge_queue` rule on a wildcard ref (HTTP 422 "Validation Failed", "Invalid rule 'merge_queue': Wildcard ref names are not supported when merge queue is enabled", identical on `org-public` and `personal`), so the capability was never tested there and the closed cell-value rule turned the 422 into two unsatisfiable `owner-action-pending` cells. Strengthening/neutral, no gate changed (project DoD 7 and "Rulesets target ONLY `refs/heads/probe-*`" still hold). Brief: "Test-bed inventory" new platform-fact bullet (422 verbatim, docs quote, `required_status_checks` wildcard canary accepted, ids 23963328/23963340); PA06 fixture constraint (exact base refs, e.g. `refs/heads/probe-pa06-base`); coverage note (merge queue on user-owned repos is now "expected", the corrected canary records the actual answer; PA06 still has no `personal` cells); "Fixture naming and isolation" (exact-ref rule for `merge_queue` rulesets; `probe-*` rule clarified to cover exact refs); "Test-bed record format" (`ruleset-merge-queue` = exactly `refs/heads/probe-canary-merge-queue`; new refusal definition: a 422 faulting the request's own parameters is a request defect, never `unavailable`/`plan-unavailable`/owner action); result-format `plan-unavailable` cause; "Owner actions and escalation". Roadmap: Phase 1 scope (canary target), Phase 2 scope and step-shaping (PA06 exact refs). | brief amended; pending step 1.7 (context, actions, payload `capabilities.sh`) embeds the stale wildcard target and the old refusal handling — decomposer revision required; completed steps 1.1, 1.2, 1.4, 1.5, 1.6 unaffected |
| 1 | 1.7 attempt 1 (`30c2e0b`, reverted by `b81356a`) — decomposer revise operation on the supervisor's revision note, after amendment 4 (`d603f8f`), 2026-09-24 | Defects: (1) payload `capabilities.sh` put the `merge_queue` ruleset on the wildcard `refs/heads/$prefix-*` (brief text before amendment 4), which GitHub rejects with HTTP 422 "Validation Failed" … "Wildcard ref names are not supported when merge queue is enabled"; the step's CELL VALUE RULE and its bug heuristic ("a refusal quotes a GitHub `message`; a bug does not") classified that 422 as a refusal → two `owner-action-pending` cells + OA1, OA2. (2) Acceptance A2 `grep -c 'owner-action-pending'` counted LINES; the mandated matrix puts every test-bed's cell of one capability in one row, so 2 pending cells vs 2 entries compared 1 with 2. Fix, 1.7 — revised IN PLACE under the same id (attempt 1 reverted; nothing reused; worker re-runs all three canaries): payload `capabilities.sh` merge-queue `include` → `["refs/heads/$prefix-merge-queue"]` + header comment (required-check canary unchanged on the accepted wildcard; `environment.sh` unchanged; offline: `bash -n`, both JSON bodies rendered with `prefix=probe-canary` and parsed); context: exact-ref targets, "Known" merge-queue sentence → expected-not-verified, attempt-1 LEADS block (marked never-results), new CLASSIFY rules R1 request defect (400; 422 naming something the script sent without saying the feature is unavailable for repo/owner type/plan; readback-missing with the text present — attempt-1 422 quoted as the example) / R2 refusal, CELL VALUE RULE rewritten on R1/R2 (bug heuristic removed; `personal` may be created or refused with unseen wording → rule unchanged), FIX BOUNDS (≤3 per script; exact-ref, `probe-canary-` names, no new kind of GitHub write; else STOP + cleanup + `status: fail`), R1 output never enters `probes/testbeds.md`, one OA entry per pending cell; action 4: classify after each call, after a fix re-run every line already run; acceptance: A2 → `grep -o 'owner-action-pending' $F \| wc -l \| tr -d ' '`, new presence line `grep -cF '"include": ["refs/heads/$prefix-merge-queue"]' probes/smoke/tools/capabilities.sh` → 1, new `grep -c 'Wildcard ref names' $F` → 0. Sweep: 1.9 A1 had the same line count (`cells=$(grep -c …)`) → occurrence count; 1.8 PER TEST-BED RULE treated every `environment.sh` exit 10 as a refusal → a 400/422 request defect is `status: fail`, not a refusal. 1.10 unchanged (its DoD 5 is a zero check; line and occurrence counts agree at 0). Dry-runs: revised A2 and 1.9 A1 on three rendered files (1 pending cell; 2 pending cells in one row + 2 entries; none) → consistent each; attempt-1 `testbeds.md` → A2 consistent, Wildcard count 2 (so the new line catches reuse); rows/A3/section lines unchanged and passing. No test-bed write made. | step files 1.7 (rewritten), 1.8, 1.9 and payload `patch-steward-m2-1.7-payload/capabilities.sh` revised (previous versions at `d603f8f`); Steps 1.7 → `pending`; Phase 1 notes judgment (a) and two emergent contracts updated |
| 1 | none failed — phase coverage gap (supervisor revision note before launching gate 1.10, 2026-09-24; decomposer revise operation) | Gap: roadmap Phase 1 DoD 7 ("On any test-bed where a scheduled run was already captured, the run id is recorded and the fixture is disabled") is judged against GitHub state at gate time, but 1.9 was the only capture point and the PA03 fixture fires after it. Supervisor read 2026-09-24T21:47:19Z: personal `probe-pa03-schedule` run 36062978420 and `probe-pa03-schedule-env` run 36063493816 (schedule, master, success), both workflows `active`, neither id in `probes/testbeds.md` → the gate's DoD 7 fails on personal today and on org-public at its first scheduled run. Decomposer re-read 21:53:52Z: personal also 36064228359 (21:53:07Z); org-public none (live since 21:32:25Z). Fix: new step 1.11 (mechanical; depends_on [1.9]; scope `probes/testbeds.md` + report): per org-public/personal file, capture the first completed scheduled run (earliest `createdAt`) and disable at once (`gh api repos/<owner>/<repo>/actions/workflows/<file>/disable -X PUT`, standalone literal); bounded wait ≤60 min (poll every 120 s, rate-limit guard) for uncaptured org-public files, else leave enabled and record `no scheduled run within 60 min; enabled`; SETTLE loop (≤3 calls, 7×60 s, stable totals, no open runs) so every completed scheduled id — the gate's `--limit 1` prints the latest — is recorded; `## Fixtures` gains per-file rows `scheduled-trigger fixture (<file>)` and rewritten `workflows` rows on org-public/personal; evidence T22–T25. Acceptance: head (Inventory/matrix/Owner actions) and T1–T21 byte-identical to `031d29a`, org-private rows unchanged; live per-file check (state, no open run, all completed ids in file, row text) → four `ok` lines; personal rows pin 36062978420 / 36063493816; the 1.10 DoD 7 form on personal and org-private; forbidden-word counts unchanged (1/1); format/lint/.prettierignore/secret lines. Matrix and `## Owner actions` (OA1) untouched. Gate 1.10: depends_on + 1.11 and base assertion + 1.11 report and a `scheduled-trigger fixture (probe-pa03-schedule.yml)` row; DoD items unchanged. Dry-runs: acceptance on a rendered post-step file (Prettier-formatted, LF and CRLF) with a state shim → all expected lines; negative variants (a recorded id removed; the unmodified 1.9 file) → `BAD`, `0 0`, `NOT-IN-FILE`; poll, settle, and initial-query commands run once live (reads only). No test-bed write made. | step 1.11 added (pending); step 1.10 revised in place (previous version at `29ae47f`); Phase 1 notes: dependency graph (wave 5 = 1.11, wave 6 = 1.10), new 1.11 bullet with supervisor routing for the two remaining DoD 7 races, PA03 emergent contract extended with the capture record |
| 1 | none failed — gate 1.10 held for the owner's OA1 decision (supervisor revision note, 2026-09-24; decomposer revise operation) | Gate 1.10 DoD 5 (`grep -c 'owner-action-pending' probes/testbeds.md ; grep -cE '^- status: pending$' probes/testbeds.md` → `0`; `0`) would print `1`; `1` at 075868c: matrix `ruleset-merge-queue` personal cell `owner-action-pending`, `### OA1 — enable exact-ref merge-queue ruleset on personal` with `- status: pending`. Owner answer (2026-09-24, relayed verbatim by the lead): "A — record the `personal` `ruleset-merge-queue` cell as `unavailable` (the platform refused; the 422 is the evidence)." Evidence T6 (HTTP 422 `Invalid rule 'merge_queue': ` on personal) vs T3 (byte-identical body created ruleset 23963955 on org-public). Fix: new step 1.12 (mechanical; depends_on [1.11]; scope `probes/testbeds.md` + report; no GitHub interaction): C1 personal cell → `unavailable` (Prettier re-pads the matrix); C2 the OA1 block → one prose line closing OA1 without an owner action and reserving the id. Representation: NOT `- status: declined` as the note suggested — roadmap Phase 1 escalation point "a declined action becomes `owner-declined`" and the brief's declined consequence (`undetermined` / `blocked`) make `declined` the option the owner rejected; `done` needs verifying output; no closed-status value fits "no action exists"; precedent org-private 403 → `unavailable` without entry. No brief amendment. Acceptance: section list; Inventory and `## Fixtures`→EOF byte-identical to 075868c; matrix identical modulo padding except the one cell; exact new row; exact `## Owner actions` section; occurrence count of `owner-action-pending` 0, `^- status: ` 0, `^### OA` 0; gate 1.10 DoD 5 awk → `rows=9`, exit 0; 5 available rows; `git diff --name-only 075868c -- probes` → `probes/testbeds.md`; format:check, lint, `.prettierignore`, secret grep. Base: blob `bee2655…` of `probes/testbeds.md`. Gate 1.10: depends_on + 1.12, base assertion + 1.12 report + `The id OA1 is not reused.`; DoD items unchanged. Dry-run in a scratch worktree at 075868c: all lines as expected. | step 1.12 added (pending); step 1.10 revised in place (previous version at 075868c); Phase 1 notes: waves 6 (1.12) and 7 (1.10), new 1.12 bullet, judgment (a) marked resolved, `probes/testbeds.md` contract (OA1 prose line; next id OA2) |
| 2 | 2.6 attempt 1 (`1ef339a`, unmerged), 2.7 attempt 1 (`50e9dbc`, unmerged), 2.8 (merged `e2ccf32`, NOT done) — decomposer revise operation on the supervisor's revision notes 1–3, 2026-09-25 | (1) 2.6: the control workflow enqueued with the job GITHUB_TOKEN (default `token=github`; action 10 fell back to the App only on error); events caused by that token start no workflow runs, so no merge_group run ever came (`actions/runs?event=merge_group` 0; timeline actor github-actions[bot]; removal reasons `checks_timed_out`, PR 15 `invalid_merge_commit`) and the decision rule labelled a driver artifact `blocked`; the worker also flipped org-public `allow_auto_merge` outside its step. (2) 2.7: App token minted without `contents: write` → GraphQL `markPullRequestReadyForReview` "Resource not accessible by integration"; the worker made the draft mutations non-fatal (would have recorded a token-scope artifact as a platform refusal); then a local permission denial on closing issue #21 (owner's decision, relayed by the supervisor). (3) 2.8: the shared sdk-setup block passed `useLoggedInUser: false` → SDK runtime started with `--no-auto-login` ignores COPILOT_GITHUB_TOKEN → every SDK call unauthenticated; the worker recorded that as findings (PA08.3 omit-sdk, PA08.4 SDK rows, PA08.6 getQuota). Fix (1): new step 2.24 (supersedes 2.6): enqueue/dequeue only with `token=app`; heads branched from probe-pa06-base (REST ref at the base SHA + deploy.sh) so each PR diff is one entry file; new steward payload (`record` job for any sender without token → PA06.2; `write` job only for sender jambolo — brief safety rules) plus a DRIVER RULE (the worker writes the same App check via the control workflow when `write` is skipped); PA06.3 accepts steward- or driver-written checks; S4 retry once; attempt-1 evidence section mandatory; `allow_auto_merge` left true as recorded residue (no allow-listed form: `gh api repos/<repo>/` → 404) — owner decision. Fix (2): new step 2.25 (supersedes 2.7): writer payload with job `contents: write` and mint `permission-contents: write`; refused draft mutations logged `write-refused=` (PA07.1 → `undetermined`/`blocked` unless refuted); attempt-1 residue #2, #3, #4, #20, #21 closed first, STOP on any local denial; launch gated on the owner's answer. 2.17, 2.18 → depend on 2.25, same rule and log line, base asserts the contents mint. Fix (3): NOT the note's `gitHubToken: token` — SDK source, GitHub's server-to-server article, and an offline dummy-token run show that option is the user-token path and that dropping `useLoggedInUser: false` makes the runtime take COPILOT_GITHUB_TOKEN "server-to-server"; new step 2.26 (depends_on 2.8; owns infer workflow, README, results/personal.md; <=5 prompts, plan 3): payload infer workflow (fix + `auth_status=` log + SDK pinned 1.0.14), zero-cost GATE on detect's auth status before any send, re-runs detect/sdk/omit-sdk, rewrites the SDK-derived rows with `step 2.26` in Method, adds `### E2 — every Copilot request sent by step 2.26`, deletes 2.8's duplicate request lines (R4/R5/R6), marks R1/R2/R4/R6 superseded, 6-column Measurements, README PA08.5 kind. 2.21 payload: same sdk-setup block, pin, auth_status log; 2.21 depends on 2.26, base asserts E2; 2.19, 2.20 depend on 2.26 (base asserts the fixed workflow and `- step: 2.8, 2.26`; SDK LEG VALIDITY rule; request lines only in E1); 2.22 step line; gate 2.23 depends on 2.24–2.26 instead of 2.6, 2.7. Budget: 1 + 4 + 5 + 6 + 6 = 22 <= 24. No brief amendment (the brief's inference "never through the `gitHubToken` option" holds; the safety rules are kept, not relaxed). Dry-runs: 2.26 acceptance on rendered post-step samples (good LF/CRLF → all expected; duplicate request line → `requests-ok` missing; stale prose → `4 6`; unmodified 2.8 file → failures), steward guard/secret lines on the payload (`1 0`; attempt-1 steward `0`), 2.25 permission lines (`1 1`; attempt-1 writer `0 0`), 2.19 request check (good → ok; duplicate in a run block → missing). All new/changed payloads: actionlint, bash -n of every `run:` block, node --check of the embedded SDK scripts (4 identical copies + cap), Prettier (repo config). No test-bed write made. | steps 2.24, 2.25, 2.26 added (pending); 2.6, 2.7 superseded; 2.8 done upon 2.26's verified merge; 2.17–2.23 and payload `patch-steward-m2-2.21-payload/workflows/probe-pa08-cap.yml` revised in place (previous versions at 478e38a); new payloads 2.24, 2.25, 2.26; Phase 2 notes: revision bullet (graph, launch gate for 2.25, SDK verification, quota lead, allow_auto_merge residue), budget, cap launch gate, 2.6 routing note, dependency graph |
| 2 | 2.21 — accepted with deviations; 2.22 corrected in flight (supervisor, option b, 2026-09-25) | (1) 2.21's PA08.5 rule (and 2.22's) named the event `session_limits_exhausted.requested`; the runtime (CLI 1.0.88 / SDK 1.0.14) never emitted it. It emitted `model.response_limits_status` with `{"aiCreditsUsed":31.198948,"aiCreditsRemaining":0,"maxAiCredits":30,"isLimitsExhausted":true,...},"state":"blocked","message":"Session limit reached. Increase or unset the session limit to continue."` (supervisor re-fetch, run 36091504726 cap-02), and later sends returned empty replies with no billing. The worker confirmed PA08.5 on substance and recorded the mismatch as a deviation; supervisor judgment: supported (soft cap checked after the call returns; overshoot 1.188–1.709 AI credits, less than one response; next call blocked). Because the payload waits for the wrong event name, every cap session ends `stop=max-sends limit_event=none` after 17–21 zero-cost blocked sends (counted in `cap sends`; chain bound 405 still holds for 10 sessions = 400 + probe 0). (2) HARD BOUND breach: consecutive sessions must start >= 60 s apart; cap-01 was dispatched 14 s after the probe run completed, cap-03 18 s after cap-02 (worker deviation); no usage consequence; irreversible. Correction: 2.22's PA08.5 rule accepts `model.response_limits_status` with `"isLimitsExhausted":true` and `"state":"blocked"` and states that `limit_event=none`/`stop=max-sends` then means "continue"; 2.22's time bound now says to measure from the previous run's completion and sleep 70 s before every dispatch. Cap workflow unchanged (2.22 must not edit it). | 2.21 merged (805c56e) and marked done; step file 2.22 corrected and committed before launch |
| 2 | 2.24 — two worker refusals (supervisor, 2026-09-25) | Attempt 1 and retry 1 (sonnet worker) each ran only the base assertion and committed a report-only `status: fail`, judging the procedure too long for their turn budget; no test-bed write. Both commits discarded. Retry 2 launched with the Agent tool's `model: opus` override (escalation to the expensive model after repeated failure; same packet) and passed: PA06.1–PA06.5 confirmed with App-token enqueues (6 merge_group relay runs, sender `patch-steward-testbed[bot]`; the steward `write` job skipped every time because of the jambolo-only guard, so the DRIVER RULE wrote every check through the control workflow). Worker deviation: action 3's `cp -r` overwrote `probes/pa06-merge-queue-relay/results/org-private.md` (2.10's file) in the worktree; restored with `git checkout --` before the commit (supervisor scope diff: clean). org-public `allow_auto_merge` still true (2.6 residue; no allow-listed form reaches `PATCH repos/<repo>`). Next decomposition: a payload `cp -r` of a whole probe directory must not overlap files owned by other steps. | 2.24 merged (d24fef3) and marked done |
| 2 | 2.25 — accepted; supervisor integration correction (2026-09-24 resume run) | Worker commit e401949 passed every acceptance line; supervisor re-fetch of the listener list after 04:49Z shows 13 app-pass runs (issues opened/edited/labeled/unlabeled/closed/reopened/closed; issue_comment created/edited/deleted; pull_request_target ready_for_review/edited/labeled 27), each within 1–4 s of its `write=` line, and none for issue 30 / PR 28 (github pass run 36096219776). The PA07.3 Measurements rows listed 12 latency samples; the 13 matched pairs give 1,1,1,2,2,2,2,2,2,3,3,3,4 (one `2` missing). Corrected in a supervisor commit: Value list and Samples 12 → 13 (min 1, median 2, max 4 unchanged). No step owns a later edit of this file; 2.17/2.18 only read it as a model. | 2.25 marked done; results/org-public.md corrected |
| 4–6 | none — amendment 5: owner's answers to the Phase 3 decision packet (`development-artifacts/patch-steward-m2-decision-packet.md`, source `7fc24f5`), "all recommended" plus the Q3 bound clarification, relayed by the lead 2026-09-25 | Owner gate after Phase 3 executed (roadmap Phase 3 owner gate). Recorded, owner-approved (the answers are the owner's; the 6-hour bound relaxes the brief's 60-minute scheduled-trigger bound for the Q3 re-probe only, by the owner's explicit clarification): Q1 A accepted limitation; Q2 A design change (clarification); Q3 A re-probe PA03.4/PA03.5 on org-private once, schedule files enabled until each file's first scheduled run or 6 hours, then disabled; Q4 A re-probe PA04.1 with wirings W1 (callee `on.workflow_call.secrets` + explicit mapping) and W2 (`secrets: inherit`), then follow-up owner decision F1 (packet Q4 B or C); Q5 A, Q6 A (keep `always()`), Q8 A, Q9 A design changes; Q7 C accepted limitation; C1 A (both marker forms, §12 "Spending" included). Planner readings, stated in the brief for the caller to overturn: Q4's re-probe covers all three test-beds with a PA04.1 cell (option text "re-probe PA04.1"; the recommendation's reasoning mentioned the public test-beds); PA04.1 rows keep `refuted`/`none` and gain the re-probe evidence ids (no re-judging); a Q3 re-probe that leaves a cell unconfirmed raises F2 (packet Q3 options B/C). Brief: "Post-probe owner decisions" filled (Decisions table with exact disposition strings; roll-up rule; governing locations and must-state content per decision; F1-reserved text; Phase 5 content checks K1–K27 with helpers `J`/`N` and extracts, all dry-run at `3bb74ba`; F1/F2 content); new "Re-probe rules (Phase 4)" and "Follow-up decision packet format"; "Running, waiting, and budgets" 6-hour exception; C1 marker paragraph and §12 row; §15 statement (only "Capability probing at installation" is reworded); Documentation rules renamed "for Phases 5 and 6" with a ripple rule; Constraints, Assumptions, Out of scope, owner decisions 7 and 9, §0.3 table, findings/packet-format phase references; project DoD 3, 12 (org-private minutes), new 14. Roadmap: strategy; `HEALTH` (Phases 1–4; Phases 5–6 without the docs paths; `<phase-N base>`); Phase 3 owner gate marked done; former Phase 4 split into Phase 4 (re-probes, steady state, packet 2; owner gate F1/F2 after it), Phase 5 (decided document changes; does not wait for F1/F2), Phase 6 (F1/F2 changes, verification; blocked until the F1/F2 amendment). Ledger: Phases rows 4–6. | brief and roadmap amended; Phase 4 decomposable now; Phase 5 after Phase 4; Phase 6 blocked until a planner amendment records F1 (and F2 if raised). No step file existed for the old Phase 4, so no decomposer revision is needed |
| 6 | none — amendment 6: owner's answer to follow-up decision packet 2 (`development-artifacts/patch-steward-m2-decision-packet-2.md`, source `db39f19`), "F1: B"; F2 not raised; relayed by the lead 2026-09-25 | Owner gate after Phase 4 executed (roadmap Phase 4 owner gate). Recorded, owner-approved (the answer is the owner's): F1 B — design change: the wrapper templates pass the App and provider secrets to the pinned reusable workflow by an explicit per-name `secrets:` mapping (the reusable workflow declares each under `on.workflow_call.secrets`; the called job declares the Environment and receives the caller's Environment value); the design names the explicit mapping, not `secrets: inherit` (silently empty in all 3 cross-owner legs; organization-to-organization untested). F2 not raised (Q3 re-probe: PA03.4/PA03.5 org-private `confirmed` / `none`). Brief: "Post-probe owner decisions" source paragraph (packet 2, amendment 6); Decisions rows Q3 (`none`, done), Q4 and F1 (`design-change: docs/architecture.md §6.4`), F2 (`not raised`); roll-up bullet (PA03 `none`; PA04 `design-change: docs/architecture.md §6.4`); F1/F2 status bullet; F1-reserved note (F1 B changes only §6.4 first paragraph, §7 rows "Reusable workflows (`workflow_call`)" and "Environments with deployment-branch rules", SP02 steps 1–3); K27 (`u = 0`, count 4); "F1 and F2 content (Phase 6)" rewritten (owner answer verbatim, disposition, governing locations with anchors, must-state (a)–(g) incl. relay wrapper credential-free and issues/maintenance calls, evidence bounds, ripple reading, plan-level note: W1 org-to-org untested — lead, not design docs); new "Phase 6 content checks" K28–K36 (extracts XP02s3, X64t; OLD values dry-run at `78f215e`: K28/K29/K31–K34 = 0, K30 = 1, K35 holds, K36 currently 0/0/27); §15 statement; "Follow-up decision packet format" answered; ripple rule; Assumptions; project DoD 3. Roadmap: strategy; Phase 4 owner gate DONE; Phase 6 rewritten exact for F1 B (objective, scope with exclusions, depends-on satisfied, step-shaping, DoD 1–8 incl. new DoD 7 untouched/findings-rows scope, risks). Phase 5 unchanged. Ledger: Phases row 6. | brief and roadmap amended; Phase 6 unblocked (decomposable after Phase 5); no step file exists for Phase 5 or 6, so no decomposer revision is needed |
| 5–6 | none — amendment 7: owner's answer "Extend the Q1 accepted limitation" to the gap the decomposer found while decomposing Phase 5 (ledger Phase 5 notes "LEAD ITEM"), relayed by the lead 2026-09-25 | Gap: Q1 A covered only enforcement and the merge-queue relay; the rulesets refusal on a Free-plan organization's private repository (HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature.", `probes/testbeds.md` T8/T9) also removes the evidence-store push restriction (architecture §11, SP02 step 4) and required code-owner review of policy and wrapper paths (SP01 step 2, SP02 step 8, §7 row "Rulesets"), on which Q5 A's "wrapper edits stay on the CODEOWNERS-reviewed path" relies. Recorded, owner-approved (scope/DoD change carried by the owner's answer): Q1E accepted limitation — on a repository whose plan and visibility offer no rulesets both controls are unavailable; `steward init` and the SP02 preconditions (steps 4 and 8) detect and report it; lands in Phase 6; Phase 5 unchanged. Q1 disposition strings and the PA01/PA06 roll-ups unchanged; no findings cell (neither control was probed). Brief: "Post-probe owner decisions" source paragraph; Decisions row Q1E; roll-up bullet (no change); Q5 must-state (d) pointer; §15 statement (Q1E adds/rewords none); new "Q1E content (Phase 6)" (gap, owner answer verbatim, evidence, governing locations, restatements to change incl. §13 width rule 473 for K35, not-changed list, must-state (a)–(g), evidence bounds: no claim about classic branch protection, CODEOWNERS files or review requests, no claim a push-restriction/code-owner-review ruleset was attempted or verified, no invented remedy; Phase 5 cross-check); "Phase 6 content checks" new extracts X11, X13p, X13f, XP01, XP02s4, XP02s7, XP02s8, XP18, XW12, XI4, XI8, XCo, XCe and K37–K52 (OLD at `<start>` = simulated Phase 5 end state: K44, K50 = 1, rest 0; dry-run at 83e8982 by applying every phase5 edits-*.txt to file copies); judgment paragraph; Documentation rules ripple bullet; project DoD 3 and 5. Roadmap: strategy; Phase 6 title, objective, scope (Q1E locations; findings.md untouched by Q1E), depends-on, step-shaping (whitepaper and user-manual steps now mandatory), DoD 2 (K37–K52) and 6 (Q1E judgment), risks. Ledger: Phases rows 5 and 6. Phase 5 cross-check (edits-*.txt at 83e8982): blocks A03 (§6.4) and P02 (SP02 step 7) state "wrapper edits stay on the CODEOWNERS-reviewed path" unqualified — false where no rulesets are offered — routed to Phase 6 (Q1E item (e)), per the owner's instruction; A09, P03, U01 incomplete but true (Phase 6 extends); A11, A13, P06 unaffected. No Phase 5 step needs a decomposer revision. | brief and roadmap amended; Phase 5 unchanged and runs as decomposed; Phase 6 (not yet decomposed) carries F1 B and Q1E; no step file needs revision |
| 6 | none — amendment 8: decomposer amendment note during Phase 6 decomposition (no Phase 6 step file exists), 2026-09-25 | Defect: the brief pinned §13 row "Compromised steward release" byte-identical (K35, X13c; F1-reserved bullet "stays unchanged in Phase 6 as well"; roadmap Phase 6 "NOT in scope"), but its clause "review updates through protected policy/wrapper paths" restates required code-owner review of wrapper/policy paths (§7 "Rulesets", SP02 step 8), which Q1E (owner, amendment 7: "both controls are unavailable as well") makes unavailable without rulesets; must-state (g) could not be met. Root cause: the pin was set for F1 (option C would have changed the row) and kept by amendment 7 for Prettier padding; the amendment 7 restatement reading missed the phrase. Classified strengthening (applies the owner's Q1E decision to one more restatement per existing must-state (g); every lost pin is replaced by an equal or stricter check); option A of the note applied. Brief: F1-reserved bullet (the row changes only by the Q1E qualification); F1 governing-locations sentence; F1 ripple (records §1.2 decision 14 as not contradicted by F1 B — the decomposer's secondary item, confirmed); Q1E restatements (row added, suggested qualification, other two clauses byte-for-byte); width rule corrected from "at most 473 characters" to cell text at most 471 (473 is the padded column width; a 472- or 473-character cell would have re-padded the table) with a measuring command; must-state literal range K37–K55; Phase 6 checks: new extract X13s (canary row "Stale success after a linked issue or policy change", widest Control cell), K35 pins X13s, X64t, XCL (X13c removed; K25 void for X13c), new K53 grows X13c `visibility`, K54/K55 present X13c for the two unchanged clauses; OLD at `<start>` (dry-run at `84f71e0`): K53 = 0, K54 = K55 = 1; K35 holds; project DoD 5 checks K37–K55. Roadmap Phase 6: Scope (row clause in, width 471, NOT-in-scope list updated incl. decision 14), DoD 2 (K37–K55; K25 void for X13c; X13s), Risks (width 471/X13s; K54–K55). | brief amended; no step file exists for Phase 6, so no decomposer revision is needed; the decomposer decomposes Phase 6 from the amended text |
| 7 | none — amendment 9: owner's order of 2026-09-25 (scope extension, owner-approved: "Track all decisions made so far as persistent ADRs in `docs/adr`"; design decisions only; "record only" precedence; "remove the decisions from architecture.md so that duplicates do not have to be maintained. Update citations referring to the moved decisions."; payload citations in probe READMEs "Update the citations to point to those ADRs."), relayed by the lead after Phases 1–6 and the milestone evaluation | New Phase 7; Phases 1–6 stay done. Brief: Goal (Phase 7 paragraph); new section "Phase 7 — Architecture decision records" (owner order as relayed; open questions P7-Q1–P7-Q5; ADR set: 33 fixed ids, file names, titles, dates, sources — ADR-0001–0016 = §1.2 decisions 1–16; 0017 PD04, 0018 PD05, 0019–0022 M01 owner decisions (2026-09-17: plan decisions before M01 rows); 0023–0024 owner decisions 6–7 (2026-09-18); 0025 Q1+Q1E, 0026 Q2, 0027 Q5, 0028 Q6, 0029 Q7, 0030 Q8, 0031 Q9, 0032 C1, 0033 F1 (2026-09-25, packet order, F1 last); MADR template; content rules (sources, links only to surviving files and develop-reachable commits, verbatim decision-outcome text, evidence bounds, C1 marker, identifier rules); index; citation inventory at 5faf6f4 (sweep 37 lines) and rewrite rules; §1.2 pointer; CLAUDE.md/README.md changes; development-artifacts citation rule; checks K56–K73; milestone re-verification table: kept checks, superseded ones (k6 PROBES6, FROZEN6; project-dod P5, P10 plan-commit and optional fixtures diff, P11 optional; milestone-verify R10) and replacements); Constraints (fixtures/README.md exception per P7-Q4; Phase 7 file list; plan editable by Phase 7 only; deferred.md citations); Assumptions; Out of scope; project DoD 10 (plan-commit rule, Phase 7 `<start>` diff), 11 (P7-Q1 exception), new 15. Roadmap: strategy; HEALTH Phase 7 form; Phase 7 section (objective, scope, depends-on incl. the answers amendment, step-shaping, DoD 1–6, risks). Ledger: current-phase 7, Phases row 7. Dry-runs at 5faf6f4: sweep 37 lines; payload citation grep 5 lines; K59/K60 extraction; Phase 7 `<start>` diff and plan-commit check print nothing; k6 DOD1 brief guards unchanged (0 open markers in "Post-probe owner decisions", 13 Decisions rows). Open, NOT decided (owner order 2 "ask me"): P7-Q1 deferred alternatives in ADRs; P7-Q2 considered options where none was recorded; P7-Q3 target of the payload citations; P7-Q4 fixtures/README.md citation vs the fixtures freeze; P7-Q5 citations in the surviving m2 brief/ledger. | brief and roadmap amended; Phase 7 added `pending`, blocked until a planner amendment records the answers to P7-Q1–P7-Q5 (`RESULT: needs-human`); no step file exists for Phase 7, so no decomposer revision is needed |
| 7 | none — amendment 10: owner input of 2026-09-25 relayed by the lead — answers to P7-Q1–P7-Q5, a new persistence rule (owner, verbatim: "Eventually all planning and implementation documents will be removed. Milestone briefs and ledgers are saved only until a project post mortem is performed. So, persistent documents such as design documents, user manuals, and ADRs should not cite the planning and implementation documents."), the `probes/` exception (owner, verbatim: "`probes/` is an exception for now. Use it for implementation now, but repurpose it as a persistent regression suite later in the final steps of the project implementation."), and the reaffirmed earlier instruction "ensure that decisions in the planning document are not removed" | Scope/DoD change carried by the owner's answers (owner-approved). Brief: Goal; Phase 7 intro (decomposable); Owner order 1, 4 (amendment 9's extension to plan §9 PD04/PD05 overturned: §9 and PDxx citations stay; plan decision-number citations still rewritten), 5, 6 rewritten, new 8 (persistence rule: persistent vs planning lists, direction, consequences, sweep fixes, false positives, non-citations "milestone"), 9 (`probes/` exception), 10; "Phase 7 open questions" → "Phase 7 owner answers" (Q1 A, Q2 A revised, Q3 A, Q4 A, Q5 A); ADR set: "Read from" (planning, never written) split from an exact persistent "Source line" column (S-ARCH = architecture §1.2 row at commit `0da65aa`; ADR-0017/0018 "none outside this record"; ADR-0019–0033 persistent locations); D1 (no quoting of deferred earlier text); ADR format (Source exact; no packet letters; "No other option was recorded."); ADR content rules (link/cite persistent + probes only; self-contained; identifier ban; §1.2 only in Source; L17/L18 replace "chosen in M08"/"from M13" with the milestone content; P7-Q2 A revised; P7-Q1 A one-liner rule with expected DF mapping 0002→DF07, 0004→DF02, 0005→DF05, 0010→DF03); README index (no mapping line); Citation moves (37-line sweep split 26 REWRITE / 11 STAY; PD rewrite row removed; whitepaper 760, fixtures 3 and 12 rows; plan §9 unchanged; CLAUDE.md deferred-features bullet literal); development-artifacts citations (P7-Q3 A exact); checks K57, K60, K64–K67, K69, K71–K73 revised, new K74 (PAT over PERSIST; dry-run at 9bcc195: 5 lines = 2 false positives + whitepaper 760 + fixtures 3, 12), K75 (fixtures/whitepaper literals), K76 (deferred one-liners; CLAUDE bullet), K77 (plan §9 byte-identical; PD counts PD01 4, PD02 3, PD03 9, PD04 6, PD05 4, PD06 3, PD07 4, PD08 11); milestone re-verification exact (k6 findings FAIL 1 PROBES6; all FAIL 2 PROBES6+FROZEN6; project-dod FAIL 4 = P5, P10 x2, P11 with P5′, P10′a, P10′b, P11′; milestone-verify FAIL 1 = R10 with R10′; S1–S15 found); Constraints; Assumptions; Out of scope; project DoD 10, 11, 15. Roadmap: strategy; HEALTH Phase 7 note; Phase 7 objective, scope, depends-on (decomposable), step-shaping, DoD 1–6, risks. Ledger: current-phase, Phases row 7. Verified: `0da65aa` is an ancestor of `develop` and no §1.2 row changed after it; docs/fixtures/probes/README/CLAUDE unchanged 5faf6f4..9bcc195; copilot_request_utc sum 245. Not ordered, not applied: adding the persistence rule to CLAUDE.md. | brief and roadmap amended; Phase 7 unblocked (decomposable); no step file exists for Phase 7, so no decomposer revision is needed |
| 7 | none — amendment 11: owner answer of 2026-09-25 relayed by the lead: "add the persistence rule to `CLAUDE.md`" "Documentation conventions" in Phase 7, as one bullet (amendment 10 had left it unapplied as not ordered) | Scope addition ordered by the owner (owner-approved). Brief: Phase 7 intro; owner order 8 (new "Intentional exception" sub-bullet: the persistence bullet names the planning paths; K74 and NOCITE′ exclude it like the two false positives); new owner order 11 (content of the bullet; persistent set stated as everything under `docs/` except `docs/project-development-plan.md` and `docs/astra-plan.md`, plus `README.md`, `CLAUDE.md`, `fixtures/` — equal to the amendment-10 list, chosen so the bullet names no `docs/deferred.md` and adds no `deferred` (NODEFER, P11′)); Citation moves (bullet placement = last bullet of "Documentation conventions"; exact literal `LP` in a text block, with its pattern verification; LP excepted from "no new text names a planning document"; NOCITE exception); checks K74 (three lines; LP line with the three planning path names removed no longer matches PAT) and new K78 (LP exactly once, last bullet before `## Invariants`, one `- Persistence:` line, no other persistent file contains "planning and implementation documents"); milestone re-verification (`k6-checks.sh summaries` now FAIL 1 = `NOCITE FAIL CLAUDE.md new=1 old=0` with replacement NOCITE′; `all` FAIL 3 = NOCITE + PROBES6 + FROZEN6; P5′ adds NOCITE′ and K78); Constraints; Assumptions; Out of scope (only this bullet states the rule); project DoD 15. Roadmap: strategy; Phase 7 objective, scope, depends-on, step-shaping (K78; LP byte-exact), DoD 1–2, risks. Ledger: current-phase, Phases row 7. Verified at `3823259`: LP matches PAT only on `project-development-plan`, `astra-plan`, `development-artifacts`; NOCITE count 1, NODEFER 0, PI2 terms 0, K67 sweep 0, `deferred\.md` 0, ASCII only; Prettier `--check` passes on a `CLAUDE.md` copy with LP appended; K74 and K78 dry-run on that copy as specified; NOCITE count of `CLAUDE.md` at `<start>` is 0. | brief and roadmap amended; Phase 7 still decomposable; no step file exists for Phase 7, so no decomposer revision is needed |
| 7 | none executed — amendment 12: decomposer amendment note during the Phase 7 revise operation (steps 7.1–7.4 at `e60adde`, none run), carrying the owner's answer relayed by the lead on 2026-09-25: "restate each clause in the governing documents before §1.2 is removed" (scope/DoD change, owner-approved) | Defect: the brief kept the coverage audit as information for the lead ("Coverage audit for the lead (listed in the gate report, not edited)") and Phase 7 minimal, so removing §1.2 left six Choice clauses governed nowhere (C4.1 "Not a submission type.", C5.2 "installation tokens are minted inside Actions", C5.3 "No webhook server.", C13.3 "the Actions run list serves only the caps", C14.3 "the trusted wrapper workflow decides which secrets enter which job", C16.3 "it never changes an outcome"). Brief: Goal; Phase 7 intro; new owner order 12; new section "Restatements of §1.2 clauses" (clause→RS table; RS1–RS10 exact OLD/NEW/K79 literals: RS1 §1.1 "Submission types", RS2 §1.1 "Hosting", RS3 §6.4 first paragraph, RS4 §7 "GitHub App", RS5 §8 "Inference", RS6 §12 "Spending", RS7 SP02 step 3, RS8 SP08 step 4, RS9 SP19 step 1, RS10 SP19 step 10; placement RS1–RS6 with the §1.2 removal, RS7–RS10 in the processes step; no processes restatement for C5.2/C5.3; table widths kept; content bans K74/NODEFER/PI2/K24/K67; pins untouched; summaries unchanged, contradiction check recorded); ADR content rules Consequences (ADR-0004, 0005, 0013, 0014, 0016 name their RS locations); Citation moves (§1.1 changes only by RS1/RS2; processes line 8 plus RS7–RS10; RS cite no ADR); K71 RS exception; new K79 (each K79 literal exactly once in the normalized file and inside its owning section; coverage-audit.sh last line `COVERAGE-AUDIT clauses=39 restated=39 not-restated=0 anchors-missing=0`); "Not mechanical" (RS faithfulness; audit is a gate check with zero unrestated clauses); milestone re-verification (R10 no longer superseded, R10′ withdrawn; `milestone-verify.sh` → every item ok, `RIPPLE-RECORD items=17 anchors-found=17`, `MILESTONE-VERIFY OK`; P5′ K56–K79; other expectations unchanged); Constraints (Phase 7 file list); Assumptions; Out of scope; project DoD 15. Roadmap: strategy; Phase 7 objective, scope (RS locations in; NOT-in-scope narrowed), depends-on, step-shaping, DoD 1 (K56–K79, K79), DoD 2 (`MILESTONE-VERIFY OK`), DoD 6, risks. Ledger: Plan current-phase note; Phases row 7. Verified (planner, at `e60adde`): every RS OLD occurs exactly once (`grep -cF` 1; whole-line OLDs `grep -cxF` 1); simulation of RS1–RS10 alone on the `e60adde` architecture/processes: each K79 literal occurs exactly once in the normalized file, §1.1 row widths unchanged, `prettier --config .prettierrc.json --check` passes on both files; `milestone-verify.sh` R10 targets `docs/architecture.md` with the RS5 anchor. Decomposer dry-run (all Phase 7 payloads + RS1–RS10): `MILESTONE-VERIFY OK`, k6 expectations unchanged, `k7-checks.sh all` fails only K71 on architecture/processes (the rule this amendment changes). | brief amended; completed steps none affected (no Phase 7 step has run); pending steps 7.1, 7.2, 7.4 and checkers k7-checks.sh, gate7.sh, coverage-audit.sh go through the decomposer's revision; 7.3 unaffected |
| 7 | none executed — 7.1, 7.2, 7.4 revised before launch (decomposer revise operation on the lead's revision note of 2026-09-25 carrying the owner's answer, after amendment 12 at `6022bf4`) | Coverage audit G11 of the first decomposition (`e60adde`) listed six §1.2 Choice clauses no governing section restates (C4.1, C5.2, C5.3, C13.3, C14.3, C16.3); owner: "restate each clause in the governing documents before §1.2 is removed". The decomposer sent the amendment note (RS1–RS10 texts, locations, K79, K71 exception, R10 un-superseded; dry-run at `e60adde`); the planner pinned them (amendment 12). Fix: edits-architecture.txt + A73–A78 (RS1 §1.1 "Submission types", RS2 §1.1 "Hosting", RS3 §6.4 first paragraph, RS4 §7 "GitHub App", RS5 §8 "Inference", RS6 §12 "Spending"; table rows as whole pre-padded rows, widths unchanged); edits-processes.txt + P72–P75 (RS7 SP02 step 3, RS8 SP08 step 4, RS9 SP19 step 1 as one line per the brief, RS10 SP19 step 10); ADR payloads 0004, 0005, 0013, 0014, 0016 Consequences name the RS locations; k7-checks.sh K79 (RS literals read from the brief; arch = RS1–RS6 + coverage audit 39/39, summaries = RS7–RS10) and K71 RS exception (architecture outside §1.2, processes); coverage-audit.sh six rows → RS anchors, C14.2 anchor without its period, exit 1 on any unrestated clause; gate7.sh G1 K56–K79, G7 `MILESTONE-VERIFY OK` (R10 found, RIPPLE 17/17), G11 exact 39/39/0/0. Step files: 7.1 (objective, context, apply 8, acceptance + `milestone-verify.sh` → `MILESTONE-VERIFY OK`, re-apply already=8, supervisor re-runs 1–8), 7.2 (objective, context, apply/re-apply 5), 7.4 (G7/G11 expectations, unrestated-row copy rule, grep). Unchanged: 7.3, depends_on, files_in_scope, BASE7. Re-validated at a scratch commit on 6022bf4 (CRLF checkouts): 7.1/7.2/7.3 literal actions and acceptance as written; `gate7.sh local` GATE7-LOCAL OK; `gate7.sh dod` LIVE GATE7-DOD OK (short-path worktree; a long-path worktree fails vitest startup, Phase 7 notes); planted RS defects each FAIL (K71/K79/audit/R10). | step files 7.1, 7.2, 7.4, payloads, and checkers revised in place (previous versions at `e60adde`); Steps 7.1, 7.2, 7.4 `pending (revised in place …)`; Phase 7 notes: revision and path-length bullets, Checkers, Coverage audit (39/39), Emergent contracts |
| 7 | none failed — amendment 13: decomposer amendment note from the Phase 7 revise operation after completion (steps 7.1–7.4 done, gate 7.4 PASS), carrying the owner's answer "Fix, then merge" (2026-09-25, relayed by the lead after the milestone evaluation passed) to three minor defects from the supervisor's Phase 7 report and the lead's review (owner-approved scope addition; strengthens gates, weakens none) | Defects: (a) brief D1 left ADR-0001–ADR-0016 dates to the MADR last-change rule, so ADR-0002/ADR-0004 got `- Date: 2026-09-17` (commit date of `0da65aa`) while `docs/whitepaper.md` §14 says "revised on September 16, 2026" and `docs/deferred.md` "ADR-0002, as revised September 16, 2026"; (b) the `CLAUDE.md` bullet "- `pnpm format:check` covers `docs/*.md`, `README.md`, and this file (…)" became untrue for `docs/adr/*.md` when Phase 7 created `docs/adr/`, and neither roadmap Phase 7 Scope nor brief "Citation moves" covered it; (c) ADR-0025 attached the org-private `[PA01 results]`/`[PA06 results]` links to the public-test-bed confirmation sentence (ADR text defect; no brief rule). Amended in place: brief Phase 7 intro (amendment 13, `<R7>` = `128249625790799e02a03284844495cc6557d0de`); Owner order item 13 (the three fixes verbatim; other owner rules intact; 7.1–7.4 not re-run); owner order 8 false-positive note (bullet becomes `LF`, same prefix); ADR set table Date cells of ADR-0002/ADR-0004 and D1 owner ruling (2026-09-16; More Information cites `[Whitepaper §14](../whitepaper.md)`, never `docs/deferred.md`, and records `f79de29` 2026-09-16 and `0da65aa` 2026-09-17; index rows same date; whitepaper and deferred.md unchanged); "ADR content rules" evidence-link placement bullet (ADR-0025); "Citation moves" `CLAUDE.md` paragraph plus literal `LF` (one line starting `LF: `; differs from the `<R7>` line only by "`docs/adr/*.md`, "); Phase 5 "Document A" annotated as superseded for the current line; K80 (a)–(d) added to "Phase 7 content checks"; "Not mechanical" (owner-order-13 judgment); P5′ K56–K79 → K56–K80; Constraints Phase 7 list (owner-order-13 file list relative to `<R7>`); project DoD 15 (amendment 13, fixes, K56–K80). Roadmap Phase 7: Objective, Scope, Depends on, DoD 1 (K80 clause), DoD 6, Risks. Untouched: `LP` line, "Restatements of §1.2 clauses" block, "Post-probe owner decisions" (13 Decisions rows, no open marker), K56–K79 texts, ledger Phases row and Plan current-phase (decomposer reopens Phase 7). Planner checks: exactly one `LP: ` and one `LF: ` line; `LF` equals the `<R7>` `CLAUDE.md` line with "`docs/adr/*.md`, " inserted; PAT matches `LF` only via `development-artifacts`; K67 sweep and deferred/DF counts on `LF` 0; `LF` ASCII only; `0da65aa` (2026-09-17 14:41 -0700) and `f79de29` (2026-09-16 19:56 -0700) are ancestors of `develop`. | brief amended; completed steps 7.1–7.4 unaffected (ran against the old text, stay untouched); fix steps 7.5 (apply) and 7.6 (gate re-run) and K80 in k7-checks.sh come from the decomposer's revision operation |
| 7 | none failed — post-completion revision (decomposer revise operation on the lead's revision note of 2026-09-25 carrying the owner's answer "Fix, then merge", after amendment 13 at `6e8dd0d`); Phase 7 reopened | Three minor defects in persistent documents after Phase 7 completed (`1282496`): (1) ADR-0002/ADR-0004 `- Date: 2026-09-17` (commit date of `0da65aa`) vs whitepaper §14 and docs/deferred.md "revised September 16, 2026"; (2) ADR-0025 context linked the org-private result files (which record the refusal) from the public-confirmation sentence; (3) `CLAUDE.md` "- `pnpm format:check` covers `docs/*.md`, …" omitted `docs/adr/*.md`. The decomposer sent amendment note 13 (brief D1 ruling, evidence-link rule, literal `LF`, check K80; dry-run at `1282496`); the planner pinned them (`6e8dd0d`). | Added 7.5 (payload P7/edits-fix-*.txt V71–V78: ADR-0002/0004 Date + History derivation, index rows, ADR-0025 context links, `CLAUDE.md` bullet = `LF`) and 7.6 (gate re-run, identical to 7.4 but for report path, base check, K56–K80, K80 lines for the lead); k7-checks.sh gains K80 (a)–(d) and `R7`; gate7.sh G1 text K56-K80. No step superseded or removed; 7.1–7.4 untouched. Validated in scratch worktrees (Phase 7 notes, "READ FIRST — post-completion revision"): 7.5 acceptance as written, `GATE7-LOCAL OK`, `GATE7-DOD OK` (GET reads only), 7.6 acceptance 18/1/16/1. |
