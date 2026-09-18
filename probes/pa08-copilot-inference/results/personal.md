# PA08 — Copilot inference in Actions — personal

- assumption: PA08
- test-bed: jambolo/patch-steward-testbed-personal
- probed: 2026-09-25T01:15:07Z to 2026-09-25T04:14:44Z
- step: 2.8, 2.26, 2.21, 2.22
- workflows: probe-pa08-infer.yml 10a2c9888479264103b30838fe9e7efafd9c7d47; probe-pa08-cap.yml f2c4d4bcec28c865e7680f554717f9b1351941bd

## Results

| Sub-claim | Kind        | Result       | Cause | Evidence                                          |
| --------- | ----------- | ------------ | ----- | ------------------------------------------------- |
| PA08.1    | assumption  | confirmed    | none  | E1, R3, E2, E10                                   |
| PA08.3    | measurement | confirmed    | none  | E1, R5, E2, E11, C13, C14                         |
| PA08.4    | measurement | confirmed    | none  | E1, R3, E2, E10                                   |
| PA08.5    | assumption  | confirmed    | none  | C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12 |
| PA08.6    | measurement | confirmed    | none  | R2, R7, E9                                        |
| PA08.7    | fixed       | undetermined | pd03  | E8                                                |

## Measurements

| Sub-claim | Quantity                                       | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Unit       | Method                       | Samples |
| --------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------- | ------- |
| PA08.3    | omit-cli outcome                               | cli-omit exit=1, "Error: Authentication failed", names no allowance/quota/credits/plan-limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | -          | step 2.8, R5                 | 1       |
| PA08.3    | omit-sdk outcome                               | sdk-omit send=1: 3 model-call attempts, each `model.call_failure` statusCode=401 "401 Unauthorized"; retry reason field `transient_auth_error` on the first two, final `session.error` errorType=authorization, message "Authorization error. Your credentials may be expired or invalid." (remediation sign_in); names no allowance/quota/credits/plan-limit or rate-limit wording; distinct statusCode and text from the permitted sdk run's two successful sends (E10)                                                                                                                                                                                 | -          | step 2.26, E11               | 1       |
| PA08.3    | part (b)                                       | no PA08.1 failure on personal (both sdk sends replied)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | -          | R3, E10                      | -       |
| PA08.3    | part (c)                                       | cap-06 send=19: `model.call_failure` statusCode=402, `model_call_failure` error `{"message":"You have exceeded your monthly quota","code":"quota_exceeded"}`, `session.error` errorType=quota, errorCode=quota_exceeded, message "You have exceeded your monthly quota (Request ID: ...)"; same on the retry 5 min later; no reply, no billing, session ended routinely (stop=send-failed-twice). Distinguishable: from a transient error (HTTP 402 and errorType quota, persists across the retry), from a rate limit (402 not 429, no rate-limit wording), from part (a) (401 / authorization "Authentication failed") and part (b) (no PA08.1 failure) | -          | C13, C14                     | 2       |
| PA08.3    | cap stop reason                                | allowance-exhausted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | -          | C13, C14                     | 1       |
| PA08.3    | cap sessions run                               | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | sessions   | C3, C5, C7, C9, C11, C13     | 6       |
| PA08.3    | cap sends                                      | 220                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | sends      | C1, C3, C5, C7, C9, C11, C13 | 220     |
| PA08.3    | cap AI credits reported                        | 180.982 (sum of cap_session_end ai_credits: 31.709 + 31.199 + 31.188 + 31.215 + 31.225 + 24.446; probe 0.000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | AI credits | C3, C5, C7, C9, C11, C13     | 6       |
| PA08.4    | per-call fields                                | CLI stderr summary: `Changes`, `Requests` (count + tier), `Tokens` (written/read), `Resume` (session id); SDK per-call: `assistant.usage` (model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens, cost, duration, apiCallId, providerCallId), `model.model_call_success` (api_id, request_id, service_request_id)                                                                                                                                                                                                                                                                                                          | -          | R3, E10                      | -       |
| PA08.4    | per-session fields                             | `send=<i> metrics=` (getMetrics): totalPremiumRequestCost, totalUserRequests, totalNanoAiu, tokenDetails{input,cache_read,cache_write,output}, totalApiDurationMs, sessionStartTime, codeChanges{linesAdded,linesRemoved,filesModifiedCount,filesModified}, modelMetrics, agentMetrics; `session.shutdown`: shutdownType, totalPremiumRequests, totalNanoAiu, tokenDetails, totalApiDurationMs, sessionStartTime, eventsFileSizeBytes, codeChanges, modelMetrics, agentMetrics                                                                                                                                                                            | -          | step 2.26, E10               | -       |
| PA08.4    | reported model                                 | mai-code-1.1-flash (auto-routed both sends; session.auto_mode_resolved chosenModel)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | -          | step 2.26, E10               | 2       |
| PA08.4    | CLI version                                    | GitHub Copilot CLI 1.0.88                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -          | step 2.8, R3                 | -       |
| PA08.4    | SDK version                                    | @github/copilot-sdk 1.0.14                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | -          | E10                          | -       |
| PA08.4    | AI credits for one short send                  | 0.03364 (send 1 totalNanoAiu 33640000, raw nano-AIU / 1e9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | AI credits | step 2.26, E10               | 1       |
| PA08.4    | standard prompts spent (step 2.8)              | 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | prompts    | step 2.8, E1                 | -       |
| PA08.4    | standard prompts spent (step 2.26)             | 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | prompts    | step 2.26, E2                | -       |
| PA08.5    | maxAiCredits 1 accepted                        | no: session.create failed "session construction failed: GenericFailure, Minimum session limit is 30 AI credits." (session_created=no, 0 sends)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | -          | C2                           | 1       |
| PA08.5    | configured limit                               | 30                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | AI credits | C4, C6, C8, C10, C12         | 5       |
| PA08.5    | reported use at stop                           | 31.708776, 31.198948, 31.187616, 31.215416, 31.224792 (response_limits_status aiCreditsUsed; raw totalNanoAiu 31708776000, 31198948000, 31187616000, 31215416000, 31224792000)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | AI credits | C4, C6, C8, C10, C12         | 5       |
| PA08.5    | overshoot                                      | 1.709, 1.199, 1.188, 1.215, 1.225 (used - 30; each within the last billed response: last billed response delta 2.017 in cap-01 and 1.356 in cap-02, see C8, C10, C12 for the rest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | AI credits | C4, C6, C8, C10, C12         | 5       |
| PA08.6    | job token auth status                          | {"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | -          | E9                           | -       |
| PA08.6    | job token auth status without copilot-requests | {"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | -          | E9                           | -       |
| PA08.6    | job token getQuota                             | {"quotaSnapshots":{}} (before and after; no longer "Not authenticated", but reports no snapshot entries)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | -          | step 2.26, E9                | -       |
| PA08.6    | job token getQuota without copilot-requests    | {"quotaSnapshots":{}} (before and after)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | -          | E9                           | -       |
| PA08.6    | job token copilot_internal/user                | error (both detect and detect-noperm: HTTP 403 "Resource not accessible by integration")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | -          | R2, E9                       | -       |
| PA08.6    | user token copilot_internal/user               | ok (200; see R7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | -          | R7                           | -       |

## Evidence

### E1 — every Copilot request sent by step 2.8

```text
PROBE-PA08 job=cli copilot_request_utc=2026-09-25T01:17:32Z client=cli
PROBE-PA08 copilot_request_utc=2026-09-25T01:18:09Z client=sdk send=1
PROBE-PA08 job=cli-omit copilot_request_utc=2026-09-25T01:19:46Z client=cli
PROBE-PA08 copilot_request_utc=2026-09-25T01:20:22Z client=sdk send=1
```

### E2 — every Copilot request sent by step 2.26

```text
copilot_request_utc=2026-09-25T03:17:08Z client=sdk send=1
copilot_request_utc=2026-09-25T03:17:10Z client=sdk send=2
copilot_request_utc=2026-09-25T03:17:40Z client=sdk send=1
```

### R1 — detect run (before fix), run 36081190382

Superseded by step 2.26: this run used step 2.8's defective sdk-setup block (useLoggedInUser: false made the SDK runtime ignore the job token), so its SDK lines are not evidence about the SDK path.

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=detect`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36081190382

```text
[... command-echo lines elided; see R2 for the fixed rerun ...]
job=detect-noperm sdk_version=1.0.14
sdk mode=quota sends=1 token_present=true node=v24.21.0
client_started=yes
quota_before_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
quota_after_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
sdk done utc=2026-09-25T01:15:18Z
job=detect-noperm copilot_internal_user exit=$? response=$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-400)"
[... duplicate detect job trace elided ...]
```

Both jobs failed: the workflow's `gh api ... 2>&1` step ran under the shell's default `set -e`, so a nonzero
`gh api` exit aborted the script before the `echo "PROBE-PA08 ... copilot_internal_user exit=$? ..."` line ran,
leaving the real exit code and response unrecorded. Deviations records the fix; the rerun is R2.

### R2 — detect run (after fix), run 36081314986

Superseded by step 2.26: this run used step 2.8's defective sdk-setup block (useLoggedInUser: false made the SDK runtime ignore the job token), so its SDK lines are not evidence about the SDK path.

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=detect`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36081314986

```text
job=detect-noperm sdk_version=1.0.14
job=detect-noperm start_utc=2026-09-25T01:16:57Z
sdk mode=quota sends=1 token_present=true node=v24.21.0
client_started=yes
quota_before_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
quota_after_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
sdk done utc=2026-09-25T01:16:57Z
job=detect-noperm copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}gh: Resource not accessible by integration (HTTP 403)
job=detect sdk_version=1.0.14
job=detect start_utc=2026-09-25T01:17:01Z
sdk mode=quota sends=1 token_present=true node=v24.21.0
client_started=yes
quota_before_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
quota_after_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
sdk done utc=2026-09-25T01:17:02Z
job=detect copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}gh: Resource not accessible by integration (HTTP 403)
```

### R3 — cli run, run 36081358716

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=cli`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36081358716

```text
job=cli copilot_cli_version=GitHub Copilot CLI 1.0.88.
job=cli copilot_exit=0
copilot_stdout: ready
copilot_stderr: Changes    +0 -0
copilot_stderr: Requests   1 Premium (1s)
copilot_stderr: Tokens     ↑ 10.6k (10.6k written) • ↓ 5
copilot_stderr: Resume     copilot --resume=75e1272c-4fdb-4bfd-b013-ea32f477a819
job=cli copilot_done_utc=2026-09-25T01:17:34Z
```

The job `GITHUB_TOKEN` with `permissions: copilot-requests: write` authenticated one CLI prompt (no PAT, no
stored secret), replied "ready", and reported "1 Premium (1s)" billed against jambolo's Copilot Free seat —
the billing signal for PA08.1.

### R4 — sdk run, run 36081401088

Superseded by step 2.26: this run used step 2.8's defective sdk-setup block (useLoggedInUser: false made the SDK runtime ignore the job token), so its SDK lines are not evidence about the SDK path.

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=sdk sends=2`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36081401088

```text
sdk mode=send sends=2 token_present=true node=v24.21.0
client_started=yes
quota_before_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
session_id=77d2bb20-7e5e-420c-a432-cc99dbadac89
event type=session.info data={"infoType":"configuration","message":"Disabled tools: bash, create, edit, glob, grep, list_agents, list_bash, read_agent, read_bash, sql, stop_bash, task, view, web_fetch, write_agent"}
event type=session.error data={"errorType":"query","message":"Execution failed: InvalidArg, No GitHub OAuth token or Copilot HMAC key provided"}
send=1 error=Execution failed: InvalidArg, No GitHub OAuth token or Copilot HMAC key provided | undefined
event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":0,"totalNanoAiu":0,"totalApiDurationMs":0,"sessionStartTime":1790299089842,"eventsFileSizeBytes":686,"codeChanges":{"linesAdded":0,"linesRemoved":0,"filesModified":[]},"modelMetrics":{},"currentTokens":1608,"systemTokens":1604,"conversationTokens":0,"toolDefinitionsTokens":0}
quota_after_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
sdk done utc=2026-09-25T01:18:10Z
```

send=1 failed on the SDK's own agent-runtime authentication ("No GitHub OAuth token or Copilot HMAC key
provided"), so the loop broke before send=2 (only 1 of the planned 2 sends was actually attempted; counted once
in E1). The error names neither allowance, quota, credits, plan limit, nor a rate limit, so this is not an
allowance failure; it also occurred with `copilot-requests: write` granted. Session-level usage fields
(totalPremiumRequests=0, totalNanoAiu=0) show no model call was actually billed, consistent with the request
never reaching the model.

### R5 — omit-cli run, run 36081467518

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=omit-cli`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36081467518

```text
job=cli-omit copilot_cli_version=GitHub Copilot CLI 1.0.88.
job=cli-omit copilot_exit=1
copilot_stderr: Error: Authentication failed (Request ID: 6840:2B47E5:140DFA2:1691097:6AB5CC33)
copilot_stderr: Your GitHub token may be invalid, expired, or lacking the required permissions.
copilot_stderr: To resolve this, try the following:
copilot_stderr:   • Start 'copilot' and run the '/login' command to re-authenticate
copilot_stderr:   • If using a Fine-Grained PAT, ensure it has the 'Copilot Requests' permission enabled
copilot_stderr:   • If using COPILOT_GITHUB_TOKEN, GH_TOKEN or GITHUB_TOKEN environment variable, verify the token is valid and not expired
copilot_stderr:   • Run 'gh auth status' to check your current authentication status
job=cli-omit copilot_done_utc=2026-09-25T01:19:47Z
```

Without `copilot-requests: write`, the CLI exits 1 with "Authentication failed" and points at the missing
permission scope — a clean, distinguishable entitlement/authorization failure, not a rate limit or transient
error, and textually distinct from R3's success and from the SDK omission shape (E11).

### R6 — omit-sdk run, run 36081558548

Superseded by step 2.26: this run used step 2.8's defective sdk-setup block (useLoggedInUser: false made the SDK runtime ignore the job token), so its SDK lines are not evidence about the SDK path.

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=omit-sdk sends=1`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36081558548

```text
sdk mode=send sends=1 token_present=true node=v24.21.0
client_started=yes
quota_before_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
session_id=1ea5e3d8-3db4-404d-8eac-3fead2195ce2
event type=session.error data={"errorType":"query","message":"Execution failed: InvalidArg, No GitHub OAuth token or Copilot HMAC key provided"}
send=1 error=Execution failed: InvalidArg, No GitHub OAuth token or Copilot HMAC key provided | undefined
quota_after_error=Request account.getQuota failed with message: Not authenticated. Please authenticate first.
sdk done utc=2026-09-25T01:20:23Z
```

### R7 — local reads (PA08.6)

Command: `gh api copilot_internal/user --jq '{login, copilot_plan, access_type_sku, chat_enabled, quota_reset_date}'`

```text
{"access_type_sku":"free_limited_copilot","chat_enabled":true,"copilot_plan":"individual","login":"jambolo","quota_reset_date":"2026-10-01"}
```

Command: `gh api user --jq '{login, plan: .plan.name}'`

```text
{"login":"jambolo","plan":null}
```

The local `admin:org` user token reads jambolo's Copilot entitlement in full (individual plan, `free_limited_copilot`
sku, chat enabled, quota resets 2026-10-01); the job `GITHUB_TOKEN` cannot reach the same endpoint (R2, both with
and without `copilot-requests: write`); job-token reads through the SDK are in E9.

### E8 — PA08.7 fixed by the plan, not probed

```text
The organization policy "Allow use of Copilot CLI billed to the organization" and its failure shape: result
fixed `undetermined`, cause `pd03`; NOT probed; pre-accepted limitation.
```

### E9 — detect run (step 2.26), run 36089680498

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=detect`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36089680498

```text
detect-noperm PROBE-PA08 job=detect-noperm sdk_version=1.0.14
detect-noperm PROBE-PA08 job=detect-noperm start_utc=2026-09-25T03:16:28Z
detect-noperm PROBE-PA08 sdk mode=quota sends=1 token_present=true node=v24.21.0
detect-noperm PROBE-PA08 client_started=yes
detect-noperm PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
detect-noperm PROBE-PA08 quota_before={"quotaSnapshots":{}}
detect-noperm PROBE-PA08 quota_after={"quotaSnapshots":{}}
detect-noperm PROBE-PA08 sdk done utc=2026-09-25T03:16:28Z
detect-noperm PROBE-PA08 job=detect-noperm copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}gh: Resource not accessible by integration (HTTP 403)
detect PROBE-PA08 job=detect sdk_version=1.0.14
detect PROBE-PA08 job=detect start_utc=2026-09-25T03:16:28Z
detect PROBE-PA08 sdk mode=quota sends=1 token_present=true node=v24.21.0
detect PROBE-PA08 client_started=yes
detect PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
detect PROBE-PA08 quota_before={"quotaSnapshots":{}}
detect PROBE-PA08 quota_after={"quotaSnapshots":{}}
detect PROBE-PA08 sdk done utc=2026-09-25T03:16:29Z
detect PROBE-PA08 job=detect copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}gh: Resource not accessible by integration (HTTP 403)
```

With the fixed sdk-setup block, the job `GITHUB_TOKEN` authenticates the SDK runtime itself
(`isAuthenticated:true`, `authType:env`, via COPILOT_GITHUB_TOKEN) with and without `copilot-requests: write`;
`getQuota` no longer errors "Not authenticated" but reports an empty `quotaSnapshots` object either way, and the
REST `copilot_internal/user` call still 403s for the job token regardless of the permission scope (unchanged
from R2).

### E10 — sdk run (step 2.26), run 36089721123

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=sdk sends=2`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36089721123

```text
sdk PROBE-PA08 job=sdk sdk_version=1.0.14
sdk PROBE-PA08 job=sdk start_utc=2026-09-25T03:17:08Z
sdk PROBE-PA08 sdk mode=send sends=2 token_present=true node=v24.21.0
sdk PROBE-PA08 client_started=yes
sdk PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
sdk PROBE-PA08 quota_before={"quotaSnapshots":{}}
sdk PROBE-PA08 session_id=cb33baf9-b76b-4633-9c38-e68ddbfd52a6
sdk PROBE-PA08 event type=session.auto_mode_resolved data={"chosenModel":"mai-code-1.1-flash", ...}
sdk PROBE-PA08 event type=assistant.usage data={"model":"mai-code-1.1-flash","inputTokens":1646,"outputTokens":6,"cacheReadTokens":0,"cacheWriteTokens":0,"reasoningTokens":0,"cost":1,"duration":1061, ...}
sdk PROBE-PA08 event type=session.usage_checkpoint data={"totalNanoAiu":33640000,"totalPremiumRequests":1, ...}
sdk PROBE-PA08 send=1 reply=ready1
sdk PROBE-PA08 send=1 metrics={"totalPremiumRequestCost":1,"totalUserRequests":1,"totalNanoAiu":33640000,"tokenDetails":{"input":{"tokenCount":1646},"cache_read":{"tokenCount":0},"cache_write":{"tokenCount":0},"output":{"tokenCount":6}},"totalApiDurationMs":1061, ...}
sdk PROBE-PA08 event type=session.auto_mode_resolved data={"chosenModel":"mai-code-1.1-flash", ...}
sdk PROBE-PA08 event type=assistant.usage data={"model":"mai-code-1.1-flash","inputTokens":1692,"outputTokens":6,"cacheReadTokens":1536,"cacheWriteTokens":0,"reasoningTokens":0,"cost":1,"duration":577, ...}
sdk PROBE-PA08 event type=session.usage_checkpoint data={"totalNanoAiu":40552000,"totalPremiumRequests":2, ...}
sdk PROBE-PA08 send=2 reply=ready2
sdk PROBE-PA08 send=2 metrics={"totalPremiumRequestCost":2,"totalUserRequests":2,"totalNanoAiu":40552000,"tokenDetails":{"input":{"tokenCount":1802},"cache_read":{"tokenCount":1536},"cache_write":{"tokenCount":0},"output":{"tokenCount":12}},"totalApiDurationMs":1638, ...}
sdk PROBE-PA08 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":2,"totalNanoAiu":40552000,"tokenDetails":{"input":{"tokenCount":1802},"cache_read":{"tokenCount":1536},"cache_write":{"tokenCount":0},"output":{"tokenCount":12}},"totalApiDurationMs":1638, ...}
sdk PROBE-PA08 quota_after={"quotaSnapshots":{}}
sdk PROBE-PA08 sdk done utc=2026-09-25T03:17:11Z
[... 7 lines of full model-info/messages_snapshot JSON elided ...]
```

Both sends succeeded end to end: `ready1` and `ready2` replies, auto-routed to `mai-code-1.1-flash`, billed
`totalPremiumRequests` 1 then 2 and `totalNanoAiu` 33640000 then 40552000 (cumulative; send 2's own AI credits
are the 6912000 nano-AIU increase, largely offset by a 1536-token cache read). `getQuota` still reports an empty
`quotaSnapshots` object before and after (no observable quota diff through this call), so the billing signal for
PA08.1 is the CLI's `Requests` line (R3) and the SDK's `totalPremiumRequests`/`totalNanoAiu` increase (this run),
not `getQuota`.

### E11 — omit-sdk run (step 2.26), run 36089762284

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=omit-sdk sends=1`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36089762284

```text
sdk-omit PROBE-PA08 job=sdk-omit sdk_version=1.0.14
sdk-omit PROBE-PA08 job=sdk-omit start_utc=2026-09-25T03:17:40Z
sdk-omit PROBE-PA08 sdk mode=send sends=1 token_present=true node=v24.21.0
sdk-omit PROBE-PA08 client_started=yes
sdk-omit PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
sdk-omit PROBE-PA08 quota_before={"quotaSnapshots":{}}
sdk-omit PROBE-PA08 session_id=34173455-4ce2-4730-ae2f-d4e3f5b1c3c3
sdk-omit PROBE-PA08 event type=model.turn_started data={"kind":"turn_started","model":"claude-sonnet-4", ...}
sdk-omit PROBE-PA08 event type=model.call_failure data={"model":"claude-sonnet-4","statusCode":401,"errorMessage":"\"401 Unauthorized\"", ...}
sdk-omit PROBE-PA08 event type=model.model_call_failure data={"kind":"model_call_failure","turn":0,"modelCall":{"model":"claude-sonnet-4","status":401,"error":"\"401 Unauthorized\""}, ...}
sdk-omit PROBE-PA08 event type=model.call_finished data={"turnId":"0","outcome":"error", ...}
[... 2 further retry attempts with the same model.call_failure/model_call_failure/call_finished shape elided ...]
sdk-omit PROBE-PA08 event type=model.turn_failed data={"kind":"turn_failed","model":"claude-sonnet-4","error":"401 Unauthorized"}
sdk-omit PROBE-PA08 event type=model.turn_ended data={"kind":"turn_ended","model":"claude-sonnet-4", ...}
sdk-omit PROBE-PA08 event type=session.error data={"errorType":"authorization","message":"Authorization error. Your credentials may be expired or invalid. (Request ID: 0C03:3B9C92:1956419:1CD3B9D:6AB5E7D6)","statusCode":401,"remediation":"sign_in"}
sdk-omit PROBE-PA08 send=1 error=Authorization error. Your credentials may be expired or invalid. (Request ID: 0C03:3B9C92:1956419:1CD3B9D:6AB5E7D6) | undefined
sdk-omit PROBE-PA08 quota_after={"quotaSnapshots":{}}
sdk-omit PROBE-PA08 sdk done utc=2026-09-25T03:17:44Z
```

Without `copilot-requests: write`, the SDK server itself authenticates (`auth_status` shows
`isAuthenticated:true`) and starts a session, auto-routing to `claude-sonnet-4` (a different model than the
permitted sdk run's `mai-code-1.1-flash`), but every model-call attempt (3, with the SDK's own retry) fails with
HTTP 401 and `session.error` `errorType:authorization`, "Authorization error. Your credentials may be expired
or invalid." This is a clean, distinguishable failure from the permitted sdk run's two successful replies (E10):
different status code path (401 vs. success), different error text, and it reaches the model-call layer instead
of failing at client startup. It names no allowance, quota, credits, or plan limit, and the SDK's own retry
already treated it as `transient_auth_error` without recovering, so it is also distinguishable from a bare
transient error or rate limit that a single retry would clear.

### C1 — cap session probe (run 36091208989)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=probe max_ai_credits=1 max_sends=5 prompt_kchars=160`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36091208989

```text
cap_session_end session=probe stop=session-create-failed sends=0 total_nano_aiu=0 ai_credits=0.000 limit_event=none last_error=none end_utc=2026-09-25T03:39:10Z
```

### C2 — cap session probe usage and events

```text
cap session=probe max_ai_credits=1 max_sends=5 prompt_kchars=160 token_present=true start_utc=2026-09-25T03:39:10Z
cap session=probe auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
cap session=probe quota_before={"quotaSnapshots":{}}
cap session=probe session_created=no error=Request session.create failed with message: session construction failed: GenericFailure, Minimum session limit is 30 AI credits. | Error: Request session.create failed with message: session construction failed: GenericFailure, Minimum session limit is 30 AI credits. at handleResponse (/home/runner/work/_temp/pa08-sdk/node_modules/vscode-jsonrpc/lib/common
cap session=probe quota_after={"quotaSnapshots":{}}
```

### C3 — cap session cap-01 (run 36091247802)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-01 max_ai_credits=30 max_sends=40 prompt_kchars=160`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36091247802

```text
copilot_request_utc=2026-09-25T03:39:44Z cap_session=cap-01 send=1 attempt=1 prompt_chars=160170
copilot_request_utc=2026-09-25T03:39:49Z cap_session=cap-01 send=2 attempt=1 prompt_chars=160171
copilot_request_utc=2026-09-25T03:39:53Z cap_session=cap-01 send=3 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:39:57Z cap_session=cap-01 send=4 attempt=1 prompt_chars=160174
copilot_request_utc=2026-09-25T03:40:06Z cap_session=cap-01 send=5 attempt=1 prompt_chars=160171
copilot_request_utc=2026-09-25T03:40:13Z cap_session=cap-01 send=6 attempt=1 prompt_chars=160170
copilot_request_utc=2026-09-25T03:40:18Z cap_session=cap-01 send=7 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:40:23Z cap_session=cap-01 send=8 attempt=1 prompt_chars=160171
copilot_request_utc=2026-09-25T03:40:32Z cap_session=cap-01 send=9 attempt=1 prompt_chars=160171
copilot_request_utc=2026-09-25T03:40:44Z cap_session=cap-01 send=10 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:40:55Z cap_session=cap-01 send=11 attempt=1 prompt_chars=160176
copilot_request_utc=2026-09-25T03:41:06Z cap_session=cap-01 send=12 attempt=1 prompt_chars=160171
copilot_request_utc=2026-09-25T03:41:16Z cap_session=cap-01 send=13 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:41:30Z cap_session=cap-01 send=14 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:41:39Z cap_session=cap-01 send=15 attempt=1 prompt_chars=160172
copilot_request_utc=2026-09-25T03:41:48Z cap_session=cap-01 send=16 attempt=1 prompt_chars=160172
copilot_request_utc=2026-09-25T03:41:58Z cap_session=cap-01 send=17 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:07Z cap_session=cap-01 send=18 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:16Z cap_session=cap-01 send=19 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:24Z cap_session=cap-01 send=20 attempt=1 prompt_chars=160174
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=21 attempt=1 prompt_chars=160172
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=22 attempt=1 prompt_chars=160174
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=23 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=24 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=25 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=26 attempt=1 prompt_chars=160176
copilot_request_utc=2026-09-25T03:42:25Z cap_session=cap-01 send=27 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:26Z cap_session=cap-01 send=28 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:26Z cap_session=cap-01 send=29 attempt=1 prompt_chars=160172
copilot_request_utc=2026-09-25T03:42:26Z cap_session=cap-01 send=30 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:26Z cap_session=cap-01 send=31 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:27Z cap_session=cap-01 send=32 attempt=1 prompt_chars=160172
copilot_request_utc=2026-09-25T03:42:27Z cap_session=cap-01 send=33 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:27Z cap_session=cap-01 send=34 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:27Z cap_session=cap-01 send=35 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:28Z cap_session=cap-01 send=36 attempt=1 prompt_chars=160174
copilot_request_utc=2026-09-25T03:42:29Z cap_session=cap-01 send=37 attempt=1 prompt_chars=160175
copilot_request_utc=2026-09-25T03:42:29Z cap_session=cap-01 send=38 attempt=1 prompt_chars=160172
copilot_request_utc=2026-09-25T03:42:29Z cap_session=cap-01 send=39 attempt=1 prompt_chars=160173
copilot_request_utc=2026-09-25T03:42:30Z cap_session=cap-01 send=40 attempt=1 prompt_chars=160175
cap_session_end session=cap-01 stop=max-sends sends=40 total_nano_aiu=31708776000 ai_credits=31.709 limit_event=none last_error=none end_utc=2026-09-25T03:42:31Z
```

### C4 — cap session cap-01 usage and events

```text
cap session=cap-01 max_ai_credits=30 max_sends=40 prompt_kchars=160 token_present=true start_utc=2026-09-25T03:39:44Z
cap session=cap-01 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
cap session=cap-01 quota_before={"quotaSnapshots":{}}
cap session=cap-01 session_created=yes session_id=8a19097a-0baf-4bc5-a016-3429dca2babd
cap session=cap-01 send=1 total_nano_aiu=708780000 delta_nano_aiu=708780000 metrics={"totalPremiumRequestCost":1,"totalU
cap session=cap-01 send=19 reply=Progress: the task is effectively complete from the prompt’s done_utc=2026-09-25T03:4
cap session=cap-01 send=19 total_nano_aiu=31708776000 delta_nano_aiu=2017248000 metrics={"totalPremiumRequestCost":19,"t
cap session=cap-01 event type=model.response_limits_status data={"kind":"response_limits_status","turn":0,"status":{"aiCreditsUsed":31.708776,"aiCreditsRemaining":0,"maxAiCredits":30,"isLimitsExhausted":true,"isFinalModelCall":false},"state":"blocked","message":"Session limit reached. Increase or unset the session limit to continue."}
cap session=cap-01 event type=model.turn_failed data={"kind":"turn_failed","model":"mai-code-1.1-flash","model [... rest is modelInfo; the workflow logs at most 500 chars per event, so no error field was captured ...]
cap session=cap-01 send=20 reply= done_utc=2026-09-25T03:42:25Z
cap session=cap-01 send=20 total_nano_aiu=31708776000 delta_nano_aiu=0 metrics={"totalPremiumRequestCost":19,"totalUserR
[... sends 21-40: same shape (reply empty, delta_nano_aiu=0, one model.turn_failed each) elided ...]
cap session=cap-01 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":19,"totalNanoAiu":31708776000,"tokenDetails":{"input":{"tokenCount":1560306},"cache_read":{"tokenCount":202368},"cache_write":{"tokenCount":0},"output":{"tokenCount":816}},"totalApiDurationMs":149956
cap session=cap-01 quota_after={"quotaSnapshots":{}}
```

### C5 — cap session cap-02 (run 36091504726)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-02 max_ai_credits=30 max_sends=40 prompt_kchars=320`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36091504726

```text
copilot_request_utc=2026-09-25T03:43:29Z cap_session=cap-02 send=1 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:43:37Z cap_session=cap-02 send=2 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:43:42Z cap_session=cap-02 send=3 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:43:54Z cap_session=cap-02 send=4 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:44:01Z cap_session=cap-02 send=5 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:44:06Z cap_session=cap-02 send=6 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:44:11Z cap_session=cap-02 send=7 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:44:17Z cap_session=cap-02 send=8 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:44:21Z cap_session=cap-02 send=9 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:44:27Z cap_session=cap-02 send=10 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:44:34Z cap_session=cap-02 send=11 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:44:39Z cap_session=cap-02 send=12 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:44:44Z cap_session=cap-02 send=13 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:44:49Z cap_session=cap-02 send=14 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:44:54Z cap_session=cap-02 send=15 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:45:00Z cap_session=cap-02 send=16 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:45:06Z cap_session=cap-02 send=17 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:45:12Z cap_session=cap-02 send=18 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:45:17Z cap_session=cap-02 send=19 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:45:25Z cap_session=cap-02 send=20 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:45:31Z cap_session=cap-02 send=21 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:45:49Z cap_session=cap-02 send=22 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:45:54Z cap_session=cap-02 send=23 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:45:59Z cap_session=cap-02 send=24 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:45:59Z cap_session=cap-02 send=25 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:45:59Z cap_session=cap-02 send=26 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:45:59Z cap_session=cap-02 send=27 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:45:59Z cap_session=cap-02 send=28 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:46:00Z cap_session=cap-02 send=29 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:46:00Z cap_session=cap-02 send=30 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:46:00Z cap_session=cap-02 send=31 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:46:00Z cap_session=cap-02 send=32 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:46:01Z cap_session=cap-02 send=33 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:46:01Z cap_session=cap-02 send=34 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:46:02Z cap_session=cap-02 send=35 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:46:02Z cap_session=cap-02 send=36 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:46:03Z cap_session=cap-02 send=37 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:46:03Z cap_session=cap-02 send=38 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:46:04Z cap_session=cap-02 send=39 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:46:05Z cap_session=cap-02 send=40 attempt=1 prompt_chars=320176
cap_session_end session=cap-02 stop=max-sends sends=40 total_nano_aiu=31198948000 ai_credits=31.199 limit_event=none last_error=none end_utc=2026-09-25T03:46:06Z
```

### C6 — cap session cap-02 usage and events

```text
cap session=cap-02 max_ai_credits=30 max_sends=40 prompt_kchars=320 token_present=true start_utc=2026-09-25T03:43:29Z
cap session=cap-02 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
cap session=cap-02 quota_before={"quotaSnapshots":{}}
cap session=cap-02 session_created=yes session_id=2ed3cd98-e0b4-4b09-bf4f-221d203657bf
cap session=cap-02 send=1 total_nano_aiu=1355276000 delta_nano_aiu=1355276000 metrics={"totalPremiumRequestCost":1,"tota
cap session=cap-02 send=23 reply=done done_utc=2026-09-25T03:45:59Z
cap session=cap-02 send=23 total_nano_aiu=31198948000 delta_nano_aiu=1356068000 metrics={"totalPremiumRequestCost":23,"t
cap session=cap-02 event type=model.response_limits_status data={"kind":"response_limits_status","turn":0,"status":{"aiCreditsUsed":31.198948,"aiCreditsRemaining":0,"maxAiCredits":30,"isLimitsExhausted":true,"isFinalModelCall":false},"state":"blocked","message":"Session limit reached. Increase or unset the session limit to continue."}
cap session=cap-02 event type=model.turn_failed data={"kind":"turn_failed","model":"mai-code-1.1-flash","model [... rest is modelInfo; the workflow logs at most 500 chars per event, so no error field was captured ...]
cap session=cap-02 send=24 reply= done_utc=2026-09-25T03:45:59Z
cap session=cap-02 send=24 total_nano_aiu=31198948000 delta_nano_aiu=0 metrics={"totalPremiumRequestCost":23,"totalUserR
[... sends 25-40: same shape (reply empty, delta_nano_aiu=0, one model.turn_failed each) elided ...]
cap session=cap-02 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":23,"totalNanoAiu":31198948000,"tokenDetails":{"input":{"tokenCount":1547887},"cache_read":{"tokenCount":37504},"cache_write":{"tokenCount":0},"output":{"tokenCount":1385}},"totalApiDurationMs":137070
cap session=cap-02 quota_after={"quotaSnapshots":{}}
```

### C7 — cap session cap-03 (run 36091740507)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-03 max_ai_credits=30 max_sends=40 prompt_kchars=320`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36091740507

```text
copilot_request_utc=2026-09-25T03:46:59Z cap_session=cap-03 send=1 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:47:07Z cap_session=cap-03 send=2 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:47:13Z cap_session=cap-03 send=3 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:47:26Z cap_session=cap-03 send=4 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:47:31Z cap_session=cap-03 send=5 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:47:37Z cap_session=cap-03 send=6 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:47:51Z cap_session=cap-03 send=7 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:47:57Z cap_session=cap-03 send=8 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:48:04Z cap_session=cap-03 send=9 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:48:10Z cap_session=cap-03 send=10 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:48:16Z cap_session=cap-03 send=11 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:48:21Z cap_session=cap-03 send=12 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:48:28Z cap_session=cap-03 send=13 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:48:34Z cap_session=cap-03 send=14 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:48:42Z cap_session=cap-03 send=15 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:48:48Z cap_session=cap-03 send=16 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:49:03Z cap_session=cap-03 send=17 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:49:10Z cap_session=cap-03 send=18 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:49:19Z cap_session=cap-03 send=19 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:49:28Z cap_session=cap-03 send=20 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:49:32Z cap_session=cap-03 send=21 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:49:37Z cap_session=cap-03 send=22 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:49:49Z cap_session=cap-03 send=23 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:49:56Z cap_session=cap-03 send=24 attempt=1 prompt_chars=320178
copilot_request_utc=2026-09-25T03:49:56Z cap_session=cap-03 send=25 attempt=1 prompt_chars=320178
copilot_request_utc=2026-09-25T03:49:56Z cap_session=cap-03 send=26 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:49:57Z cap_session=cap-03 send=27 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:49:57Z cap_session=cap-03 send=28 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:49:57Z cap_session=cap-03 send=29 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:49:57Z cap_session=cap-03 send=30 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:49:57Z cap_session=cap-03 send=31 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:49:58Z cap_session=cap-03 send=32 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:49:58Z cap_session=cap-03 send=33 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:49:58Z cap_session=cap-03 send=34 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:49:58Z cap_session=cap-03 send=35 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:49:59Z cap_session=cap-03 send=36 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:50:00Z cap_session=cap-03 send=37 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:50:00Z cap_session=cap-03 send=38 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:50:01Z cap_session=cap-03 send=39 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:50:01Z cap_session=cap-03 send=40 attempt=1 prompt_chars=320173
cap_session_end session=cap-03 stop=max-sends sends=40 total_nano_aiu=31187616000 ai_credits=31.188 limit_event=none last_error=none end_utc=2026-09-25T03:50:02Z
```

### C8 — cap session cap-03 usage and events

```text
cap session=cap-03 max_ai_credits=30 max_sends=40 prompt_kchars=320 token_present=true start_utc=2026-09-25T03:46:59Z
cap session=cap-03 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
cap session=cap-03 quota_before={"quotaSnapshots":{}}
cap session=cap-03 session_created=yes session_id=7293245a-d19e-4d80-9b3e-d5ee76c85d2c
cap session=cap-03 send=1 total_nano_aiu=1358804000 delta_nano_aiu=1358804000 metrics={"totalPremiumRequestCost":1,"tota
cap session=cap-03 send=23 reply=done done_utc=2026-09-25T03:49:56Z
cap session=cap-03 send=23 total_nano_aiu=31187616000 delta_nano_aiu=1353448000 metrics={"totalPremiumRequestCost":23,"t
cap session=cap-03 event type=model.response_limits_status data={"kind":"response_limits_status","turn":0,"status":{"aiCreditsUsed":31.187616,"aiCreditsRemaining":0,"maxAiCredits":30,"isLimitsExhausted":true,"isFinalModelCall":false},"state":"blocked","message":"Session limit reached. Increase or unset the session limit to continue."}
cap session=cap-03 event type=model.turn_failed data={"kind":"turn_failed","model":"mai-code-1.1-flash","model [... rest is modelInfo; the workflow logs at most 500 chars per event, so no error field was captured ...]
cap session=cap-03 send=24 reply= done_utc=2026-09-25T03:49:56Z
cap session=cap-03 send=24 total_nano_aiu=31187616000 delta_nano_aiu=0 metrics={"totalPremiumRequestCost":23,"totalUserR
[... sends 25-40: same shape (reply empty, delta_nano_aiu=0, one model.turn_failed each) elided ...]
cap session=cap-03 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":23,"totalNanoAiu":31187616000,"tokenDetails":{"input":{"tokenCount":1547544},"cache_read":{"tokenCount":37248},"cache_write":{"tokenCount":0},"output":{"tokenCount":1352}},"totalApiDurationMs":161610
cap session=cap-03 quota_after={"quotaSnapshots":{}}
```

### C9 — cap session cap-04 (run 36092050346)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-04 max_ai_credits=30 max_sends=40 prompt_kchars=320`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36092050346

```text
copilot_request_utc=2026-09-25T03:51:30Z cap_session=cap-04 send=1 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:51:37Z cap_session=cap-04 send=2 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:51:43Z cap_session=cap-04 send=3 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:51:52Z cap_session=cap-04 send=4 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:51:57Z cap_session=cap-04 send=5 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:52:05Z cap_session=cap-04 send=6 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:52:11Z cap_session=cap-04 send=7 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:52:18Z cap_session=cap-04 send=8 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:52:24Z cap_session=cap-04 send=9 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:52:30Z cap_session=cap-04 send=10 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:52:36Z cap_session=cap-04 send=11 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:52:42Z cap_session=cap-04 send=12 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:52:49Z cap_session=cap-04 send=13 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:52:56Z cap_session=cap-04 send=14 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:53:01Z cap_session=cap-04 send=15 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:53:12Z cap_session=cap-04 send=16 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:53:18Z cap_session=cap-04 send=17 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:53:33Z cap_session=cap-04 send=18 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:53:39Z cap_session=cap-04 send=19 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:53:45Z cap_session=cap-04 send=20 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:53:50Z cap_session=cap-04 send=21 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:53:55Z cap_session=cap-04 send=22 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:54:00Z cap_session=cap-04 send=23 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:54:04Z cap_session=cap-04 send=24 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:54:04Z cap_session=cap-04 send=25 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:54:05Z cap_session=cap-04 send=26 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:54:05Z cap_session=cap-04 send=27 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:54:05Z cap_session=cap-04 send=28 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:54:05Z cap_session=cap-04 send=29 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:54:05Z cap_session=cap-04 send=30 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:54:05Z cap_session=cap-04 send=31 attempt=1 prompt_chars=320178
copilot_request_utc=2026-09-25T03:54:06Z cap_session=cap-04 send=32 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:54:06Z cap_session=cap-04 send=33 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:54:06Z cap_session=cap-04 send=34 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:54:06Z cap_session=cap-04 send=35 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:54:07Z cap_session=cap-04 send=36 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:54:08Z cap_session=cap-04 send=37 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:54:08Z cap_session=cap-04 send=38 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:54:09Z cap_session=cap-04 send=39 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:54:09Z cap_session=cap-04 send=40 attempt=1 prompt_chars=320176
cap_session_end session=cap-04 stop=max-sends sends=40 total_nano_aiu=31215416000 ai_credits=31.215 limit_event=none last_error=none end_utc=2026-09-25T03:54:10Z
```

### C10 — cap session cap-04 usage and events

```text
cap session=cap-04 max_ai_credits=30 max_sends=40 prompt_kchars=320 token_present=true start_utc=2026-09-25T03:51:30Z
cap session=cap-04 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
cap session=cap-04 quota_before={"quotaSnapshots":{}}
cap session=cap-04 session_created=yes session_id=f35c099c-9c56-4fb6-a75a-5adb65c9d81a
cap session=cap-04 send=1 total_nano_aiu=1349916000 delta_nano_aiu=1349916000 metrics={"totalPremiumRequestCost":1,"tota
cap session=cap-04 send=23 reply=done done_utc=2026-09-25T03:54:04Z
cap session=cap-04 send=23 total_nano_aiu=31215416000 delta_nano_aiu=1341288000 metrics={"totalPremiumRequestCost":23,"t
cap session=cap-04 event type=model.response_limits_status data={"kind":"response_limits_status","turn":0,"status":{"aiCreditsUsed":31.215416,"aiCreditsRemaining":0,"maxAiCredits":30,"isLimitsExhausted":true,"isFinalModelCall":false},"state":"blocked","message":"Session limit reached. Increase or unset the session limit to continue."}
cap session=cap-04 event type=model.turn_failed data={"kind":"turn_failed","model":"mai-code-1.1-flash","model [... rest is modelInfo; the workflow logs at most 500 chars per event, so no error field was captured ...]
cap session=cap-04 send=24 reply= done_utc=2026-09-25T03:54:04Z
cap session=cap-04 send=24 total_nano_aiu=31215416000 delta_nano_aiu=0 metrics={"totalPremiumRequestCost":23,"totalUserR
[... sends 25-40: same shape (reply empty, delta_nano_aiu=0, one model.turn_failed each) elided ...]
cap session=cap-04 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":23,"totalNanoAiu":31215416000,"tokenDetails":{"input":{"tokenCount":1547890},"cache_read":{"tokenCount":37248},"cache_write":{"tokenCount":0},"output":{"tokenCount":1526}},"totalApiDurationMs":145277
cap session=cap-04 quota_after={"quotaSnapshots":{}}
```

### C11 — cap session cap-05 (run 36092350513)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-05 max_ai_credits=30 max_sends=40 prompt_kchars=320`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36092350513

```text
copilot_request_utc=2026-09-25T03:55:56Z cap_session=cap-05 send=1 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:56:03Z cap_session=cap-05 send=2 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:56:10Z cap_session=cap-05 send=3 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:56:36Z cap_session=cap-05 send=4 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:56:41Z cap_session=cap-05 send=5 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:56:48Z cap_session=cap-05 send=6 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T03:56:54Z cap_session=cap-05 send=7 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:56:59Z cap_session=cap-05 send=8 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:57:05Z cap_session=cap-05 send=9 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:57:12Z cap_session=cap-05 send=10 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:57:18Z cap_session=cap-05 send=11 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:57:31Z cap_session=cap-05 send=12 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:57:37Z cap_session=cap-05 send=13 attempt=1 prompt_chars=320178
copilot_request_utc=2026-09-25T03:57:42Z cap_session=cap-05 send=14 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:57:49Z cap_session=cap-05 send=15 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:57:56Z cap_session=cap-05 send=16 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:58:06Z cap_session=cap-05 send=17 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:58:11Z cap_session=cap-05 send=18 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:58:18Z cap_session=cap-05 send=19 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:58:25Z cap_session=cap-05 send=20 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:58:31Z cap_session=cap-05 send=21 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:58:39Z cap_session=cap-05 send=22 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:58:44Z cap_session=cap-05 send=23 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:58:51Z cap_session=cap-05 send=24 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:58:51Z cap_session=cap-05 send=25 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T03:58:51Z cap_session=cap-05 send=26 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:58:52Z cap_session=cap-05 send=27 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:58:52Z cap_session=cap-05 send=28 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:58:52Z cap_session=cap-05 send=29 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T03:58:52Z cap_session=cap-05 send=30 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:58:52Z cap_session=cap-05 send=31 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:58:53Z cap_session=cap-05 send=32 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T03:58:53Z cap_session=cap-05 send=33 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T03:58:54Z cap_session=cap-05 send=34 attempt=1 prompt_chars=320178
copilot_request_utc=2026-09-25T03:58:54Z cap_session=cap-05 send=35 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:58:54Z cap_session=cap-05 send=36 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T03:58:56Z cap_session=cap-05 send=37 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:58:56Z cap_session=cap-05 send=38 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T03:58:57Z cap_session=cap-05 send=39 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T03:58:57Z cap_session=cap-05 send=40 attempt=1 prompt_chars=320173
cap_session_end session=cap-05 stop=max-sends sends=40 total_nano_aiu=31224792000 ai_credits=31.225 limit_event=none last_error=none end_utc=2026-09-25T03:58:58Z
```

### C12 — cap session cap-05 usage and events

```text
cap session=cap-05 max_ai_credits=30 max_sends=40 prompt_kchars=320 token_present=true start_utc=2026-09-25T03:55:56Z
cap session=cap-05 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
cap session=cap-05 quota_before={"quotaSnapshots":{}}
cap session=cap-05 session_created=yes session_id=cd696a37-1ba4-480e-b7ef-64c0dfc138c3
cap session=cap-05 send=1 total_nano_aiu=1358076000 delta_nano_aiu=1358076000 metrics={"totalPremiumRequestCost":1,"tota
cap session=cap-05 send=23 reply=done done_utc=2026-09-25T03:58:51Z
cap session=cap-05 send=23 total_nano_aiu=31224792000 delta_nano_aiu=1351748000 metrics={"totalPremiumRequestCost":23,"t
cap session=cap-05 event type=model.response_limits_status data={"kind":"response_limits_status","turn":0,"status":{"aiCreditsUsed":31.224792,"aiCreditsRemaining":0,"maxAiCredits":30,"isLimitsExhausted":true,"isFinalModelCall":false},"state":"blocked","message":"Session limit reached. Increase or unset the session limit to continue."}
cap session=cap-05 event type=model.turn_failed data={"kind":"turn_failed","model":"mai-code-1.1-flash","model [... rest is modelInfo; the workflow logs at most 500 chars per event, so no error field was captured ...]
cap session=cap-05 send=24 reply= done_utc=2026-09-25T03:58:51Z
cap session=cap-05 send=24 total_nano_aiu=31224792000 delta_nano_aiu=0 metrics={"totalPremiumRequestCost":23,"totalUserR
[... sends 25-40: same shape (reply empty, delta_nano_aiu=0, one model.turn_failed each) elided ...]
cap session=cap-05 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":23,"totalNanoAiu":31224792000,"tokenDetails":{"input":{"tokenCount":1548486},"cache_read":{"tokenCount":36096},"cache_write":{"tokenCount":0},"output":{"tokenCount":1524}},"totalApiDurationMs":153045
cap session=cap-05 quota_after={"quotaSnapshots":{}}
```

Long lines above are cut at a fixed width; the full lines are in the run logs.

PA08.5: the soft cap behaved as the design assumes. In every cap session the limit was checked after a model call
returned: the response that crossed 30 AI credits was billed in full (overshoot 1.188 to 1.709 AI credits, less
than one response), after which the runtime emitted `model.response_limits_status` with `"isLimitsExhausted":true`,
`"state":"blocked"`, "Session limit reached. Increase or unset the session limit to continue.", and every later send
returned an empty reply with `delta_nano_aiu=0` and one `model.turn_failed`. The event is named
`model.response_limits_status`, not `session_limits_exhausted.requested` as the workflow expected, so the
`cap_session_end` lines show `limit_event=none` and `stop=max-sends`. A limit below 30 is refused at
`session.create` ("Minimum session limit is 30 AI credits."), so `maxAiCredits: 1` cannot be configured (C2).

Allowance: after 156.536 AI credits reported across five cap sessions (plus earlier standard prompts), every send
up to each session's limit still got a reply; the allowance was not exhausted in step 2.21 (step 2.22 continues).

### C13 — cap session cap-06 (run 36093046569)

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-cap.yml master session_label=cap-06 max_ai_credits=30 max_sends=40 prompt_kchars=320`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36093046569

```text
copilot_request_utc=2026-09-25T04:06:14Z cap_session=cap-06 send=1 attempt=1 prompt_chars=320176
copilot_request_utc=2026-09-25T04:06:21Z cap_session=cap-06 send=2 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T04:06:27Z cap_session=cap-06 send=3 attempt=1 prompt_chars=320173
copilot_request_utc=2026-09-25T04:06:37Z cap_session=cap-06 send=4 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T04:06:42Z cap_session=cap-06 send=5 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T04:06:48Z cap_session=cap-06 send=6 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T04:06:54Z cap_session=cap-06 send=7 attempt=1 prompt_chars=320170
copilot_request_utc=2026-09-25T04:06:59Z cap_session=cap-06 send=8 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T04:07:06Z cap_session=cap-06 send=9 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T04:07:11Z cap_session=cap-06 send=10 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T04:07:18Z cap_session=cap-06 send=11 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T04:07:25Z cap_session=cap-06 send=12 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T04:07:31Z cap_session=cap-06 send=13 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T04:07:37Z cap_session=cap-06 send=14 attempt=1 prompt_chars=320177
copilot_request_utc=2026-09-25T04:07:43Z cap_session=cap-06 send=15 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T04:07:48Z cap_session=cap-06 send=16 attempt=1 prompt_chars=320175
copilot_request_utc=2026-09-25T04:07:55Z cap_session=cap-06 send=17 attempt=1 prompt_chars=320171
copilot_request_utc=2026-09-25T04:08:01Z cap_session=cap-06 send=18 attempt=1 prompt_chars=320174
copilot_request_utc=2026-09-25T04:08:06Z cap_session=cap-06 send=19 attempt=1 prompt_chars=320172
copilot_request_utc=2026-09-25T04:13:07Z cap_session=cap-06 send=19 attempt=2 prompt_chars=320172
cap_session_end session=cap-06 stop=send-failed-twice sends=20 total_nano_aiu=24445624000 ai_credits=24.446 limit_event=none last_error=You have exceeded your monthly quota (Request ID: 9838:1CBF8A:1C218ED:2014C5D:6AB5F4D4) | undefined end_utc=2026-09-25T04:13:09Z
```

### C14 — cap session cap-06 usage and events

```text
cap session=cap-06 max_ai_credits=30 max_sends=40 prompt_kchars=320 token_present=true start_utc=2026-09-25T04:06:14Z
cap session=cap-06 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"htt
cap session=cap-06 quota_before={"quotaSnapshots":{}}
cap session=cap-06 session_created=yes session_id=8bf28cde-2fc1-4466-94c7-ccf555933918
cap session=cap-06 send=1 reply=done done_utc=2026-09-25T04:06:21Z
cap session=cap-06 send=1 total_nano_aiu=1371720000 delta_nano_aiu=1371720000 metrics={"totalPremiumRequestCost":1,"tota
[... sends 2-17: same shape (reply=done, delta_nano_aiu about 1.35e9 each) elided ...]
cap session=cap-06 send=18 reply=done done_utc=2026-09-25T04:08:06Z
cap session=cap-06 send=18 total_nano_aiu=24445624000 delta_nano_aiu=1349388000 metrics={"totalPremiumRequestCost":18,"t
cap session=cap-06 event type=model.call_failure data={"model":"mai-code-1.1-flash","apiCallId":"00000-9e3be673-ec0d-4a7
cap session=cap-06 event type=model.model_call_failure data={"kind":"model_call_failure","turn":0,"modelCallDurationMs":
[... model.call_finished and related events elided ...]
cap session=cap-06 event type=session.error data={"errorType":"quota","message":"You have exceeded your monthly quota (R
cap session=cap-06 send=19 attempt=1 error=You have exceeded your monthly quota (Request ID: 983D:1E6111:21A9D1E:258F586
cap session=cap-06 send=19 waiting_s=300 before the single retry
cap session=cap-06 event type=model.call_failure data={"model":"mai-code-1.1-flash","apiCallId":"00000-ee32dfe7-cc41-482
cap session=cap-06 event type=model.model_call_failure data={"kind":"model_call_failure","turn":0,"modelCallDurationMs":
cap session=cap-06 event type=session.error data={"errorType":"quota","message":"You have exceeded your monthly quota (R
cap session=cap-06 send=19 attempt=2 error=You have exceeded your monthly quota (Request ID: 9838:1CBF8A:1C218ED:2014C5D
cap session=cap-06 event type=assistant.idle data={}
cap session=cap-06 event type=session.idle data={"mode":"interactive"}
cap session=cap-06 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":18,"totalNanoAiu":2
cap session=cap-06 quota_after={"quotaSnapshots":{}}
```

Long lines above are cut at a fixed width; the full lines are in the run logs. The quota failure, verbatim:
`model_call_failure` `"status":402,"error":"{\"message\":\"You have exceeded your monthly quota\",\"code\":\"quota_exceeded\"}"`;
`session.error` `{"errorType":"quota","message":"You have exceeded your monthly quota (Request ID: 983D:1E6111:21A9D1E:258F586:6AB5F3A7)","statusCode":402,...,"errorCode":"quota_exceeded"}`.

Stop reason `allowance-exhausted`: send 19 failed twice, 5 minutes apart (04:08:06Z and 04:13:07Z), with text
naming the monthly quota. Sends 1–18 replied and billed 24.446 AI credits, below the 30-credit session limit, so
no session limit event occurred in this session; PA08.5 rests on C3–C12 unchanged.

### C15 — post-cap PA08.6 reads

Both reads taken after the allowance was exhausted (C13).

Command: `bash probes/smoke/tools/dispatch.sh jambolo/patch-steward-testbed-personal probe-pa08-infer.yml master mode=detect`
Run URL: https://github.com/jambolo/patch-steward-testbed-personal/actions/runs/36093589258 (success, no inference)

```text
job=detect auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
job=detect quota_before={"quotaSnapshots":{}}
job=detect quota_after={"quotaSnapshots":{}}
job=detect copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}
job=detect-noperm auth_status={"isAuthenticated":true,"authType":"env",...} quota_before/quota_after={"quotaSnapshots":{}}
job=detect-noperm copilot_internal_user exit=1 (HTTP 403 "Resource not accessible by integration")
```

Local read at 2026-09-25T04:14:44Z:
`gh api copilot_internal/user --jq '{login, copilot_plan, access_type_sku, chat_enabled, quota_reset_date}'`

```text
{"access_type_sku":"free_limited_copilot","chat_enabled":true,"copilot_plan":"individual","login":"jambolo","quota_reset_date":"2026-10-01"}
```

With the allowance exhausted, the job token still authenticates, `getQuota` still reports no snapshot entries, and
the user endpoint still reports `chat_enabled` true: none of these reads exposes the exhausted state.

## Deviations from the design

None.

## Residue

- The deployed workflow `.github/workflows/probe-pa08-infer.yml` (blob 10a2c9888479264103b30838fe9e7efafd9c7d47)
  remains on `jambolo/patch-steward-testbed-personal` master (dispatch-only; Phase 3 disables it).
- Runs left on the test-bed: 36081190382 (detect, pre-fix, failure), 36081314986 (detect, fixed sdk-setup was not
  yet deployed, still auth-less), 36081358716 (cli, success), 36081401088 (sdk, defective sdk-setup, failure),
  36081467518 (omit-cli, success), 36081558548 (omit-sdk, defective sdk-setup, failure), 36089680498 (detect,
  step 2.26, success), 36089721123 (sdk, step 2.26, success), 36089762284 (omit-sdk, step 2.26, failure).
- Copilot requests spent against jambolo's Copilot Free allowance: 4 by step 2.8 (1 CLI prompt billed "1 Premium
  (1s)", 3 further attempts that did not reach a model and billed nothing observable); 3 by step 2.26 (2 SDK
  sends billed `totalPremiumRequests` 1 then 2 / `totalNanoAiu` 33640000 then 40552000, 1 SDK omit-send that
  failed at the model-call layer with HTTP 401 and billed nothing observable).
- The deployed cap workflow `.github/workflows/probe-pa08-cap.yml` (blob f2c4d4bcec28c865e7680f554717f9b1351941bd)
  remains on `jambolo/patch-steward-testbed-personal` master (dispatch-only; Phase 3 disables it). Runs left:
  36091208989 (probe), 36091247802 (cap-01), 36091504726 (cap-02), 36091740507 (cap-03), 36092050346 (cap-04),
  36092350513 (cap-05), all success; 36093046569 (cap-06, step 2.22, success, stopped on the quota error),
  36093589258 (detect, step 2.22, success).
- Allowance state: exhausted until 2026-10-01T00:00:00Z (6 of 10 cap sessions and 220 of 405 cap-chain sends used;
  180.982 AI credits reported by the cap sessions; C13, C15).
