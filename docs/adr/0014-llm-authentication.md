# ADR-0014: LLM authentication

- Status: accepted
- Date: 2026-09-16
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "LLM authentication", commit `0da65aa`

## Context and Problem Statement

The two shipped adapters ([ADR-0008](0008-llm-provider.md)) authenticate differently: Copilot inference with a GitHub token, an OpenAI-compatible endpoint with a project-supplied key. The policy is read from the trusted branch and selects the provider and model. How is the authentication method selected, and how does the credential reach the job that uses it?

## Considered Options

- Per-adapter authentication type in the policy — `llm.auth.type` is `github-token` or `env`; the policy holds references only, and the trusted wrapper workflow routes the secrets
- Secret values in the policy

## Decision Outcome

Chosen option: "Per-adapter authentication type in the policy".

Selected per adapter in the policy (`llm.auth.type`): `github-token`, which resolves to the job's `GITHUB_TOKEN` in Actions and to the user's Copilot login elsewhere, or `env`, a fixed per-adapter environment variable. The policy holds references, never secret values; the trusted wrapper workflow decides which secrets enter which job.

### Consequences

- The adapter table of [architecture §6.3](../architecture.md) states the authentication of each adapter in each topology; the "Inference" area of [architecture §8](../architecture.md) holds references only and states that the trusted wrapper workflow decides which secrets enter which job; [architecture §6.5](../architecture.md) describes how the CLI resolves `llm.auth.type`.
- In Actions the wrapper passes each secret by name into the pinned reusable workflow, and each job's Environment declaration decides whether it receives one ([architecture §6.4](../architecture.md); [ADR-0033](0033-explicit-secrets-mapping.md)); [SP02](../processes.md) steps 2 and 3 store the App and provider secrets in separate Environments, and step 3 states that the trusted wrapper workflow decides which secrets enter which job.

## More Information

- No rationale was recorded for this decision.
- History: the architecture's status line records the LLM provider decisions as revised on September 16, 2026, after the retirement of GitHub Models on July 30, 2026; this record takes that date for the authentication decision. The decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
