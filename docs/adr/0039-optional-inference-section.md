# ADR-0039: Optional inference section and provider pairing

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.3, §8; `docs/user-manual/configuration.md` "Policy keys"

## Context and Problem Statement

The policy selects provider, model, and authentication method, and no default provider or model is ever substituted ([ADR-0008](0008-llm-provider.md), [ADR-0014](0014-llm-authentication.md)). Deterministic stages (contract checks, reference checks, executions) need no model. The `llm` keys, their pairing rules, and the local environment variable for `env` were open.

## Considered Options

- Optional section with paired providers — `llm` may be absent; when present `provider`, `model`, and `auth.type` are required and paired
- Required section — every policy must configure inference
- Optional section with a default provider — an absent section selects a built-in provider and model

## Decision Outcome

Chosen option: "Optional section with paired providers", because projects can validate and run deterministic stages before choosing a provider; a run that reaches a model stage without `llm` ends `inconclusive` (cause `llm-not-configured`), never pass; option 3 would substitute a provider, which the design forbids.

Pairing is `copilot-sdk` with `github-token` and no `options`; `openai-compatible` with `env`, which reads the fixed variable `STEWARD_LLM_API_KEY`, and a required `options.base_url` that is HTTPS (HTTP only for a loopback host), carries no credentials, and is not a retired GitHub Models host (`models.github.ai`, `models.inference.ai.azure.com`); mismatches fail validation (`policy.llm-pairing`, `policy.llm-base-url`). `generation.temperature` is 0 to 2 or null (the adapter then sends none); `required_capabilities.structured_output` is `any` or `native`; `admission` defaults to `all`. All inference limits live under `llm.limits`, so a policy without `llm` carries none; `ai_credits_per_run` applies only to `copilot-sdk`, `tokens_per_run` and `output_tokens_per_call` only to `openai-compatible`; the daily inference cap counts runs that reach a model stage. This refines the consequence recorded in ADR-0008 that an omitted provider ends the run `inconclusive`: an omitted section ends only runs that reach a model stage. The fixed variable name closes half of the local credential conventions question; reuse of the user's Copilot login stays open.

### Consequences

- [Architecture §6.3](../architecture.md) (Selection bullet and adapter table) and [§8](../architecture.md) (Inference row) state the pairing and optionality.
- [Architecture §15](../architecture.md) keeps the daily inference aggregate and Copilot login reuse as the only remaining open items in this area.
- [Configuration reference](../user-manual/configuration.md) (Inference keys) lists the keys and pairing rules.

## More Information

- The project owner decided this on September 26, 2026.
- [ADR-0008](0008-llm-provider.md)
- [ADR-0014](0014-llm-authentication.md)
