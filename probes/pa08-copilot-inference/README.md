# PA08 — Copilot inference in Actions

## Sub-claims

- PA08.1 assumption Personal billing path: on `personal`, a job with `permissions: copilot-requests: write`
  authenticates request-response Copilot inference with its own `GITHUB_TOKEN` (no PAT, no stored secret), billed
  to the repository owner's Copilot entitlement (Copilot Free on `jambolo`).
- PA08.2 assumption PD03's assumption: on the organization-owned test-beds, without Copilot seats or organization
  billing, the same job succeeds. A failure refutes PD03's assumption and is routed as a refuted assumption.
- PA08.3 measurement Failure shape without a usable entitlement: exit status, error class, and message (a) when
  `copilot-requests: write` is omitted, (b) wherever PA08.1 or PA08.2 fail, (c) on `personal` only: when the
  Copilot Free included allowance is exhausted — driven deliberately by the cap step, which runs last. Record
  whether each failure is distinguishable from a transient error, from a rate limit, and from the other parts.
  On `personal`, part (c) not observed makes this cell `undetermined` / `blocked`.
- PA08.4 measurement Usage and credit reporting: the usage fields the runtime and SDK report per call and per
  session (tokens, AI credits, premium requests, requested versus reported model id — Copilot Free offers auto
  model selection only, so record the model actually used); the observed CLI runtime and SDK versions.
- PA08.5 assumption Soft credit cap: `sessionLimits.maxAiCredits` is checked after a model call returns, so one
  response can exceed it and the next call is blocked; record whether a value below the documented CLI minimum
  of 30 AI credits is accepted, the overshoot, and the exhausted-limit event shape. Observed in the cap step
  BEFORE the allowance is exhausted.
- PA08.6 measurement Detectability of entitlement and policy state without an inference request: what a job
  `GITHUB_TOKEN` and the local `admin:org` user token can read about Copilot enablement for the repository owner.
- PA08.7 fixed The organization policy "Allow use of Copilot CLI billed to the organization" and its failure
  shape: result fixed `undetermined`, cause `pd03`; NOT probed; pre-accepted limitation.

## Fixtures

None besides the workflows below; budgets are the only fixture-like inputs (Copilot prompt caps per test-bed
and mode).

## Deployment list

- probe-pa08-infer.yml: org-public, org-private, personal
- probe-pa08-cap.yml: personal

## Procedure

Budgets: personal: step 2.8 <= 8 prompts (4 spent), step 2.26 <= 5; `org-public` and `org-private`: modes detect (org-public only),
cli, sdk (sends=1), omit-cli, <= 6 prompts each. The cap workflow (owner-approval-only) is added by the cap step.

The procedure uses the canonical files already in `probes/pa08-copilot-inference/` ([ADR-0023](../../docs/adr/0023-probe-suite-location.md)); step 4 lints them in place.

```text
4. Lint the canonical workflow already in probes/pa08-copilot-inference/workflows/ (ADR-0023):
   actionlint -ignore 'unknown permission scope "copilot-requests"' <W>/probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml

5. bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-personal master "probe(PA08): deploy probe-pa08-infer.yml" <W>/probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml

6. bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=detect

7. bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=cli

8. bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=sdk sends=2

9. bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=omit-cli
   bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=omit-sdk sends=1
   gh api copilot_internal/user --jq '{login, copilot_plan, access_type_sku, chat_enabled, quota_reset_date}'
   gh api user --jq '{login, plan: .plan.name}'
```

Follow-up, step 2.26 (fixed sdk-setup block; SDK legs re-run; the fixed workflow is the canonical file in `probes/pa08-copilot-inference/workflows/`):

```text
actionlint -ignore 'unknown permission scope "copilot-requests"' <W>/probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml

bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-personal master "probe(PA08): deploy probe-pa08-infer.yml (sdk-setup fix)" <W>/probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml

bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=detect
gh run view <id> -R jambolo/patch-steward-testbed-personal --log | grep -a "PROBE-PA08 " | sed -E 's/^([^\t]+)\t.*(PROBE-PA08 )/\1 \2/'

bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=sdk sends=2

bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=omit-sdk sends=1

GATE (after detect, BEFORE any send): the job-prefixed line `detect PROBE-PA08 auth_status=...` must contain
`"isAuthenticated":true` and `"authType":"env"`. Otherwise the fix did not take: STOP, send nothing, report
`status: fail` with the detect run's auth_status and quota lines verbatim (no result-file edits needed).
```

