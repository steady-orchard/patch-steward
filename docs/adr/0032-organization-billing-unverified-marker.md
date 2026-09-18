# ADR-0032: Unverified marker for the organization billing path

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.3, §12; `probes/findings.md` PA08

## Context and Problem Statement

Organization-owned repositories bill Copilot inference to the organization under the Copilot policy "Allow use of Copilot CLI billed to the organization" ([ADR-0029](0029-copilot-organization-policy-limitation.md)). This organization billing path is unverified: no probe has run in an organization with Copilot (`probes/findings.md`, PA08.7). The design documents describe the path in several places, and each description has to say that the path is unverified. What is the wording of that marker, and where does it apply: in particular, does it apply to the "Spending" bullet of architecture §12, which names cost centers without describing the billing path?

## Considered Options

- Default forms everywhere — confirm the default sentence form and table-cell form at every location that describes the path, the "Spending" bullet of architecture §12 included
- Default forms except architecture §12 "Spending" — the same, except the "Spending" bullet
- Owner-supplied wording — different, self-contained wording for either form

## Decision Outcome

Chosen option: "Default forms everywhere", because the path must be documented as unverified wherever it is described, and cost-center setup exists only on the organization billing path, so marking the "Spending" bullet too is the conservative reading; the default wording is self-contained and cites only `probes/findings.md` and a PA id.

Both default forms are confirmed at every location that describes the organization billing path, the "Spending" bullet of architecture §12 included. The sentence form is used in prose, the table-cell form in table cells:

```text
This organization billing path is unverified: no probe has run in an organization with Copilot (`probes/findings.md`, PA08.7).
(unverified; `probes/findings.md` PA08.7)
```

### Consequences

- In [architecture](../architecture.md), the `copilot-sdk` row of §6.3, the `steward init` row of §6.5, and the "Copilot SDK inference" row of §7 carry the table-cell form; "Spending" in §12 and "Capability probing at installation" in §15 carry the sentence form.
- In [processes](../processes.md), SP02 step 3, SP02 Controls and Failure handling, and SP19 Failure handling carry the sentence form.
- In the user manual, the Credentials table of the [configuration guide](../user-manual/configuration.md) and two rows of the [troubleshooting guide](../user-manual/troubleshooting.md) carry the table-cell form, and the Credentials paragraph carries the sentence form.

## More Information

- The marker stays until the path is verified in an organization with Copilot.
- The project owner decided this on September 25, 2026.
