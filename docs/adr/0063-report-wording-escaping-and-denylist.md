# ADR-0063: Report wording, escaping, and the denylist

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/processes.md` SP13; `docs/architecture.md` §6.2

## Context and Problem Statement

Invariant 6 and SP13 step 2 forbid severity statements, authorship statements, and praise, and require neutral
wording, addressing P07 and P09. The report quotes submission-derived and GitHub-derived text, such as paths,
URLs, field values, numbers, and refs, which can carry mentions, issue references, raw HTML, Markdown
structure, or invisible characters. On GitHub, a mention notifies a user and an issue reference creates a
cross-reference event, addressing P08. The model never decides wording, and there is no model anywhere in the
report path. How the report renders quoted text safely, and how it enforces neutral wording, were not settled.

## Considered Options

- Core-owned templates with code-span escaping and a denylist scan — fixed wording from templates, every
  quoted value rendered as an escaped code span, and a term denylist enforced by a conformance test
- Report text written by a model — let the model draft the wording for each finding
- HTML-escaping derived text inside prose — escape HTML characters in quoted values without using code spans
- A separate notes section for advisory findings — add a section outside SP13's fixed order for advisory
  content

## Decision Outcome

Chosen option: "Core-owned templates with code-span escaping and a denylist scan", because rules decide
outcomes, not the model, so wording drafted by a model could not be verified against invariant 6 and would
reintroduce judgment into a path that must stay deterministic; HTML-escaping alone still lets a mention or an
issue reference render outside a code span, since GitHub's mention and cross-reference behavior is not driven
by raw HTML; and a separate notes section would change SP13's fixed section order, which every report and
every test depends on.

The report follows the SP13 step 2 section order as Markdown lists only, with no tables: a header giving the
outcome, inconclusive causes, submission, snapshot, target branch, head and base commits, policy revision, and
run, followed by Classification, Blockers, Uncertainties for maintainers, Executed commands and results,
References, Flagged automated activity, What would change the outcome, and Provenance. Every heading is always
present, and a section with no content renders `- None.`.

All fixed text comes from core templates keyed by finding code and detail, outcome, and cause; nothing in the
report is composed freely. Requests are numbered R1, R2, and so on, in the order of blocking findings, and each
names the section a maintainer should edit. Every value derived from the submission or from GitHub, including
issue and pull request numbers, renders as a Markdown code span, so GitHub renders no HTML, mention, issue
reference, or link inside it and creates no cross-reference event from it.

Before a quoted value is wrapped into a code span, its line breaks become visible two-character escapes, and
every other control character, line or paragraph separator, zero-width or bidi format character, and lone
surrogate becomes a visible escape naming its code point, so nothing invisible or directional survives into
the rendered report. The code span's backtick fence is one backtick longer than the longest run of backticks
already in the value, and the span is padded with one space on each side when the value starts or ends with a
backtick or a space, so the fence never merges with the value's own content.

Fixed text contains only repository URLs built from the validated repository name and default branch, and
evidence locations, both rendered as code spans; a locally produced report carries no clickable links at all.
Fixed text itself never contains a mention sign, an issue-number reference, raw HTML, an exclamation mark, or
an emoji, and the stored report contains no control or format character except line feeds. Advisory and
speculative findings render only as `Note:` lines inside the Classification section, never as blockers or
uncertainties, and never with a severity word.

A denylist of terms is matched case-insensitively as whole words across every rendered section: severity terms
(such as critical, severe, urgent, high priority, a P0-style priority label, or CVSS), authorship and AI terms
(such as AI-generated, written by, first-time contributor, low-effort, or spam), and praise and chatter terms
(such as great, excellent, thank you, sorry, and `please`). A conformance test scans every template variant and
every golden report and check summary with code spans masked out, so quoted submission content can never
trigger a false denylist hit. Local and non-authoritative runs carry fixed notices in both the report and the
check summary.

### Consequences

- The invariant 6 conformance test covers the templates and the golden reports, and proves the report's bytes
  do not change with the author's identity.
- SP13 step 2 states these wording and escaping rules.
- The architecture §6.2 Report module applies the templates, the escaping, and the denylist scan.

## More Information

- The project owner decided this on September 27, 2026.
