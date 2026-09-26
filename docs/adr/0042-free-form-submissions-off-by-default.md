# ADR-0042: Free-form submissions are off by default

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` SP06; `docs/architecture.md` §8

## Context and Problem Statement

SP06 step 3 parses the issue form or the PR template into canonical fields. A submission whose structure it cannot
parse is unstructured, and the policy may still allow it to proceed. The contract gate runs before any model call so
that a malformed submission never spends inference (P01). A default was needed for `submission.free_form`.

## Considered Options

- Off by default — `submission.free_form: false` unless a project opts in
- On by default — unstructured submissions proceed unless a project opts out
- No setting — structure is always required

## Decision Outcome

Chosen option: "Off by default", because the deterministic contract gate needs structured fields to check, and a
default that lets unstructured text through would let malformed submissions reach the model before any gate can act.

`submission.free_form` defaults to `false`. An unstructured submission is `needs-changes` with a link to the
template and the submission assistant, decided before any model call. A project that wants to accept free-form text
sets `submission.free_form: true`; "no setting" would remove that choice entirely, which forbids projects whose
workflow does not fit the templates.

### Consequences

- [SP06 step 3](../processes.md) treats `submission.free_form: true` as opting into free-form submissions, with
  `false` as the default.
- [Architecture §8](../architecture.md) lists `free_form` (default `false`) in the Submission row and its Defaults.

## More Information

- The project owner decided this on September 26, 2026.
