# ADR-0002: Browser secrets

- Status: accepted
- Date: 2026-09-16
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Browser secrets", commit `0da65aa`

## Context and Problem Statement

The browser app ([ADR-0001](0001-browser-code-role.md)) is a static bundle on GitHub Pages that anyone can open. What may it hold and do: credentials, writes to GitHub, model calls?

## Considered Options

- No secrets in the browser app — the app reads JSON published by Actions, deep-links to github.com for every write action, and performs no inference
- Browser inference — deferred as [DF07](../deferred.md#df07-browser-inference)

## Decision Outcome

Chosen option: "No secrets in the browser app", because the page holds no tokens, and running LLM-assisted self-review in the CLI avoids provider-specific browser authentication and CORS requirements.

None. The app reads JSON published by Actions and deep-links to github.com for every write action. It performs no inference; LLM-assisted preflight runs in the CLI.

### Consequences

- [Architecture §6.6](../architecture.md) describes a static bundle with no server, no secrets, and no inference; [architecture §4](../architecture.md) gives zone Z6 public published data only and no writes: every action is a deep link to github.com or copyable command text.
- The browser assistant of [SP05](../processes.md) sends nothing to a provider (browser step 5); LLM-assisted self-review runs in the CLI (SP05 CLI step 4; [ADR-0015](0015-preflight-inference.md)).

## More Information

- History: the architecture was selected on September 15, 2026, and its LLM provider decisions were revised on September 16, 2026 (architecture status line). [Whitepaper §14](../whitepaper.md) states that the decisions recorded with the architecture were revised on September 16, 2026; this record takes that stated revision date as its date. This decision was first committed in commit `f79de29` (2026-09-16); its present text, which took the rejected alternative out of the decision text, was committed in commit `0da65aa` (2026-09-17). That alternative is listed under Considered Options.
