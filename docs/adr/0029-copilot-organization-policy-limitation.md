# ADR-0029: Copilot organization policy on organization-owned repositories

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.3, §15; `docs/processes.md` SP02, SP19; `probes/findings.md` PA08

## Context and Problem Statement

The `copilot-sdk` adapter authenticates in Actions with the job's `GITHUB_TOKEN` and `copilot-requests: write` ([ADR-0014](0014-llm-authentication.md)). Organization-owned repositories bill the organization and require the Copilot policy "Allow use of Copilot CLI billed to the organization"; personally owned repositories bill the repository owner's Copilot seat. This organization billing path is unverified: no probe has run in an organization with Copilot (`probes/findings.md`, PA08.7).

The probes assumed that inference on the organization-owned test-beds would need no billing to the organization. On both organization-owned test-beds, in an organization with no Copilot seats and its CLI billing policy unconfigured, a job with `copilot-requests: write` got no reply on either path. The CLI exited 1 with "Error: Access denied by policy settings". The SDK runtime reported itself authenticated and started a session, but the model call failed HTTP 403 with an `authorization` error, "Authorization error. Your credentials may be expired or invalid.", which cannot be told apart from an expired credential; nothing was billed (PA08.2 in the [findings record](../../probes/findings.md); results for [org-public](../../probes/pa08-copilot-inference/results/org-public.md) and [org-private](../../probes/pa08-copilot-inference/results/org-private.md)). Without inference, the job token reads nothing about the policy, while an `admin:org` user token reads the organization's Copilot billing `cli` setting (PA08.6). The personal billing path (PA08.1) was confirmed on the personally owned test-bed ([results](../../probes/pa08-copilot-inference/results/personal.md)). The result refuted the probes' assumption, not the design, which already required the organization policy. How does the design treat an organization that has not enabled the policy?

## Considered Options

- Enable organization Copilot and re-probe — the owner enables Copilot for the organization (seats or the policy "Allow use of Copilot CLI billed to the organization") and the organization cases are probed again, with organization billing accepted as a cost
- Use `openai-compatible` where the organization has not enabled the policy — organization-owned repositories whose organization has not enabled the Copilot CLI policy use the OpenAI-compatible adapter with a project-supplied key; `copilot-sdk` stays the path for personally owned repositories and for organizations that enable the policy
- Accept the limitation — keep requiring the organization policy and document the observed failure shapes, how `intake` can tell them apart, and what installation can read

## Decision Outcome

Chosen option: "Accept the limitation", because the design already states that organization-owned repositories need the organization policy, so the finding refutes a test-setup assumption rather than the design; accepting the limitation records the observed failure shapes and detection limits at no cost and keeps both adapters open, while enabling organization Copilot adds organization spending and switching adapters changes the guidance for every organization-owned installation.

The design keeps requiring the Copilot organization policy for organization-owned repositories and documents what the probes found:

- The policy-disabled failure shapes: the CLI's "Access denied by policy settings"; the SDK's HTTP 403 `authorization` error that reads like an expired credential while the runtime reports itself authenticated.
- `intake` can tell a disabled policy from an unusable credential only by the failure of its bounded synthetic request, recorded as one `inconclusive` cause unless the CLI text is available.
- What installation can read: an `admin:org` user token reads the organization's Copilot billing `cli` setting; the job token reads nothing about the policy or billing.

### Consequences

- The `copilot-sdk` row of the adapter table in [architecture §6.3](../architecture.md) and the item "Capability probing at installation" in [architecture §15](../architecture.md) state the failure shapes and what installation can read.
- The Failure handling of [SP02](../processes.md) and [SP19](../processes.md) records the failure as `inconclusive`; the [troubleshooting guide](../user-manual/troubleshooting.md) rows "Inference fails before execution" and "Copilot inference cannot run in Actions" describe it for maintainers.
- The marker for the unverified organization billing path is decided in [ADR-0032](0032-organization-billing-unverified-marker.md).

## More Information

- The project owner decided this on September 25, 2026.
