# ADR-0024: PA01–PA09 platform-assumption identifiers

- Status: accepted
- Date: 2026-09-18
- Deciders: project owner
- Source: `docs/architecture.md` §6.1; `probes/findings.md`

## Context and Problem Statement

The probe suite ([ADR-0023](0023-probe-suite-location.md)) verifies nine platform assumptions, each split into sub-claims, on up to three test-bed repositories. Result files, the findings record, and the design documents need to refer to each assumption and sub-claim. Is the naming a stable identifier family of the design documents, and when is it recorded there?

## Considered Options

- PA01–PA09 as a stable identifier family — assumptions `PA01` to `PA09` with sub-claims `PA0N.M`, recorded in the design documents without a further confirmation
- Recording after a confirmation — record the identifier family in the design documents only after a confirmation that follows the probe results

## Decision Outcome

Chosen option: "PA01–PA09 as a stable identifier family", because a separate confirmation after the probes would have been redundant.

Adopted: PA01–PA09 with sub-claims PA0N.M is a stable identifier family for the platform assumptions. It is recorded in architecture §6.1, `README.md`, and `CLAUDE.md`, and `probes/findings.md` owns the results.

### Consequences

- [Architecture §6.1](../architecture.md) names the probes PA01–PA09 with sub-claims PA0N.M; the repository [README](../../README.md) and [CLAUDE.md](../../CLAUDE.md) list the family among the stable identifiers.
- The [findings record](../../probes/findings.md) holds one roll-up row per assumption and one row per sub-claim and test-bed; design text cites it by PA id.

## More Information

- The project owner decided this on September 18, 2026.
