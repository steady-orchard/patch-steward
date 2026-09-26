# ADR-0057: Deterministic contract result

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` SP06, SP13

## Context and Problem Statement

SP06 decides the submission contract before any model call or execution and can end a run early. SP13 step 1
owns the final decision table and its precedence. The contract must never produce a pass, must ignore severity
statements and authorship, and needs defined handling for GitHub's body limits and for diffs too large to
classify.

## Considered Options

- A separate contract result that cannot express pass
- The final outcome decided by the contract
- Author-facing text limits — deferred as [DF10](../deferred.md#df10-author-facing-submission-length-caps)

## Decision Outcome

Chosen option: "A separate contract result that cannot express pass", because SP13 later combines these
findings with stage results, so the contract reports findings rather than an outcome. The disposition is
`met`, `needs-changes`, `uncertain`, or `inconclusive`; `met` is not an outcome and no value is `pass`.

Precedence, mirroring SP13 step 1: another open PR sharing the head (`submission.shared-head`) or any blocking
finding is `needs-changes`; else an inconclusive cause is `inconclusive`; else an uncertain finding is
`uncertain`; else `met`. Blocking codes: `submission.unstructured`, `submission.field-duplicate`,
`submission.field-missing`, `submission.category-missing`, `submission.category-invalid`,
`submission.linked-issue-missing`, `submission.linked-issue-invalid`, `submission.attachment-violation`,
`submission.shared-head`; uncertain: `submission.category-mismatch`, `submission.category-enforced-ambiguity`,
`submission.execution-sensitive-change`, `submission.diff-too-large`; advisory:
`submission.attachment-unavailable`, `submission.trusted-path-change`, `submission.policy-change`. Each
blocking finding carries a numbered request naming the field or rule and the body field to edit; an
unstructured body's request links the template. Failed reads are inconclusive causes. A diff over 3000 paths is
`submission.diff-too-large` with both path flags set. GitHub's body and title limits are input-safety bounds
only: an over-limit body from GitHub is a malformed response (`inconclusive`), an over-limit preflight draft
exits with status `2`, and neither asks the author for shorter text. Severity statements and author identity
are never contract inputs.

### Consequences

- SP06 steps 3 to 8 state the codes.
- SP13 consumes the findings.
- Conformance tests prove no disposition is `pass` and that authorship and severity change nothing.
- `steward preflight` maps dispositions to exit statuses.

## More Information

- The project owner decided this on September 26, 2026.
