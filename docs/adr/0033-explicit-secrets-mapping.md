# ADR-0033: Explicit per-name secrets mapping into the pinned reusable workflow

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §7; `docs/processes.md` SP02; `probes/findings.md` PA04

## Context and Problem Statement

Thin wrappers in the target repository call reusable workflows pinned by immutable commit SHA ([ADR-0011](0011-distribution.md), [ADR-0013](0013-orchestration.md)). Privilege separation relies on GitHub Environments: the App key in a publication Environment for `gate` and `publish`, and an `env` provider key in a separate model Environment for `intake` and `assess` jobs; no job references both.

A first probe passed no secrets on the `uses:` call. On all three test-beds a caller job that declared the Environment read its secret and a sibling job read nothing, but every called-workflow job that declared the same Environment read an empty value (PA04.1 in the [findings record](../../probes/findings.md)). The design had never specified that wiring.

A re-probe tested two wirings into a callee hosted in another repository than each caller and pinned by commit SHA; the callee declares the secret under `on.workflow_call.secrets`, and its job declares the caller's Environment (results for [org-public](../../probes/pa04-privilege-separation/results/org-public.md), [org-private](../../probes/pa04-privilege-separation/results/org-private.md), and [personal](../../probes/pa04-privilege-separation/results/personal.md)):

- Explicit mapping: the calling job, which declares no Environment, passes the secret by name in a `secrets:` mapping, so the mapped expression itself is empty. In all four legs, within one owner and across owners, the called job received the caller's Environment value.
- `secrets: inherit`: within one organization it delivered (one leg). Across owners, between an organization and a user account in either direction, it delivered the secret empty, silently, with no error (three legs).

No called job read the host repository's value, and sibling isolation held in all eight runs. No organization-to-organization call was tested. Which wiring carries the caller's Environment secrets into the pinned reusable workflow?

## Considered Options

- Explicit per-name secrets mapping — the pinned reusable workflow declares each secret its jobs use under `on.workflow_call.secrets`, the wrappers pass each by name in an explicit `secrets:` mapping, and each called job declares its Environment and receives the caller's Environment value; the design names the explicit mapping, not `secrets: inherit`
- Secret-holding jobs in the wrappers — `gate`, `publish`, and `env`-provider model jobs move from the pinned reusable workflow into the wrappers in the target repository, which reference their own Environments directly; only credential-free logic stays in reusable workflows, at the cost of SHA-pinning of the privileged logic

## Decision Outcome

Chosen option: "Explicit per-name secrets mapping", because the explicit mapping delivered the caller's Environment secret into the SHA-pinned called job on all three test-beds, across owners, with sibling isolation intact, so privilege separation holds with a template change and the privileged logic stays pinned, which moving the jobs into the wrappers would give up; the design names the explicit mapping because `secrets: inherit` delivered the secret empty in every leg between an organization and a user account, and adopters' repositories usually belong to another owner than the steward's reusable workflows.

The wrapper templates pass the App and provider secrets to the pinned reusable workflow by an explicit per-name `secrets:` mapping: the reusable workflow declares each secret under `on.workflow_call.secrets`, and the called job declares the Environment and receives the caller's Environment value. The design names the explicit mapping and not `secrets: inherit`, which arrived silently empty across owners in all three cross-owner legs; the organization-to-organization case is untested.

### Consequences

- The first paragraph of [architecture §6.4](../architecture.md) and the [architecture §7](../architecture.md) rows "Reusable workflows (`workflow_call`)" and "Environments with deployment-branch rules" state the wiring, including for the calls inside the issues and maintenance runs; a job that declares no Environment receives nothing, and the Copilot path still uses job `GITHUB_TOKEN` permissions without an Environment secret.
- [SP02](../processes.md) step 1 has `steward init` write the wrappers with the explicit mapping, and the credential-free relay passes no secrets; steps 2 and 3 keep the App secrets in the publication Environment and the `env` provider key in the model Environment.
- The trusted wrapper decides which secrets enter the pinned reusable workflow through this mapping, and the Environment declarations of its jobs decide which job receives each ([ADR-0014](0014-llm-authentication.md)).

## More Information

- The project owner decided this on September 25, 2026, after the re-probe.
