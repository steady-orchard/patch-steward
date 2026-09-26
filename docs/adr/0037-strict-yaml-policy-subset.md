# ADR-0037: Strict YAML subset for the policy file

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8; `docs/user-manual/configuration.md` "Policy validation"

## Context and Problem Statement

The policy is a YAML file, and a proposed policy from a pull request is validated as
untrusted data. Full YAML offers constructs a hostile or careless author could exploit:
aliases (exponential expansion), anchors and merge keys (effective values hidden from
reviewers), explicit tags (type constructors), silently resolved duplicate keys, multiple
documents in one file, and a `%YAML 1.1` directive that changes scalar typing (for
example, an unquoted `no` becoming `false`).

## Considered Options

- Strict YAML subset — YAML 1.2 core schema; exactly one document; no anchors, aliases, explicit tags, or directives; unique string keys; no `__proto__`, `constructor`, or `prototype` key; size, nesting-depth, and node-count bounds
- Library-default YAML — whatever the parser accepts
- JSON policy file — a strict JSON file instead of YAML

## Decision Outcome

Chosen option: "Strict YAML subset", because it removes every construct listed above
while keeping YAML, whose comments the policy template needs to show the built-in
dismissal catalog as comments, which a JSON file cannot carry.

The policy parser accepts only the YAML 1.2 core schema, exactly one document, no
anchors, aliases, explicit tags, or `%YAML`/`%TAG` directives, unique string keys, and no
`__proto__`, `constructor`, or `prototype` key, within fixed size, nesting-depth, and
node-count bounds. One leading UTF-8 byte-order mark is stripped; invalid UTF-8 is
rejected; any parser warning fails closed. Each rejected construct has its own `yaml.*`
failure code, and failure messages are fixed text that never quotes the input.

### Consequences

- [architecture §8](../architecture.md) states the validation order, and the
  [configuration reference](../user-manual/configuration.md) lists the `yaml.*` codes
  under "Policy validation".
- The hostile fixtures under `fixtures/policies/hostile/` exercise each rejected
  construct.

## More Information

- The project owner decided this on September 26, 2026.
