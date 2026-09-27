# ADR-0062: Report caps as hard-only constants

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §12.1; `docs/processes.md` SP13

## Context and Problem Statement

SP13 step 2 requires a fixed-order report with caps where truncated outputs link to the evidence location.
GitHub limits a comment body to 65536 characters and a check-run summary to 65535. Submission-controlled
content, such as paths up to 4096 bytes, URLs up to 2048 characters, and an unbounded number of findings,
could otherwise inflate a rendered report past GitHub's limits or crowd out the findings that matter most to
a maintainer. The report caps and how a report's length is measured were not settled.

## Decision Drivers

- A submission must never be able to suppress or crowd out its own report by inflating one field or one
  finding.
- The report and the check-run summary must always fit inside GitHub's own limits with headroom for
  publication additions.
- The caps must be verifiable by a fixed test rather than left to per-report judgment.

## Considered Options

- Hard-only core constants — every cap is a steward constant, not exposed through the policy schema
- Policy keys with hard maxima like other limits — add report caps to the policy schema, bounded like other
  numeric limits
- Truncating the rendered report at GitHub's limit — render everything, then cut the string at the API limit
- A total cap only, without per-section and per-item caps — bound only the whole report's size

## Decision Outcome

Chosen option: "Hard-only core constants", because no project-specific trade-off exists for GitHub's own API
limits, so widening the policy schema for them would add a knob with no legitimate use; truncating at GitHub's
limit would cut wherever the string happened to end, which can remove blockers or provenance and hides the
report's structure; and a total cap alone would let one oversized item crowd out every other item in its
section. This follows the same reasoning as the hard-only limits in [ADR-0046](0046-hard-bounds-are-steward-constants.md): GitHub's
own limits do not change per project, so the caps live only in the core.

All lengths below are counted in UTF-16 code units of the string, which GitHub's own character counting makes
a conservative measure. The rendered report has a maximum of 60000 code units, leaving 5536 code units of
headroom under GitHub's comment-body limit for publication additions such as a hidden marker and an
attribution line. The check-run summary has a maximum of 8000 code units and instead points readers to the
full report.

Each report section caps the number of items it renders: blockers 20; uncertainties for maintainers 10;
executed commands and results 10; references 20; flagged automated activity 10, and additionally never more
than `hygiene.max_flagged`; what would change the outcome 10; classification notes 10. Each rendered item also
has a maximum size, counted including its list marker, any nested lines, and its trailing newline: the header
block (title, outcome, bound identifiers, and notices) 3000; a classification line 300; each classification
note 300; a blocker 1000; an uncertainty 800; an executed command 600; a reference 250; a flagged item 300; a
what-would-change item 500; a provenance block 1500; an overflow line 300. A value taken directly from the
submission or from GitHub, such as a path, URL, or free-text field, renders at most 200 code units per
occurrence, never splitting a surrogate pair, followed by ` (truncated)` immediately after its code span when
shortened; the full value is always kept in the evidence record. A list of subjects, such as paths, pull
request numbers, or URLs, inside one item renders at most 10 subjects, then a trailing `and <n> more`.

An item that would exceed its cap is fitted rather than dropped, so a submission cannot make its own report
fail by inflating one item: the fitting process shortens the item's lines only at positions outside every code
span and appends ` (truncated)`, and it never cuts inside a code span. A section that has more items than its
limit ends with one overflow line stating the remaining count and the evidence location where the rest are
recorded, in the form `- <n> more <noun> are recorded in the evidence: <location>.`

A unit test proves the static budget: every section filled to its item and per-item caps, plus the fixed
headings and separators, totals 57480 code units, which fits within 60000. A rendered report that still
exceeds 60000 code units, or a check-run summary that exceeds 8000, is treated as a steward defect that fails
publication outright: no report is produced in that case, and the report's structure is never silently
truncated to force a fit.

### Consequences

- [Architecture §12.1](../architecture.md) lists these values among the hard-only constants.
- SP13 step 2 applies these caps when it renders the report and the check-run summary.
- No policy key exists for any of these values; a policy cannot raise them.
- The cap check runs again after redaction, since redaction can change a rendered item's size.

## More Information

- The project owner decided this on September 27, 2026.
