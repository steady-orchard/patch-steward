# Templates

Files here are meant to be copied into target repositories. This is a root directory, not a workspace package.

- `policy/policy.yml` — the policy skeleton: copy it to `.github/patch-steward/policy.yml` on the default branch and edit
  it. Every key is written explicitly, including keys with documented defaults. `llm.model` holds the placeholder
  `replace-with-model-id`, which must be replaced with a real model id. The built-in dismissal codes appear as comments.
- `policy/policy.schema.json` — JSON Schema generated from the steward's policy schema for editor completion and
  checking. Runtime validation in the steward governs; cross-field rules such as reference integrity and provider
  pairing are not expressible in it. It is not copied into `.github/patch-steward/`, because every file in that
  directory changes the policy revision.
- `issue-forms/steward-defect.yml` — the defect issue form: copy it to `.github/ISSUE_TEMPLATE/steward-defect.yml`. Screening
  finds each field by its rendered label, so keep the labels unchanged; element ids equal the canonical field ids and serve
  only URL prefilling. The form has no `labels:` key and no severity field, and its `required` flags equal the policy
  template's `submission.issue_fields.defect` list; the policy governs screening.
- `issue-forms/steward-proposal.yml` — the proposal issue form: copy it to `.github/ISSUE_TEMPLATE/steward-proposal.yml`. The
  same label rules apply; its `required` flags equal `submission.issue_fields.proposal`.
- `pull-request/pull_request_template.md` — the pull request template: copy it to `.github/pull_request_template.md`. Its
  first line, `<!-- patch-steward:pr-template v1 -->`, names the template version; screening finds each field by its `##`
  heading, compared case-insensitively. Hint comments are ignored.
