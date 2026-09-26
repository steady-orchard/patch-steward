# ADR-0050: Versioned field mapping by rendered labels and a PR template marker

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` SP06; `docs/architecture.md` §6.7; `docs/user-manual/configuration.md` "Field mapping"

## Context and Problem Statement

GitHub renders each issue-form field as a `### <label>` heading and omits the form element ids from the
submitted body; PR bodies are free Markdown that contributors edit by hand. SP06 step 3 needs a versioned
mapping from labels and headings to canonical fields, and a correction request when a body's fields are
ambiguous or duplicated. Templates change over time, and a body written against an older template must still
parse correctly.

## Considered Options

- Rendered labels and a PR template marker — plain human labels, one mapping table per template version, the
  issue-form version found by matching its full set of label headings newest first, a hidden first-line PR
  marker `<!-- patch-steward:pr-template v1 -->`
- Machine markers in every field — hidden per-field comments or ids embedded inside labels
- Partial label matches — accept a body that shows some labels as structured even when others are missing
- Heading sets for PR versions — detect a PR template's version from its heading set, the way issue forms are
  detected

## Decision Outcome

Chosen option: "Rendered labels and a PR template marker", because labels are what GitHub renders and what
people read: they carry the mapping without adding anything a contributor could see as clutter. Markers inside
every field would be visible, editable noise that a contributor could accidentally alter. Partial matches would
turn a foreign or malformed body into a structured one with misattributed fields, which is worse than leaving it
unstructured. Contributors edit PR headings freely, so a heading set cannot reliably identify a PR template
version; only an explicit, unedited marker can.

Labels and headings are compared after Unicode normalization, trimming, and whitespace collapsing: issue-form
labels case-sensitively, PR headings case-insensitively. Headings inside fenced code blocks and HTML comments
are ignored. The defect form is tried before the proposal form. A mapped heading that appears twice in a body
is `submission.field-duplicate`. A body without a full match against any known issue-form version, or a PR body
without the marker, is unstructured. Canonical field ids stay fixed and change only by addition, never removal
or rename. Form element ids equal the field ids and serve URL prefilling only; the forms carry no `labels:` key
and no severity field, and their required flags equal the policy template's issue field lists. Reproduction
files go into the `Reproduction command` field as fenced code blocks or attachments, with no separate field for
them.

### Consequences

- [SP06 step 3](../processes.md) states the parsing rules for labels, headings, and the marker.
- [Architecture §6.7](../architecture.md) names the template sources and the PR template marker.
- The [configuration reference](../user-manual/configuration.md) lists the version-1 mapping tables.
- A new template version adds a mapping table and keeps the older ones so old bodies keep parsing.

## More Information

- The project owner decided this on September 26, 2026.
