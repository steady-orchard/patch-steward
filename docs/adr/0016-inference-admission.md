# ADR-0016: Inference admission

- Status: accepted
- Date: 2026-09-16
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Inference admission", commit `0da65aa`

## Context and Problem Statement

Inference is Copilot-credit or third-party spend, and observe mode runs the full pipeline, so the operating mode does not reduce spending ([architecture §12](../architecture.md) "Spending"). Holding back inference for authors new to a repository limits volume but trades away newcomer access and latency (O01). Is inference admitted for every submission?

## Considered Options

- Policy option `llm.admission` — `all` (default) or `maintainer-approved`, which holds model calls for authors without prior merged work in the repository until a maintainer admits the submission

No other option was recorded.

## Decision Outcome

Chosen option: "Policy option `llm.admission`", because observe mode spends inference like any other mode, and this control limits that spending independently of the operating mode without changing any outcome.

Policy option `llm.admission`: `all` (default) or `maintainer-approved`, which defers model calls for authors without prior merged work in the repository until a maintainer admits the submission. A spending control independent of the operating mode; it never changes an outcome.

### Consequences

- The "Inference" area of [architecture §8](../architecture.md) holds `llm.admission`; [architecture §12](../architecture.md) "Spending" lists it among the spending controls and states that it never changes an outcome; the public policy subset of [architecture §6.6](../architecture.md) publishes the inference-admission rule.
- [SP19](../processes.md) step 10 commits an awaiting-approval state, records it with its age in every mode, resumes screening when a maintainer's `/steward rerun` records admission, and states that inference admission never changes an outcome.
- The threat table of [architecture §13](../architecture.md) ("Cost exhaustion through volume") states the newcomer-access tradeoff explicitly (O01).

## More Information

- History: the architecture's status line records the LLM provider decisions as revised on September 16, 2026, after the retirement of GitHub Models on July 30, 2026; this record takes that date for the inference admission decision. The decision was first committed in commit `f79de29` (2026-09-16) and has not changed since.
