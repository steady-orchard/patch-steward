# PA08 — Copilot inference in Actions — org-public

- assumption: PA08
- test-bed: steady-orchard/patch-steward-testbed-public
- probed: 2026-09-25T03:27:11Z to 2026-09-25T03:29:17Z
- step: 2.19
- workflows: probe-pa08-infer.yml 10a2c9888479264103b30838fe9e7efafd9c7d47

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence       |
| --------- | ----------- | --------- | ----- | -------------- |
| PA08.2    | assumption  | refuted   | none  | E1, R3, R4     |
| PA08.3    | measurement | confirmed | none  | E1, R2, R3, R4 |
| PA08.6    | measurement | confirmed | none  | R1, R5         |

## Measurements

| Sub-claim | Quantity                                       | Value                                                                                                                                                                                                                                                                                                                                                         | Unit    | Method | Samples |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ------- |
| PA08.3    | omit-cli outcome                               | cli-omit exit=1, "Error: Authentication failed", names no allowance/quota/credits/plan-limit                                                                                                                                                                                                                                                                  | -       | R2     | 1       |
| PA08.3    | cli outcome                                    | cli exit=1, "Error: Access denied by policy settings" ("Your organization has restricted Copilot access" / "Your Copilot subscription does not include this feature" / "Required policies have not been enabled by your administrator"); names a policy, distinct from R2's authentication-failure text, not transient/rate-limit wording                     | -       | R3     | 1       |
| PA08.3    | sdk outcome                                    | sdk send=1: model.call_failure statusCode=403 "403 Forbidden"; session.error errorType=authorization, message "Authorization error. Your credentials may be expired or invalid.", remediation sign_in; names no allowance/quota/credits/plan-limit; distinct statusCode/text from R3's cli failure                                                            | -       | R4     | 1       |
| PA08.3    | standard prompts spent (step 2.19)             | 3                                                                                                                                                                                                                                                                                                                                                             | prompts | E1     | -       |
| PA08.6    | job token auth status                          | {"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}                                                                                                                                                                                                       | -       | R1     | -       |
| PA08.6    | job token auth status without copilot-requests | {"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}                                                                                                                                                                                                       | -       | R1     | -       |
| PA08.6    | job token getQuota                             | {"quotaSnapshots":{}} (before and after)                                                                                                                                                                                                                                                                                                                      | -       | R1     | -       |
| PA08.6    | job token getQuota without copilot-requests    | {"quotaSnapshots":{}} (before and after)                                                                                                                                                                                                                                                                                                                      | -       | R1     | -       |
| PA08.6    | job token copilot_internal/user                | error (both detect and detect-noperm: HTTP 403 "Resource not accessible by integration")                                                                                                                                                                                                                                                                      | -       | R1     | -       |
| PA08.6    | user token orgs/steady-orchard/copilot/billing | {"seat_breakdown":{"pending_invitation":0,"pending_cancellation":0,"added_this_cycle":0,"total":0,"active_this_cycle":0,"inactive_this_cycle":0},"seat_management_setting":"unconfigured","plan_type":"business","public_code_suggestions":"allow","ide_chat":"enabled","cli":"unconfigured","platform_chat":"enabled"}; seats endpoint reports total_seats=0 | -       | R5     | -       |
| PA08.6    | user token copilot_internal/user               | ok (200; reflects the local user jambolo's own individual plan, not the organization — see R5)                                                                                                                                                                                                                                                                | -       | R5     | -       |

## Evidence

### E1 — every Copilot request sent by step 2.19

```text
job=cli-omit copilot_request_utc=2026-09-25T03:27:56Z client=cli
job=cli copilot_request_utc=2026-09-25T03:28:31Z client=cli
copilot_request_utc=2026-09-25T03:29:15Z client=sdk send=1
```

### R1 — detect run, run 36090413163

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa08-infer.yml master mode=detect`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36090413163

```text
detect-noperm PROBE-PA08 job=detect-noperm sdk_version=1.0.14
detect-noperm PROBE-PA08 job=detect-noperm start_utc=2026-09-25T03:27:24Z
detect-noperm PROBE-PA08 sdk mode=quota sends=1 token_present=true node=v24.21.0
detect-noperm PROBE-PA08 client_started=yes
detect-noperm PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
detect-noperm PROBE-PA08 quota_before={"quotaSnapshots":{}}
detect-noperm PROBE-PA08 quota_after={"quotaSnapshots":{}}
detect-noperm PROBE-PA08 sdk done utc=2026-09-25T03:27:24Z
detect-noperm PROBE-PA08 job=detect-noperm copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}gh: Resource not accessible by integration (HTTP 403)
detect PROBE-PA08 job=detect sdk_version=1.0.14
detect PROBE-PA08 job=detect start_utc=2026-09-25T03:27:20Z
detect PROBE-PA08 sdk mode=quota sends=1 token_present=true node=v24.21.0
detect PROBE-PA08 client_started=yes
detect PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
detect PROBE-PA08 quota_before={"quotaSnapshots":{}}
detect PROBE-PA08 quota_after={"quotaSnapshots":{}}
detect PROBE-PA08 sdk done utc=2026-09-25T03:27:20Z
detect PROBE-PA08 job=detect copilot_internal_user exit=1 response={"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest","status":"403"}gh: Resource not accessible by integration (HTTP 403)
```

Both `detect` and `detect-noperm` job `GITHUB_TOKEN`s authenticate the SDK runtime itself (`isAuthenticated:true`,
`authType:env`, via `COPILOT_GITHUB_TOKEN`) with and without `copilot-requests: write` — the SDK legs are valid
(gate satisfied). `getQuota` reports an empty `quotaSnapshots` object either way, and the REST `copilot_internal/user`
call 403s for the job token regardless of the permission scope.

### R2 — omit-cli run, run 36090451545

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa08-infer.yml master mode=omit-cli`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36090451545

```text
cli-omit PROBE-PA08 job=cli-omit copilot_cli_version=GitHub Copilot CLI 1.0.88.
cli-omit PROBE-PA08 job=cli-omit copilot_exit=1
cli-omit PROBE-PA08 copilot_stderr: Error: Authentication failed (Request ID: EC10:1E9C74:65658D:85F8EA:6AB5EA3D)
cli-omit PROBE-PA08 copilot_stderr:
cli-omit PROBE-PA08 copilot_stderr: Your GitHub token may be invalid, expired, or lacking the required permissions.
cli-omit PROBE-PA08 copilot_stderr:
cli-omit PROBE-PA08 copilot_stderr: To resolve this, try the following:
cli-omit PROBE-PA08 copilot_stderr:   • Start 'copilot' and run the '/login' command to re-authenticate
cli-omit PROBE-PA08 copilot_stderr:   • If using a Fine-Grained PAT, ensure it has the 'Copilot Requests' permission enabled
cli-omit PROBE-PA08 copilot_stderr:   • If using COPILOT_GITHUB_TOKEN, GH_TOKEN or GITHUB_TOKEN environment variable, verify the token is valid and not expired
cli-omit PROBE-PA08 copilot_stderr:   • Run 'gh auth status' to check your current authentication status
cli-omit PROBE-PA08 job=cli-omit copilot_done_utc=2026-09-25T03:27:57Z
```

Without `copilot-requests: write`, the CLI exits 1 with "Authentication failed" and points at the missing
permission scope — a clean, distinguishable entitlement/authorization failure, not a rate limit or transient
error, and textually distinct from R3's and R4's failures.

### R3 — cli run, run 36090488535

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa08-infer.yml master mode=cli`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36090488535

```text
cli PROBE-PA08 job=cli copilot_cli_version=GitHub Copilot CLI 1.0.88.
cli PROBE-PA08 job=cli copilot_exit=1
cli PROBE-PA08 copilot_stderr: Error: Access denied by policy settings (Request ID: CC23:32832A:1DCAE7F:215E53E:6AB5EA5F)
cli PROBE-PA08 copilot_stderr:
cli PROBE-PA08 copilot_stderr: Your Copilot CLI policy setting may be preventing access. This can happen when:
cli PROBE-PA08 copilot_stderr:   • Your organization has restricted Copilot access
cli PROBE-PA08 copilot_stderr:   • Your Copilot subscription does not include this feature
cli PROBE-PA08 copilot_stderr:   • Required policies have not been enabled by your administrator
cli PROBE-PA08 copilot_stderr:
cli PROBE-PA08 copilot_stderr: To resolve this, visit your Copilot settings: https://github.com/settings/copilot
cli PROBE-PA08 job=cli copilot_done_utc=2026-09-25T03:28:32Z
```

With `copilot-requests: write` granted, the CLI still exits 1, now with "Access denied by policy settings",
naming organization Copilot-access restriction, subscription scope, and administrator-enabled policies — this is
the PD03 failure shape (a policy/entitlement error, not an authentication or rate-limit error): distinct text
from R2's "Authentication failed" (which names a missing permission, not a policy).

### R4 — sdk run, run 36090536212

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-public probe-pa08-infer.yml master mode=sdk sends=1`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36090536212

```text
sdk PROBE-PA08 job=sdk sdk_version=1.0.14
sdk PROBE-PA08 job=sdk start_utc=2026-09-25T03:29:15Z
sdk PROBE-PA08 sdk mode=send sends=1 token_present=true node=v24.21.0
sdk PROBE-PA08 client_started=yes
sdk PROBE-PA08 auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
sdk PROBE-PA08 quota_before={"quotaSnapshots":{}}
sdk PROBE-PA08 session_id=8d5ddbc8-843c-497e-9418-a956b3d09a22
[... 12 lines of session/tool-loading and system-message events elided (request line in E1) ...]
sdk PROBE-PA08 event type=model.turn_started data={"kind":"turn_started","model":"claude-sonnet-4", ...}
sdk PROBE-PA08 event type=model.call_start data={"turnId":"0","model":"claude-sonnet-4"}
sdk PROBE-PA08 event type=model.model_call_started data={"kind":"model_call_started","model":"claude-sonnet-4", ...}
sdk PROBE-PA08 event type=model.call_failure data={"model":"claude-sonnet-4","providerCallId":"5008:549D8:1A0AB15:1DA06D9:6AB5EA8C","serviceRequestId":"e3d95983-cc4f-4b60-bcec-76de454550ad","statusCode":403,"durationMs":199,"apiEndpoint":"/chat/completions","transport":"http","failureKind":"api","isByok":false,"isAuto":false,"interactionType":"conversation-agent","rte":false,"source":"top_level","errorMessage":"\"403 Forbidden\"", ...}
sdk PROBE-PA08 event type=model.model_call_failure data={"kind":"model_call_failure","turn":0,"modelCallDurationMs":199,"modelCall":{"model":"claude-sonnet-4","status":403,"error":"\"403 Forbidden\"","request_id":"5008:549D8:1A0AB15:1DA06D9:6AB5EA8C","api_endpoint":"/chat/completions","transport":"http","failure_kind":"api","service_request_id":"e3d95983-cc4f-4b60-bcec-76de454550ad","rte":false},"rte":false}
sdk PROBE-PA08 event type=model.call_finished data={"turnId":"0","dispatchDurationMs":199,"outcome":"error", ...}
sdk PROBE-PA08 event type=model.turn_failed data={"kind":"turn_failed","model":"claude-sonnet-4", ...,"error":"403 Forbidden"}
sdk PROBE-PA08 event type=model.turn_ended data={"kind":"turn_ended","model":"claude-sonnet-4", ...}
sdk PROBE-PA08 event type=assistant.turn_end data={"turnId":"0"}
sdk PROBE-PA08 event type=session.error data={"errorType":"authorization","message":"Authorization error. Your credentials may be expired or invalid. (Request ID: 5008:549D8:1A0AB15:1DA06D9:6AB5EA8C)","statusCode":403,"providerCallId":"5008:549D8:1A0AB15:1DA06D9:6AB5EA8C","serviceRequestId":"e3d95983-cc4f-4b60-bcec-76de454550ad","remediation":"sign_in"}
sdk PROBE-PA08 send=1 error=Authorization error. Your credentials may be expired or invalid. (Request ID: 5008:549D8:1A0AB15:1DA06D9:6AB5EA8C) | undefined
sdk PROBE-PA08 event type=assistant.idle data={}
sdk PROBE-PA08 event type=session.idle data={"mode":"interactive"}
sdk PROBE-PA08 event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":0,"totalNanoAiu":0,"totalApiDurationMs":0,"sessionStartTime":1790306955944,"eventsFileSizeBytes":9815,"codeChanges":{"linesAdded":0,"linesRemoved":0,"filesModified":[]},"modelMetrics":{},"currentTokens":1913,"systemTokens":1863,"conversationTokens":46,"toolDefinitionsTokens":0}
sdk PROBE-PA08 quota_after={"quotaSnapshots":{}}
sdk PROBE-PA08 sdk done utc=2026-09-25T03:29:17Z
```

The SDK server itself authenticates (`auth_status` shows `isAuthenticated:true`) and starts a session, routing
to `claude-sonnet-4`, but the model call fails with HTTP 403 and `session.error` `errorType:authorization`,
"Authorization error. Your credentials may be expired or invalid." No allowance, quota, credits, or plan-limit
wording appears; no `model.call_failure` retry attempt is logged (unlike E11 in results/personal.md, which shows
3 attempts) — a single failed attempt here. `totalPremiumRequests=0` and `totalNanoAiu=0` show nothing was
billed. This is a distinct failure text and status code from R3's cli "Access denied by policy settings".

### R5 — local reads (PA08.6)

Command: `gh api orgs/steady-orchard/copilot/billing`

```text
{"seat_breakdown":{"pending_invitation":0,"pending_cancellation":0,"added_this_cycle":0,"total":0,"active_this_cycle":0,"inactive_this_cycle":0},"seat_management_setting":"unconfigured","plan_type":"business","public_code_suggestions":"allow","ide_chat":"enabled","cli":"unconfigured","platform_chat":"enabled"}
```

Command: `gh api orgs/steady-orchard/copilot/billing/seats --jq '{total_seats}'`

```text
{"total_seats":0}
```

Command: `gh api copilot_internal/user --jq '{login, copilot_plan, access_type_sku, chat_enabled, quota_reset_date}'`

```text
{"access_type_sku":"free_limited_copilot","chat_enabled":true,"copilot_plan":"individual","login":"jambolo","quota_reset_date":"2026-10-01"}
```

The local `admin:org` user token reads the organization's Copilot billing state in full: `plan_type: business`,
`cli: unconfigured` (matching the design's predicted "Allow use of Copilot CLI billed to the organization" policy
being unset), and 0 total seats. The `copilot_internal/user` endpoint reflects the authenticated local user
(jambolo) rather than the organization, returning jambolo's own individual plan — it is not an organization-scoped
read, so it adds no organization-level signal beyond confirming the endpoint's per-user scope.

## Deviations from the design

PA08.2 refuted: `docs/architecture.md` §6.3, `copilot-sdk` row: "Organization-owned repositories bill the
organization under the Copilot policy "Allow use of Copilot CLI billed to the organization"; personally owned
repositories bill the repository owner's Copilot seat." and PD03's assumption as stated in PA08.2 ("on the
organization-owned test-beds, without Copilot seats or organization billing, the same job succeeds"). Observed:
on `steady-orchard/patch-steward-testbed-public` (no Copilot seats, `cli: unconfigured` per R5), both the cli job
(with `copilot-requests: write`) and the sdk job (with `copilot-requests: write`) failed to obtain a reply — cli
with "Access denied by policy settings" naming organization Copilot-access restriction, subscription scope, and
administrator-enabled policies (R3); sdk with HTTP 403 "Authorization error" (R4). Neither failure is transient
or a rate limit; the cli failure names a policy, which is the PD03 failure shape the design predicted.

## Residue

- The deployed workflow `.github/workflows/probe-pa08-infer.yml` (blob 10a2c9888479264103b30838fe9e7efafd9c7d47)
  remains on `steady-orchard/patch-steward-testbed-public` master (dispatch-only; Phase 3 disables it).
- Runs left on the test-bed: 36090413163 (detect, success), 36090451545 (omit-cli, success run / cli-omit job
  failure as designed), 36090488535 (cli, success run / cli job failure — policy denial), 36090536212 (sdk,
  success run / sdk job failure — 403 authorization).
- Copilot requests spent against steady-orchard's Copilot CLI billing: 3 (1 CLI prompt without
  `copilot-requests: write`, billed nothing observable and blocked at authentication; 1 CLI prompt with
  `copilot-requests: write`, blocked by organization policy before reaching the model, billed nothing observable;
  1 SDK send, blocked at the model-call layer with HTTP 403, billed nothing observable — `totalPremiumRequests=0`,
  `totalNanoAiu=0`).
