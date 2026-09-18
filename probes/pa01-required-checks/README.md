# PA01 — Required checks

Probe suite for PA01 (required checks): whether a ruleset requiring a status check name from a specific App
evaluates only the latest check run with that name from that App on the head commit, and what conclusions and
sources satisfy or block the requirement.

## Sub-claims

| ID     | Kind        | Text                                                                                                                                                                                                                                                                   |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA01.1 | assumption  | With a ruleset on the PR's target branch requiring a status check name with the test App (integration id 4993303) as expected source, GitHub evaluates the most recently created check run with that name from that App on the head commit; earlier ones stop counting |
| PA01.2 | assumption  | A latest check run concluded `neutral` satisfies the requirement (the PR becomes mergeable)                                                                                                                                                                            |
| PA01.3 | assumption  | After an earlier `success`, a new `in_progress` check run with the same name from the same App on the same commit withdraws mergeability until it completes                                                                                                            |
| PA01.4 | assumption  | A latest conclusion `action_required` does not satisfy the requirement                                                                                                                                                                                                 |
| PA01.5 | assumption  | A latest conclusion `cancelled` does not satisfy the requirement; completing an OLDER run as `cancelled` after a newer run exists does not change which run GitHub evaluates                                                                                           |
| PA01.6 | assumption  | A check run with the required name from a different source (the job `GITHUB_TOKEN`, app `github-actions`) does not satisfy a requirement bound to the test App's integration id                                                                                        |
| PA01.7 | measurement | Effect of latest conclusions `failure`, `skipped`, and `timed_out`; latency from a check-run write to the PR's merge-state change                                                                                                                                      |

## Fixtures

- Branches `probe-pa01-base` and `probe-pa01-head-1`.
- Ruleset `probe-pa01-required` on exactly `refs/heads/probe-pa01-base`.
- PR `[probe PA01] required-check target`, head `probe-pa01-head-1`, base `probe-pa01-base` (closed after each run).
- Check runs named `probe-pa01/required`.
- App commits on the head.

## Deployment list

- probe-pa01-sequence.yml: org-public, personal

## Procedure

From the worktree root, `<tb>` is the test-bed repository, `<W>` is the worktree root, `<N>` is the PR number, and
`<id>` is a run id.

1. Lint the canonical files already in `probes/pa01-required-checks/` ([ADR-0023](../../docs/adr/0023-probe-suite-location.md)):

   ```text
   actionlint -ignore 'unknown permission scope "copilot-requests"' <W>/probes/pa01-required-checks/workflows/probe-pa01-sequence.yml
   ```

2. Deploy (each one standalone call):

   ```text
   bash probes/smoke/tools/deploy.sh <tb> master "probe(PA01): deploy probe-pa01-sequence.yml" <W>/probes/pa01-required-checks/workflows/probe-pa01-sequence.yml
   bash probes/smoke/tools/deploy.sh <tb> probe-pa01-base "probe(PA01): base branch marker" <W>/probes/pa01-required-checks/fixtures/base.txt:probe-pa01/base.txt
   bash probes/smoke/tools/deploy.sh <tb> probe-pa01-head-1 "probe(PA01): head branch marker" <W>/probes/pa01-required-checks/fixtures/head.txt:probe-pa01/head.txt
   ```

3. Ruleset, create-or-reuse:

   ```text
   gh api repos/<tb>/rulesets --jq '.[] | select(.name == "probe-pa01-required") | .id'
   gh api repos/<tb>/rulesets -X POST --input <W>/probes/pa01-required-checks/fixtures/ruleset-required.json --jq '{id, name, enforcement}'
   gh api repos/<tb>/rulesets/<rid> --jq '{id, name, enforcement, include: .conditions.ref_name.include, rules: [.rules[] | {type, parameters}]}'
   ```

4. PR, create-or-reuse:

   ```text
   gh api "repos/<tb>/pulls?state=all&head=steady-orchard:probe-pa01-head-1&base=probe-pa01-base" --jq '.[] | "\(.number) \(.state)"'
   gh api repos/<tb>/pulls/<N> -X PATCH -f state=open --jq .state
   gh api repos/<tb>/pulls -X POST -f title='[probe PA01] required-check target' -f head=probe-pa01-head-1 -f base=probe-pa01-base -f body='Probe PA01 fixture PR; never merged.' --jq .number
   ```

5. Dispatch and wait:

   ```text
   bash probes/smoke/tools/dispatch.sh <tb> probe-pa01-sequence.yml master pr=<N>
   bash probes/smoke/tools/wait-run.sh <tb> <id>
   ```

6. Collect:

   ```text
   gh run view <id> -R <tb> --log | grep -a "PROBE-PA01 " | sed -E 's/^.*(PROBE-PA01 )/\1/'
   gh api repos/<tb>/check-runs/<an App check id> --jq '{id, app_id: .app.id, conclusion}'
   ```

7. Close the PR:

   ```text
   gh api repos/<tb>/pulls/<N> -X PATCH -f state=closed --jq .state
   ```

8. Derive results from the `settled=` values recorded by the sequence workflow. SAT = clean, unstable, or
   has_hooks (requirement satisfied); BLK = blocked. Any other settled value (unknown, behind, dirty, draft) in a
   step a rule uses makes that row undetermined/ambiguous, naming the step.
   - Precondition: S0 BLK and S1b SAT. If S0 is SAT (requirement not enforced) or S1b is BLK (an App success never
     satisfied it): PA01.1–PA01.6 are all undetermined/ambiguous (evidence: S0, S1b, the ruleset read-back).
   - PA01.1 confirmed iff S3 BLK (newer failure beats older success A) AND S4 SAT (newer neutral beats older
     failure); refuted if S3 stays SAT or S4 stays BLK.
   - PA01.2 confirmed iff S4 SAT; refuted iff S4 BLK.
   - PA01.3 confirmed iff S2 BLK; refuted iff S2 stays SAT for all 5 polls.
   - PA01.4 confirmed iff S5 BLK; refuted iff S5 SAT.
   - PA01.5 confirmed iff S7 BLK AND S8b SAT AND S8c SAT; refuted if S7 SAT or (S8b SAT and S8c BLK).
   - PA01.6 confirmed iff S9a BLK AND S9b BLK; refuted iff S9a BLK and S9b SAT.
   - PA01.7 confirmed when the settled values of S3 (failure), S10b (skipped), and S11b (timed_out) and at least
     one latency sample were recorded. Measurements: `failure effect`, `skipped effect`, `timed_out effect`,
     `latency min`, `latency median`, `latency max` (unit s; method: first 20-s poll after the write that showed
     the change, upper bound, 20 s resolution; samples = number of steps with `changed=yes`).
