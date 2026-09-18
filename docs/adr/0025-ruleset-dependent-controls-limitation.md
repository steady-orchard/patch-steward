# ADR-0025: Ruleset-dependent controls where rulesets are not offered

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §7, §10, §11; `docs/processes.md` SP02; `probes/testbeds.md`; `probes/findings.md` PA01, PA06

## Context and Problem Statement

Enforcement requires the steward check from the steward App through a ruleset, and the merge-queue relay needs a merge queue. The design implied that both work in every repository, private repositories included.

On the test-bed that is a Free-plan organization's private repository, listing rulesets and creating a ruleset with a required-status-check rule and one with a merge-queue rule were each refused with HTTP 403 (evidence T8 and T9 in [probes/testbeds.md](../../probes/testbeds.md), copied into that repository's [PA01 results](../../probes/pa01-required-checks/results/org-private.md) and [PA06 results](../../probes/pa06-merge-queue-relay/results/org-private.md)). No required-check (PA01) or merge-queue (PA06) behavior could be exercised there, so those twelve cells are undetermined ([findings record](../../probes/findings.md)). The same sub-claims were confirmed on the public test-beds: PA01.1–PA01.7 on the organization's public repository and on the personally owned repository, PA06.1–PA06.5 on the organization's public repository ([PA01 results, organization public repository](../../probes/pa01-required-checks/results/org-public.md), [PA01 results, personally owned repository](../../probes/pa01-required-checks/results/personal.md), [PA06 results, organization public repository](../../probes/pa06-merge-queue-relay/results/org-public.md)).

The design uses rulesets for two further controls: the evidence-store push restriction (pushes only by the App identity and maintainers; architecture §11, SP02 step 4) and required code-owner review of policy and wrapper-workflow paths (SP01 step 2, SP02 step 8, the "Rulesets" row of architecture §7). No probe tried either control; the refusal of rulesets on that repository leaves them without the ruleset they rely on. What does the steward do where GitHub offers no rulesets for a repository's plan and visibility?

## Considered Options

- Accept the limitation for enforcement and the merge-queue relay — enforcement and the relay only where GitHub offers rulesets and merge queue for the repository's plan and visibility; `observe` and `advise` without a required check elsewhere
- Move the private test-bed to a plan that offers rulesets and re-probe — re-run the required-check and merge-queue probes there before the dependent implementation starts
- Decide later — leave the question open until the dependent implementation starts
- Extend the accepted limitation to every ruleset-dependent control — the first option, plus: where the plan and visibility offer no rulesets, the evidence-store push restriction and required code-owner review of policy and wrapper paths are unavailable too, and `steward init` and the SP02 preconditions detect and report it

## Decision Outcome

Chosen option: "Extend the accepted limitation to every ruleset-dependent control", because every required-check and merge-queue sub-claim was confirmed on the public test-beds, the refusal is a plan gate rather than a behavior difference, and the accepted limitation makes the plan dependency explicit where the design implied that enforcement works in every private repository.

The project owner accepted the limitation for enforcement and the merge-queue relay on September 25, 2026 and extended it the same day to the two further controls. As decided:

- Enforcement (a required App check through a ruleset) and the merge-queue relay are available only where GitHub offers rulesets and merge queue for the repository's plan and visibility. On a Free-plan organization's private repository the steward runs `observe` and `advise` without a required check.
- Where GitHub offers no rulesets for a repository's plan and visibility, the evidence-store push restriction and required code-owner review of policy and wrapper-workflow paths are unavailable as well. The push restriction depends on the plan and visibility of the repository that holds the evidence store: the target repository for the orphan branch, the separate repository otherwise.
- `steward init` and the SP02 preconditions detect the refusal and report it: step 8 keeps `enforce` off and reports required code-owner review as unavailable, and step 4 reports the push restriction as unavailable.
- The required-check and merge-queue semantics confirmed on public repositories (PA01, PA06) are relied on as independent of plan and visibility.

### Consequences

- [Architecture §7](../architecture.md) rows "Rulesets" and "Merge queue", [architecture §10](../architecture.md) (enforcement), and [architecture §11](../architecture.md) (push restriction) state the limitation; the wrapper-permission paragraph of [architecture §6.4](../architecture.md) and three rows of the threat table in [architecture §13](../architecture.md) qualify required code-owner review and evidence protection the same way.
- [SP01](../processes.md) step 2, [SP02](../processes.md) steps 4, 7, and 8, [SP03](../processes.md) step 7, and the Controls of [SP18](../processes.md) apply it; the [installation guide](../user-manual/installation.md) steps 4 and 8 and the [configuration guide](../user-manual/configuration.md) describe it for maintainers.
- The wrapper-permission decision ([ADR-0027](0027-wrapper-permission-ceiling.md)) and the evidence store ([ADR-0009](0009-evidence-store.md)) inherit this qualification.

## More Information

- No separate rationale was recorded for the extension beyond the two controls it covers.
- Moving the test-bed to a paid plan would have re-measured platform semantics that nothing suggested differ between plans.
