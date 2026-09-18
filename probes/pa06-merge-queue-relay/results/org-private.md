# PA06 — Merge-queue relay — org-private

- assumption: PA06
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T01:14:56Z to 2026-09-25T01:14:56Z (no new attempt; the refusal is Phase 1 evidence T9)
- step: 2.10
- workflows: none (no attempt: the capability is unavailable on this test-bed)

## Results

| Sub-claim | Kind        | Result       | Cause            | Evidence |
| --------- | ----------- | ------------ | ---------------- | -------- |
| PA06.1    | assumption  | undetermined | plan-unavailable | T9, E1   |
| PA06.2    | assumption  | undetermined | plan-unavailable | T9, E1   |
| PA06.3    | assumption  | undetermined | plan-unavailable | T9, E1   |
| PA06.4    | assumption  | undetermined | plan-unavailable | T9, E1   |
| PA06.5    | measurement | undetermined | plan-unavailable | T9, E1   |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — ruleset-merge-queue refused on org-private (copied from probes/testbeds.md T9)

Source: probes/testbeds.md, heading T9.

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-private probe-canary
CANARY begin=ruleset-merge-queue
CANARY call=create-ruleset name=probe-canary-merge-queue
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset","status":"403"}gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
CANARY call=create-ruleset exit=1
CANARY end=ruleset-merge-queue
CAPABILITY ruleset-merge-queue outcome=refused
```

## Deviations from the design

None.

## Residue

None (no fixture was created on this test-bed).
