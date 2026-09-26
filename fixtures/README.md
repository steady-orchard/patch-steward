# Fixtures

Shared fixture corpus for patch-steward tests: a root directory, not a workspace package (ADR-0022).

Test tiers are selected by filename suffix; every suffix ends in `.test.ts`, so the build exclusion `**/*.test.ts` covers all tiers:

- `*.test.ts` — unit
- `*.fixture.test.ts` — fixture (reads files from this directory)
- `*.container.test.ts` — container
- `*.live.test.ts` — live probe

Tests locate this corpus relative to the test file via `import.meta.url`. Corpus entries grow per milestone.

Current entries:

- `smoke/greeting.txt` — smoke entry proving the fixture-tier wiring.
- `policies/valid/` — valid policies: minimal without inference, Copilot SDK, OpenAI-compatible, and one whose free-text
  fields carry prompt-injection and shell text that must stay data.
- `policies/invalid/` — policies that each break one validation rule; `.txt` so the formatter never rewrites them.
- `policies/hostile/` — hostile YAML: aliases, anchors, duplicate keys, custom tags, multiple documents, deep nesting,
  prototype keys, a catastrophic redaction pattern, non-string keys.
- `policies/expectations.json` — validity and failure codes per fixture; the fixture-tier test checks it both ways.
