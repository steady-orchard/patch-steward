# ADR-0008: LLM provider

- Status: accepted
- Date: 2026-09-16
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "LLM provider", commit `0da65aa`

## Context and Problem Statement

Screening sessions need a model. GitHub Models was retired on July 30, 2026, and the LLM provider decisions were revised on September 16, 2026 after that retirement (architecture status line). Which providers does version 1 support, which Copilot features does it use, and who selects the provider and model?

## Considered Options

- Provider-independent core with two shipped adapters — one LLM adapter interface; a Copilot SDK adapter and an OpenAI-compatible HTTP adapter; the trusted policy selects provider, model, and authentication method
- Copilot code review
- The Copilot coding agent
- Tool-enabled Copilot sessions
- A default provider — substituted when the policy selects none

## Decision Outcome

Chosen option: "Provider-independent core with two shipped adapters", because a provider-independent adapter contract with policy-owned selection lets a run end `inconclusive` instead of substituting a model when a provider is retired or a model is deprecated.

Provider-independent core behind one LLM adapter interface. Version 1 ships a Copilot SDK adapter (bounded request-response inference with a GitHub token, every tool denied) and an OpenAI-compatible HTTP adapter (project-supplied key). The trusted policy selects provider, model, and authentication method; no default provider is substituted. Copilot code review, the Copilot coding agent, and tool-enabled Copilot sessions are not integrated.

### Consequences

- [Architecture §6.3](../architecture.md) defines the LLM adapter contract, the capability descriptor, and both adapters; the "Inference" area of [architecture §8](../architecture.md) holds the provider, model, and authentication settings.
- [Architecture §7](../architecture.md) lists Copilot code review, the Copilot coding agent, and tool-enabled Copilot sessions as not used in version 1.
- An omitted or unknown provider, a missing credential, a failed capability check, or a retired model identifier ends the run `inconclusive` ([architecture §6.3](../architecture.md), [§12](../architecture.md)); [architecture §13](../architecture.md) lists the adapter contract as the mitigation for provider retirement or model deprecation.
- Authentication per adapter is decided in [ADR-0014](0014-llm-authentication.md).

## More Information

- History: the architecture's status line records the LLM provider decisions as revised on September 16, 2026, after the retirement of GitHub Models on July 30, 2026; this record takes that date. The decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
