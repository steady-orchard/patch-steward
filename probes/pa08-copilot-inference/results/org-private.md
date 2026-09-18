# PA08 — Copilot inference in Actions — org-private

- assumption: PA08
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T03:27:27Z to 2026-09-25T03:28:39Z
- step: 2.20
- workflows: probe-pa08-infer.yml 10a2c9888479264103b30838fe9e7efafd9c7d47

## Results

| Sub-claim | Kind        | Result    | Cause | Evidence   |
| --------- | ----------- | --------- | ----- | ---------- |
| PA08.2    | assumption  | refuted   | none  | E1, R1, R2 |
| PA08.3    | measurement | confirmed | none  | E1, R1, R2 |

## Measurements

| Sub-claim | Quantity                           | Value                                                                                                                                                                                                                                                          | Unit    | Method | Samples |
| --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ------- |
| PA08.3    | omit-cli outcome                   | cli-omit exit=1, "Error: Authentication failed", names no allowance/quota/credits/plan-limit                                                                                                                                                                   | -       | R1     | 1       |
| PA08.3    | cli outcome                        | cli exit=1, "Error: Access denied by policy settings", names the org's Copilot CLI policy explicitly, not allowance/quota/credits/plan-limit                                                                                                                   | -       | R1     | 1       |
| PA08.3    | sdk outcome                        | sdk send=1 failed: `model.call_failure` statusCode=403 "403 Forbidden", `session.error` errorType=authorization, message "Authorization error. Your credentials may be expired or invalid." (remediation sign_in); names no allowance/quota/credits/plan-limit | -       | R2     | 1       |
| PA08.3    | standard prompts spent (step 2.20) | 3                                                                                                                                                                                                                                                              | prompts | E1     | -       |

## Evidence

### E1 — every Copilot request sent by step 2.20

```text
job=cli-omit copilot_request_utc=2026-09-25T03:27:27Z client=cli
job=cli copilot_request_utc=2026-09-25T03:27:59Z client=cli
copilot_request_utc=2026-09-25T03:28:38Z client=sdk send=1
```

### R1 — omit-cli and cli runs, run 36090416616 and run 36090453864

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-private probe-pa08-infer.yml master mode=omit-cli`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36090416616

```text
job=cli-omit copilot_cli_version=GitHub Copilot CLI 1.0.88.
job=cli-omit copilot_exit=1
copilot_stderr: Error: Authentication failed (Request ID: 6430:1625D8:1EBF42A:224FFB7:6AB5EA20)
copilot_stderr: Your GitHub token may be invalid, expired, or lacking the required permissions.
copilot_stderr: To resolve this, try the following:
copilot_stderr:   • Start 'copilot' and run the '/login' command to re-authenticate
copilot_stderr:   • If using a Fine-Grained PAT, ensure it has the 'Copilot Requests' permission enabled
copilot_stderr:   • If using COPILOT_GITHUB_TOKEN, GH_TOKEN or GITHUB_TOKEN environment variable, verify the token is valid and not expired
copilot_stderr:   • Run 'gh auth status' to check your current authentication status
job=cli-omit copilot_done_utc=2026-09-25T03:27:29Z
```

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-private probe-pa08-infer.yml master mode=cli`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36090453864

```text
job=cli copilot_cli_version=GitHub Copilot CLI 1.0.88.
job=cli copilot_exit=1
copilot_stderr: Error: Access denied by policy settings (Request ID: F421:897FF:1EB33BE:2244CE6:6AB5EA41)
copilot_stderr: Your Copilot CLI policy setting may be preventing access. This can happen when:
copilot_stderr:   • Your organization has restricted Copilot access
copilot_stderr:   • Your Copilot subscription does not include this feature
copilot_stderr:   • Required policies have not been enabled by your administrator
copilot_stderr: To resolve this, visit your Copilot settings: https://github.com/settings/copilot
job=cli copilot_done_utc=2026-09-25T03:28:01Z
```

Without `copilot-requests: write` (cli-omit), the CLI exits 1 with "Authentication failed" naming the missing
permission scope, the same shape as `personal` (E1/R5 there). With the permission granted (cli), on this
organization-owned, seatless, billing-unconfigured test-bed the CLI instead exits 1 with "Access denied by
policy settings", naming the organization's Copilot policy explicitly — a different, distinguishable failure
from the omit-cli permission error, from a transient error, and from a rate limit; it names no allowance, quota,
credits, or plan limit.

