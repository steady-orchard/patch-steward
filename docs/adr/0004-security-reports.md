# ADR-0004: Security reports

- Status: accepted
- Date: 2026-09-16
- Deciders: project owner
- Source: `docs/architecture.md` §1.2 "Decisions recorded", row "Security reports", commit `0da65aa`

## Context and Problem Statement

Security reports are within the scope of the [problem statement](../problem-statement.md), and GitHub offers private vulnerability reporting beside issues. Are security reports a submission type of their own in version 1, and how is an ordinary issue that claims a security problem handled?

## Considered Options

- Not a submission type — a security-claimed issue follows the policy's escalation rule and never receives a severity statement
- Private vulnerability report intake — deferred as [DF02](../deferred.md#df02-private-vulnerability-report-intake)

## Decision Outcome

Chosen option: "Not a submission type", because no Actions trigger fires for advisory events, and report content would have to stay confidential in model calls.

Not a submission type. A security-claimed issue follows the policy's escalation rule and never receives a severity statement (SP08).

### Consequences

- [SP08](../processes.md) step 4 states that security reports are not a submission type, defines a security-claimed issue, and routes it by the policy's escalation rule without a severity statement; the "Escalation" policy area of [architecture §8](../architecture.md) holds that rule.
- [Architecture §1.1](../architecture.md) lists issues and pull requests as the only submission types and states that security reports are not a submission type ([ADR-0003](0003-submission-types.md)).

## More Information

- History: the architecture was selected on September 15, 2026 (architecture status line). [Whitepaper §14](../whitepaper.md) states that the decisions recorded with the architecture were revised on September 16, 2026; this record takes that stated revision date as its date. This decision was first committed in commit `f79de29` (2026-09-16); its present text, which replaced its earlier text, was committed in commit `0da65aa` (2026-09-17). The alternative it replaced is listed under Considered Options.
