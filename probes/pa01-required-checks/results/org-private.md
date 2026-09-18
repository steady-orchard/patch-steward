# PA01 — Required checks — org-private

- assumption: PA01
- test-bed: steady-orchard/patch-steward-testbed-private
- probed: 2026-09-25T01:14:56Z to 2026-09-25T01:14:56Z (no new attempt; the refusal is Phase 1 evidence T8)
- step: 2.10
- workflows: none (no attempt: the capability is unavailable on this test-bed)

## Results

| Sub-claim | Kind        | Result       | Cause            | Evidence |
| --------- | ----------- | ------------ | ---------------- | -------- |
| PA01.1    | assumption  | undetermined | plan-unavailable | T8, E1   |
| PA01.2    | assumption  | undetermined | plan-unavailable | T8, E1   |
| PA01.3    | assumption  | undetermined | plan-unavailable | T8, E1   |
| PA01.4    | assumption  | undetermined | plan-unavailable | T8, E1   |
| PA01.5    | assumption  | undetermined | plan-unavailable | T8, E1   |
| PA01.6    | assumption  | undetermined | plan-unavailable | T8, E1   |
| PA01.7    | measurement | undetermined | plan-unavailable | T8, E1   |

## Measurements

| Sub-claim | Quantity | Value | Unit | Method | Samples |
| --------- | -------- | ----- | ---- | ------ | ------- |

## Evidence

### E1 — ruleset-required-check refused on org-private (copied from probes/testbeds.md T8)

Source: probes/testbeds.md, heading T8.

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-private probe-canary
CANARY begin=ruleset-required-check
CANARY call=create-ruleset name=probe-canary-required-check
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset","status":"403"}gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
CANARY call=create-ruleset exit=1
CANARY end=ruleset-required-check
CAPABILITY ruleset-required-check outcome=refused
```

## Deviations from the design

None.

## Residue

None (no fixture was created on this test-bed).
