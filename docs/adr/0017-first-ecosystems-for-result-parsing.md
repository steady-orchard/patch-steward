# ADR-0017: First ecosystems for result parsing and anti-gaming fixtures

- Status: accepted
- Date: 2026-09-17
- Deciders: project owner
- Source: none outside this record

## Context and Problem Statement

The steward screens repositories written in many languages by invoking their established build and test tools inside the policy's runner image ([whitepaper §10](../whitepaper.md)). Fix verification reads result files and output to classify failures, and its anti-gaming analysis compares tests with the base ([SP10](../processes.md)). Result parsing and the fixtures that exercise it and the anti-gaming analysis have to start with some ecosystems. Which ecosystems come first?

## Considered Options

- TypeScript and one compiled ecosystem, Rust or C++ — the compiled ecosystem to be chosen when the deterministic verification stages are built
- TypeScript and Python

## Decision Outcome

Chosen option: "TypeScript and one compiled ecosystem, Rust or C++", because SP10 step 3 distinguishes compile failures from assertion failures, which a compiled ecosystem exercises.

TypeScript and one compiled ecosystem, Rust or C++, chosen when the deterministic verification stages are built: SP10 step 3 distinguishes compile failures from assertion failures, which a compiled ecosystem exercises. Not chosen: TypeScript and Python.

### Consequences

- [SP10](../processes.md) step 3 accepts an assertion or behavior failure on the base commit as before evidence and rejects a compile or missing-symbol failure; the chosen ecosystems give fixtures for both kinds of failure.
- Test result parsing (policy-declared result formats versus exit-code-only evidence) remains an open implementation decision ([architecture §15](../architecture.md)).

## More Information

- The project owner decided this on September 17, 2026, before implementation began. No design document restates it; this record is its only persistent statement.
