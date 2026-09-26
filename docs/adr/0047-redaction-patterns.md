# ADR-0047: Redaction patterns

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8, §11; `docs/user-manual/configuration.md` "Policy keys"

## Context and Problem Statement

Invariant 7 requires redacting credentials before anything is stored, and the policy's Evidence area lets a
project name its own redaction patterns for the secret formats specific to it. A policy regular expression is
untrusted input, and JavaScript regular expressions can backtrack catastrophically on a crafted pattern and
input. What redacts stored text, and how is a policy-supplied pattern kept safe?

## Considered Options

- Built-in detectors plus a safe subset of policy patterns — always-on credential detectors, plus policy
  patterns restricted to a safe subset and applied under size and time bounds, failing closed
- Built-in detectors only — no project patterns
- Unrestricted policy patterns under a timeout — any regular expression, stopped only by a time limit

## Decision Outcome

Chosen option: "Built-in detectors plus a safe subset of policy patterns", because the built-ins cover common
credential shapes in every project and project patterns cover what is specific to one, but a policy pattern
still needs to be constrained: banning only backreferences and lookaround does not by itself prevent
catastrophic backtracking, so the safe subset also rejects nested quantifiers and a repeated group containing
an alternation. The worker-thread time bound is a second line of defense for whatever the syntax restriction
misses, and a bound exceeded at run time fails closed rather than storing unredacted text. A dedicated
linear-time regular-expression engine was not adopted because it would add a dependency with its own syntax
for a policy author to learn.

Redaction runs the built-in detectors first, then the policy's safe-subset patterns, with flags `gu`. The
built-in detector ids are `private-key`, `github-token`, `aws-access-key-id`, `provider-api-key`, `jwt`,
`authorization-header`, `bearer-token`, and `url-credentials`, plus exact-value redaction of secret values the
caller supplies, such as the injected provider key. Every replacement uses the marker
`[REDACTED:<detector id>]`. The safe subset for a policy pattern forbids backreferences, lookaround, named
groups or any other `(?` construct except non-capturing `(?:`, nested quantifiers, a repeated group containing
an alternation, and a pattern that can match the empty string, and bounds both a pattern's length and the
count of patterns (`policy.redaction-pattern`). Exceeding the input-size or time bound at run time is a typed
failure, and the caller must not persist the text on that failure. A policy key or string value that itself
matches a built-in detector is rejected as `policy.credential-value`, and the rejection message never echoes
the matched value. The redaction module exists now; the evidence store that calls it before every write is not
implemented yet.

### Consequences

- [Architecture §8](../architecture.md) (the Evidence area's `redaction_patterns` key) and
  [architecture §11](../architecture.md) (redaction before evidence is written) state the pipeline and its
  ordering.
- The configuration reference's Evidence keys document the safe subset and the `policy.redaction-pattern` and
  `policy.credential-value` failures.
- [Architecture §13](../architecture.md)'s credential-leakage and model-credential-exposure mitigations rely on
  this module running before artifact upload and evidence write.

## More Information

- The project owner decided this on September 26, 2026.
