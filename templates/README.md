# Templates

Files here are meant to be copied into target repositories. This is a root directory, not a workspace package.

- `policy/policy.yml` — the policy skeleton: copy it to `.github/patch-steward/policy.yml` on the default branch and edit
  it. Every key is written explicitly, including keys with documented defaults. `llm.model` holds the placeholder
  `replace-with-model-id`, which must be replaced with a real model id. The built-in dismissal codes appear as comments.
- `policy/policy.schema.json` — JSON Schema generated from the steward's policy schema for editor completion and
  checking. Runtime validation in the steward governs; cross-field rules such as reference integrity and provider
  pairing are not expressible in it. It is not copied into `.github/patch-steward/`, because every file in that
  directory changes the policy revision.
