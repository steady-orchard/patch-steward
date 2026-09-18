# ADR-0005: Deployment and triggers

- Status: accepted
- Date: 2026-09-15
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Deployment and triggers", commit `0da65aa`

## Context and Problem Statement

Continuous screening needs a trigger for every submission event and an identity for the steward's writes to GitHub. A local CLI that is not running cannot receive events; GitHub Actions, a reachable webhook receiver, or a running polling process could deliver them (whitepaper at commit `d0ed9df`). How is the steward deployed and triggered?

## Considered Options

- GitHub Actions with an App identity — GitHub Actions in the target repository plus a GitHub App identity whose installation tokens are minted inside Actions
- Webhook receiver or poller — deferred as [DF05](../deferred.md#df05-webhook-receiver-or-poller-check-run-action-buttons)

## Decision Outcome

Chosen option: "GitHub Actions with an App identity".

GitHub Actions in the target repository plus a GitHub App identity whose installation tokens are minted inside Actions. No webhook server.

### Consequences

- [Architecture §1.1](../architecture.md) "Hosting" lists GitHub Actions in the target repository, GitHub Pages, contributor machines, and maintainer machines, and states that there is no webhook server.
- [Architecture §6.4](../architecture.md) runs one trusted workflow run per event on the default branch, and only `gate` and `publish` hold App tokens; [architecture §7](../architecture.md) lists the Actions events and the GitHub App the steward uses, states that the App's installation tokens are minted inside Actions, and leaves check-run requested actions unused because they require a webhook receiver.
- Maintainer control uses `/steward` comment commands ([SP15](../processes.md)).
- How the work is organized inside Actions is decided in [ADR-0013](0013-orchestration.md).

## More Information

- No rationale was recorded for this decision.
- History: the architecture was selected on September 15, 2026 (architecture status line). This decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