DECISION RULES.

- GATE (step 2.26): the redeployed workflow's fix counts only if `detect PROBE-PA08 auth_status=...` shows
  `"isAuthenticated":true` and `"authType":"env"`; otherwise stop before any Copilot send.
- PA08.1 confirmed iff the cli job exited 0 with a reply OR the sdk job logged a reply for >= 1 send; in the
  evidence cite the billing signals seen (quota_before/quota_after difference, CLI `Requests` stderr line).
  refuted iff cli and sdk both failed with an authentication/entitlement error that names neither allowance,
  quota, credits, plan limit, nor a rate limit, and one retry (>= 5 min later) failed the same way.
  undetermined / blocked iff the failures name the allowance/quota/credits/plan limit, or a rate limit survived
  the retry.
- PA08.3 confirmed iff part (a) was observed (omit-cli and omit-sdk outcomes: exit code, error class, message
  verbatim, distinguishability); part (b): the failure shapes of any PA08.1 failure, else state `no PA08.1
failure on personal`; part (c): write `recorded by the cap step (a later step rewrites this row)` in the
  evidence. undetermined / blocked iff part (a) could not be observed (e.g. early exhaustion first).
- PA08.4 confirmed iff usage fields were recorded from a successful call; undetermined / blocked (cite PA08.1's
  evidence ids, plus one evidence section naming the blocking cell) iff no call succeeded.
- PA08.6 confirmed when the detect runs and the local reads were recorded (any answer, including errors).
- PA08.7 always `undetermined` / `pd03`.

## Cap procedure

owner approval required: consumes the repository owner's whole monthly Copilot allowance (on `personal`, jambolo's
Copilot Free included allowance; once exhausted, no Copilot reply is possible until 00:00:00 UTC on the 1st of the
next month).

HARD BOUNDS (whole cap chain; all bind at once; sessions and sends spent debugging count):

- cap sessions (runs with `max_ai_credits=30`): at most 10 in the chain, at most 5 per step (labels `cap-01` …
  `cap-10`); the probe session (label `probe`, `max_ai_credits=1`) runs once and is not a cap session.
- sends: at most 40 per cap session, at most 5 in the probe session; chain total at most 405.
- time: every session job has `timeout-minutes: 45`; wait at most 50 minutes for one run; start consecutive
  sessions at least 60 seconds apart.
- retries: the workflow waits 5 minutes after a failed send and retries once, then ends the session.
- never: enable additional usage, set a Copilot budget, change the owner's plan, use another account or any token
  other than the job `GITHUB_TOKEN`, or run an 11th cap session.

STOP REASONS (closed set; the chain's final value is the Measurements quantity `cap stop reason`):

- `allowance-exhausted`: a send failed twice, >= 5 min apart, with text naming the allowance, quota, credits, or a
  plan limit.
- `exhausted-before-start`: the chain's very first send (probe session send 1) failed that way twice.
- `ceiling-reached`: all 10 cap sessions ran and sends still succeed.
- `blocked`: any other failure that survived the one retry (for example a persistent rate limit, or session
  creation refused for `max_ai_credits=30`). Classify by the error text; the workflow's `looks_like=` tag is a hint.

BURN SIZE: the first successful burn send's `delta_nano_aiu` should be >= 750000000 (0.75 AI credit). If lower, or
the runtime rejects the size, double `prompt_kchars` for the next session (max 400), at most two resizes in the
whole chain; if still low, continue and record a deviation. If no usage is reported, continue on the send and time
bounds and record that.

```text
bash probes/smoke/tools/deploy.sh jambolo/patch-steward-testbed-personal master "probe(PA08): deploy probe-pa08-cap.yml" <W>/probes/pa08-copilot-inference/workflows/probe-pa08-cap.yml

bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=probe max_ai_credits=1 max_sends=5 prompt_kchars=160

bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-<j> max_ai_credits=30 max_sends=40 prompt_kchars=<size>
```

Outcome (step 2.22): cap stop reason allowance-exhausted
