# ADR-0036: Zod as the single schema source

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8, §9

## Context and Problem Statement

Structured data crossing into the core must be validated at runtime, because TypeScript
types alone do not validate API or model output. The policy, every stored record, and
later structured model responses each need a runtime schema, a TypeScript type for the
core's own code, and, for the policy editor and model requests, a JSON Schema.

## Considered Options

- Zod 4 as the single source — one definition yields runtime validation, the inferred TypeScript type, and an exported JSON Schema
- JSON Schema as the source — a JSON Schema validator with generated TypeScript types
- Hand-written types and validators — TypeScript interfaces plus separate validation code

## Decision Outcome

Chosen option: "Zod 4 as the single source", because one definition cannot drift between
the type checked at compile time and the check run at runtime; strict objects reject
unknown keys; refinements carry cross-field rules at runtime; and the JSON Schema export
serves the policy editor schema and later model response schemas from the same
definitions. The cost is a runtime dependency (`zod`) inside the core, and the fact that
cross-field rules such as reference integrity and provider pairing are not representable
in the exported JSON Schema, so the editor schema is an aid only and runtime validation
governs.

Every policy and record schema in the core is defined once in Zod; the TypeScript type is
inferred from it, and a JSON Schema is exported from the same definition for tooling that
needs one.

### Consequences

- [architecture §9](../architecture.md) states that record schemas are strict and
  runtime-validated.
- [architecture §8](../architecture.md) states that the editor schema
  `templates/policy/policy.schema.json` is generated from the runtime schema, cannot
  express cross-field rules, and is not installed into the policy directory.
- A test keeps the committed editor schema equal to the live export.

## More Information

- The project owner decided this on September 26, 2026.
