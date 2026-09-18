# ADR-0027: Wrapper permissions equal the pinned reusable workflow's

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §12; `docs/processes.md` SP02, SP19; `probes/findings.md` PA04

## Context and Problem Statement

Reusable workflows cannot exceed the caller's permissions, so the wrapper templates grant `copilot-requests: write` to the model jobs. The design said that a wrapper that drops it makes those jobs end `inconclusive`.

On all three test-beds, a caller that omitted `issues` or `copilot-requests` while the called job requested `issues: write` or `copilot-requests: write` ended the whole run `startup_failure` with no job scheduled, an unrelated sibling job included; granting both scopes let every job run with exactly the requested scopes (PA04.2 in the [findings record](../../probes/findings.md); results for [org-public](../../probes/pa04-privilege-separation/results/org-public.md), [org-private](../../probes/pa04-privilege-separation/results/org-private.md), and [personal](../../probes/pa04-privilege-separation/results/personal.md), E2–E4). So no `gate` runs: no check is created, nothing is published, and no `inconclusive` outcome exists. A new head commit fails closed because the required check stays missing, but a same-commit event, such as a body edit or a linked-issue change, cannot withdraw an earlier success, because no `gate` runs to create the fresh check; the failure is visible only as a failed run in the Actions run list. How does the design prevent and surface a wrapper whose grant is short?

## Considered Options

- Match wrapper permissions at installation — replace the `inconclusive` clause with the observed behavior (a wrapper that grants less than the pinned reusable workflow's jobs request fails the whole run at startup: no job, check, report, or evidence); `steward init` writes wrapper permissions equal to the pinned reusable workflow's job permissions; the installation self-test fails visibly when a wrapper's grant is short; wrapper edits stay on the CODEOWNERS-reviewed path
- Add a scheduled startup-failure detector — the first option, plus a scheduled maintenance check that lists the screening wrappers' runs concluded `startup_failure` and opens or updates one deduplicated maintenance issue

## Decision Outcome

Chosen option: "Match wrapper permissions at installation", because the fault arises only from a wrapper that disagrees with the pinned reusable workflow, which `steward init` and the self-test can check at its source at no per-run cost; the scheduled detector would add a maintenance job and an issue path for a configuration error that the first option already surfaces when it is introduced.

A wrapper that grants less than the pinned reusable workflow's jobs request fails the whole run at startup: no job, check, report, or evidence exists. `steward init` writes wrapper permissions equal to the pinned reusable workflow's job permissions, the installation self-test fails visibly when a wrapper's grant is short, and wrapper edits stay on the CODEOWNERS-reviewed path. The same day, [ADR-0025](0025-ruleset-dependent-controls-limitation.md) qualified the last clause: required code-owner review of wrapper paths exists only where the repository's plan and visibility offer rulesets.

### Consequences

- [Architecture §6.4](../architecture.md) (the paragraph starting "Reusable workflows cannot exceed the caller's permissions") and "Failure classes and outcomes" in [architecture §12](../architecture.md) state the startup failure and its guards.
- [SP02](../processes.md) step 7 and Failure handling, and the Failure handling of [SP19](../processes.md), apply them; the [troubleshooting guide](../user-manual/troubleshooting.md) row "Copilot inference cannot run in Actions" describes the symptom.

## More Information

- The project owner decided this on September 25, 2026.