### R2 — sdk run, run 36090494181

Command: `bash probes/smoke/tools/dispatch.sh steady-orchard/patch-steward-testbed-private probe-pa08-infer.yml master mode=sdk sends=1`
Run URL: https://github.com/steady-orchard/patch-steward-testbed-private/actions/runs/36090494181

```text
job=sdk sdk_version=1.0.14
job=sdk start_utc=2026-09-25T03:28:37Z
sdk mode=send sends=1 token_present=true node=v24.21.0
client_started=yes
auth_status={"isAuthenticated":true,"authType":"env","host":"https://github.com","statusMessage":"https://github.com (via COPILOT_GITHUB_TOKEN, server-to-server)"}
quota_before={"quotaSnapshots":{}}
session_id=b64c49ab-1d18-4302-9fd5-ad48283538be
event type=model.turn_started data={"kind":"turn_started","model":"claude-sonnet-4", ...}
event type=model.call_start data={"turnId":"0","model":"claude-sonnet-4"}
event type=model.call_failure data={"model":"claude-sonnet-4","statusCode":403,"errorMessage":"\"403 Forbidden\"", ...}
event type=model.call_finished data={"turnId":"0","outcome":"error", ...}
event type=model.model_call_failure data={"kind":"model_call_failure","turn":0,"modelCall":{"model":"claude-sonnet-4","status":403,"error":"\"403 Forbidden\""}, ...}
event type=model.turn_failed data={"kind":"turn_failed","model":"claude-sonnet-4","error":"403 Forbidden"}
event type=session.error data={"errorType":"authorization","message":"Authorization error. Your credentials may be expired or invalid. (Request ID: CBC1:1DDFF6:1EB19EE:2244813:6AB5EA66)","statusCode":403,"remediation":"sign_in"}
send=1 error=Authorization error. Your credentials may be expired or invalid. (Request ID: CBC1:1DDFF6:1EB19EE:2244813:6AB5EA66) | undefined
event type=session.shutdown data={"shutdownType":"routine","totalPremiumRequests":0,"totalNanoAiu":0,"totalApiDurationMs":0, ...}
quota_after={"quotaSnapshots":{}}
sdk done utc=2026-09-25T03:28:39Z
```

The sdk job's `auth_status=` line shows `"isAuthenticated":true`, so the SDK leg ran as designed. The SDK server
itself authenticates and starts a session, auto-routing to `claude-sonnet-4`, but the model call fails at HTTP 403
with `session.error` `errorType:authorization`, "Authorization error. Your credentials may be expired or invalid.";
`totalPremiumRequests=0`/`totalNanoAiu=0` show nothing was billed. This names no allowance, quota, credits, or plan
limit, and is not a rate-limit message; combined with R1's cli policy denial, both the cli and sdk clients failed
on org-private with errors that are neither transient nor a rate limit.

## Deviations from the design

Per docs/architecture.md §6.3, `copilot-sdk` row: "Organization-owned repositories bill the organization under the
Copilot policy "Allow use of Copilot CLI billed to the organization"; personally owned repositories bill the
repository owner's Copilot seat." PD03 assumed (as stated in PA08.2) that on the organization-owned test-beds,
without Copilot seats or organization billing, the same job succeeds. Observed: on org-private (no Copilot seats,
unconfigured Copilot CLI billing policy), the cli leg failed with "Access denied by policy settings" naming the
org's Copilot policy directly, and the sdk leg failed at the model-call layer with a 403 authorization error;
neither leg produced a reply. This refutes PD03's assumption for this test-bed.

## Residue

- The deployed workflow `.github/workflows/probe-pa08-infer.yml` (blob 10a2c9888479264103b30838fe9e7efafd9c7d47)
  remains on `steady-orchard/patch-steward-testbed-private` master (dispatch-only; Phase 3 disables it).
- Runs left on the test-bed: 36090416616 (omit-cli, failure), 36090453864 (cli, failure), 36090494181 (sdk,
failure).
</content>
