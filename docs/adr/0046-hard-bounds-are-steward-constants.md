# ADR-0046: Hard bounds are steward constants

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §12

## Context and Problem Statement

Invariant 7 requires that tokens, runtime, retries, container resources, and captured output are bounded by
policy. Every numeric limit and every size the policy module itself reads (file size, YAML depth and node
count, string and list lengths, git call counts, validation message counts, record counts) needed a source of
truth for its outer bound, and a policy proposed in a pull request is untrusted data. Where should the ceiling
on a policy-declared limit live?

## Considered Options

- Steward constants — every numeric policy limit has a minimum and hard maximum defined in the core, versioned
  with the steward and never settable by policy; inputs the policy module reads have hard-only constants
- Policy-settable ceilings — the policy declares its own maxima
- No hard bounds — the policy's values are trusted

## Decision Outcome

Chosen option: "Steward constants", because a bound set by the policy it constrains bounds nothing: a policy
can lower a limit to fit its own repository, but only a value the core ships and versions can stop it from
raising a limit past what the steward can afford to run safely.

Every integer key of the policy schema has a registered minimum and hard maximum, both constants of the
steward core. A value outside `[minimum, hard maximum]` is rejected as `policy.limit-out-of-bounds`, never
clamped, so no default is substituted silently for an out-of-range value. A conformance test requires every
integer key of the policy schema to carry a registered bound, so a new limit cannot ship unbounded. Inputs the
policy module reads before validation, such as file size and YAML structure, have hard-only constants with no
policy-settable minimum, because nothing has validated the policy yet at that point.

### Consequences

- [Architecture §12](../architecture.md) states the hard-bounds rule and its rejection code, and §12.1 carries
  the bound tables and their provisional derivation.
- [Architecture §15](../architecture.md) no longer lists numerical limits as an open item.
- The configuration reference documents each limit's bounds alongside its template value.

## More Information

- The project owner decided this on September 26, 2026.
