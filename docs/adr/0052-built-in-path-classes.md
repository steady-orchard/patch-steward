# ADR-0052: Built-in path classes for category consistency

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` SP06; `docs/user-manual/configuration.md` "Category consistency"

## Context and Problem Statement

SP06 step 4 checks a PR's declared category against its diff, and a mismatch is `uncertain`. Deciding
consistency needs a classification of the changed paths into categories such as test, docs, infra, and code.
Adding policy keys for a project-defined classification would grow the policy surface for a check that mostly
needs the same answer across projects.

## Considered Options

- Built-in path classes, no policy keys — four fixed classes with a fixed matching order, not configurable
- Policy-defined path classes per category — a project lists globs for each category in its policy
- Declared category only — no diff check against the classification at all

## Decision Outcome

Chosen option: "Built-in path classes, no policy keys", because a fixed classification needs no new policy
surface and gives every project the same behavior out of the box; a mismatch always goes to maintainer triage
and never rejects a submission, so an imperfect class costs maintainer attention rather than contributor
access.

There are four classes, matched first match wins, in the order test, docs, infra (configuration, CI,
dependencies, tooling, and every trusted or execution-sensitive pattern), code. A rename or copy contributes
both its old and new path. A diff is `docs`-consistent when every changed path is docs or test and at least one
is docs. It is `chore`-consistent when no changed path is code and at least one is docs or infra. It is
consistent with `bugfix`, `feature`, `refactor`, or `security` when at least one changed path is code. An empty
diff is consistent with no declared category. A declared category that is not consistent with the diff is
`submission.category-mismatch` (`uncertain`). An absent, invalid, or mismatched declaration where an enforced
mode's plausible categories are ambiguous adds `submission.category-enforced-ambiguity`, and the effective mode
is the strictest mode over the plausible categories. A diff over 3000 paths is `submission.diff-too-large`.
Known misclassifications are documented rather than special-cased: JSON files count as code, YAML and TOML
files as infra, and `tools/**` may hold product code that this classification treats as infra.

### Consequences

- [SP06 step 4](../processes.md) states the classification rules and the resulting codes.
- The [configuration reference](../user-manual/configuration.md) lists every built-in pattern by class.
- Changing a class is a steward release, not a policy change, because the classes carry no policy keys.

## More Information

- The project owner decided this on September 26, 2026.
