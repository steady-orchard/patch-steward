# ADR-0065: Redaction at persistence: resolved credentials and prefixed token formats

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §11, §13; `docs/user-manual/configuration.md` "Evidence"

## Context and Problem Statement

Invariant 7 requires redaction before anything is stored. [ADR-0047](0047-redaction-patterns.md) settled eight
built-in detectors and safe-subset policy patterns. The CLI now resolves a GitHub token (`GH_TOKEN`,
`GITHUB_TOKEN`, or `gh auth token`) and writes evidence to disk, and submission text, API data, and logs can all
carry credentials belonging to many providers beyond GitHub. Later App and model credentials will be resolved
the same way and need the same treatment.

## Decision Drivers

- A stored credential must never survive, including in encoded or derived forms an attacker could still use.
- Detection must be deterministic; heuristics that guess at secrets produce false positives on ordinary text.
- Coverage must extend to every stored artifact, not only the rendered report.

## Considered Options

- Exact values of resolved credentials plus prefixed token formats over every stored string, followed by
  schema re-validation
- Keyword and entropy heuristics
- Redacting only logs and the rendered report
- Exempting snapshot fields, or hashing values before redaction

## Decision Outcome

Chosen option: "Exact values of resolved credentials plus prefixed token formats over every stored string,
followed by schema re-validation", because keyword and entropy heuristics are not deterministic and corrupt
ordinary text and hashes with false positives; redacting only logs and the rendered report misses records that
carry submission text and API data directly; and exempting snapshot fields or hashing values before redaction
both mean a stored credential could survive, which invariant 7 forbids outright.

Fifteen built-in detectors are appended after the original eight, in this order: `npm-token`, `pypi-token`,
`gitlab-token`, `slack-token`, `slack-webhook`, `stripe-key`, `stripe-webhook-secret`, `google-api-key`,
`google-oauth-client-secret`, `google-oauth-access-token`, `huggingface-token`, `docker-hub-token`,
`sendgrid-key`, `shopify-token`, `digitalocean-token`, for 23 detectors in total. Each is a literal prefix plus
one bounded character class, so matching stays linear in input size; test samples are built by concatenation at
test time and are never committed as literals.

Every credential the process resolved (currently the GitHub token) is replaced under the id `known-secret` in
three forms: the raw value, its standard base64 encoding, and the standard base64 encoding of
`x-access-token:<value>` (the HTTPS basic-auth form). Values shorter than 8 characters are not used for literal
replacement, since they are too short to distinguish from ordinary text.

Coverage extends to every string value at every depth of every record, including metrics events (object keys
are schema keys and are never rewritten), `report.md` and the report record's texts, every log file, and the
manifest's strings. The order of operations is: assemble records, redact in batches of at most 8388608 bytes of
input per worker call with each call bounded to 2000 ms, re-validate every record against its schema, render
the report and its summary from the already-redacted records, redact the rendered text, re-check the report's
size caps, then write. Logs are redacted before truncation, so a truncation cut can never split a credential in
half and leave a fragment undetected.

A redaction failure, an oversize input, a timeout, or a record that a redaction marker invalidates fails the
evidence write outright: no run directory and no report are produced. Replacement counts per detector id are
recorded in the manifest.

Accepted consequence: when a detector matches a contributor-controlled string inside the snapshot, for example
an attachment URL that happens to embed credentials, the redacted snapshot no longer matches its recorded hash,
re-validation fails, and that run produces no evidence and no report. Nothing bypasses this to force a result.
Side effect: a policy string matching any of the 23 detectors is rejected under `policy.credential-value`; the
policy template and every fixture policy still validate.

### Consequences

- [Architecture §11](../architecture.md) states the coverage, and §13's credential-leakage mitigation names
  exact-value redaction explicitly.
- The configuration reference lists all 23 detectors.
- The invariant 7 conformance test proves a sentinel token appears in no stored file.

## More Information

- The project owner decided this on September 27, 2026.
