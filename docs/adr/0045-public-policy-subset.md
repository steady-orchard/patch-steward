# ADR-0045: Public policy subset

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.6, §11; `docs/processes.md` SP01

## Context and Problem Statement

Contributors should see evidence requirements, the dismissal-code catalog, and related expectations before
submitting (P09), and the maintenance workflow publishes `data/policy.json` to Pages for that purpose. The policy
also holds runner images, commands, paths, allowlists, redaction patterns, and inference settings that should never
be public, and a private target repository needs explicit consent before publishing anything at all.

## Considered Options

- Section allowlist with whole-section exclusions — a fixed set of publishable sections; the policy may exclude
  whole sections; private targets publish only with explicit consent
- Publish the resolved policy — everything
- Per-key public markers — the policy marks individual keys public

## Decision Outcome

Chosen option: "Section allowlist with whole-section exclusions", because a fixed allowlist cannot leak a key added
later, and excluding whole sections keeps the choice simple and reviewable; per-key markers would make publication
depend on every future key being marked correctly, and publishing the resolved policy would expose runner and
credential-adjacent settings that must stay private.

The publishable sections are `categories`, `evidence_requirements`, `unrequested_change`, `modes` (with draft
guidance), `attachment_caps`, `dismissal_codes`, `supported_versions`, and `inference_admission`, plus
`schema_version` and `revision`. `evidence.publication.exclude` removes whole sections from that set; nothing else is
ever published: not the runner, commands, paths, escalation, hygiene allowlist, redaction patterns, evidence store,
inference provider, model, options or limits, labels, other limits, supported-behavior text, documents, decisions,
or design rules, nor reference-host allowlists or attachment destinations and formats. With
`evidence.publication.pages: false` no subset exists at all; for a private target repository none exists unless
`evidence.publication.private_repository` is also `true`. A disabled subset is a typed result, not an empty object,
and the subset is validated against its own strict schema.

### Consequences

- [Architecture §6.6](../architecture.md) states the data contract for `data/policy.json`.
- [Architecture §11](../architecture.md) states the publication rule and the private-target consent requirement.
- [SP01 step 5](../processes.md) states which sections publish and the exclusion and consent rules.
- The [configuration reference](../user-manual/configuration.md) documents the Evidence keys and the Evidence and
  visibility section.

## More Information

- The project owner decided this on September 26, 2026.
