# ADR-0051: One glob syntax for repository paths

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8; `docs/user-manual/configuration.md` "Glob syntax"

## Context and Problem Statement

Policy globs appear in `trusted_paths.additional`, `execution_sensitive_paths.additional`,
`supported_behavior.components[].paths`, `stages.high_impact_paths`, and `escalation.sensitive_paths`, and the
built-in path lists need the same glob syntax. Policy validation checks only path syntax, and the paths matched
at run time come from untrusted diffs. A regular expression built from arbitrary pattern text risks
catastrophic backtracking and injection, so pattern text cannot become part of a compiled regular expression.

## Considered Options

- One minimal glob syntax with a linear matcher — repository-relative POSIX paths, case-sensitive, a small
  fixed set of wildcard rules
- A glob library dependency — brace expansion, extended globs, negation
- Regular expressions in the policy — patterns are regular expressions matched directly against paths

## Decision Outcome

Chosen option: "One minimal glob syntax with a linear matcher", because a fixed, small rule set can be matched
by an iterative, linear-bounded algorithm that never builds a regular expression from pattern text, so no
untrusted or maintainer-authored pattern can cause catastrophic backtracking. A glob library would add a
dependency and features (braces, extended globs, negation) beyond what any policy area needs. Regular
expressions in the policy would let a single field become an injection and denial-of-service surface.

Patterns are repository-relative POSIX paths, matched case-sensitively. A pattern without `/` matches the last
path segment at any depth. A pattern with `/` is anchored at the root. `**` as a whole segment matches zero or
more path segments. `*` matches any run of characters except `/`, including a leading `.`. `?` matches one
character except `/`. Every other character is literal: no braces, brackets, or negation. Matching is iterative
and linear-bounded and never constructs a regular expression from pattern text. No dependency is added, and no
policy validation rule changes as a result, so the policy `version` stays `1`.

### Consequences

- [Architecture §8](../architecture.md) and the [configuration reference](../user-manual/configuration.md)
  state the syntax.
- The built-in path lists and every policy glob field share one matcher implementation.
- A project needing pattern combinations beyond a single glob lists several patterns instead.

## More Information

- The project owner decided this on September 26, 2026.
