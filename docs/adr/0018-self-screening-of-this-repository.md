# ADR-0018: Self-screening of this repository

- Status: accepted
- Date: 2026-09-17
- Deciders: project owner
- Source: none outside this record

## Context and Problem Statement

Calibration needs real submissions: in observe mode the pipeline runs and records decisions and evidence without feedback on the submission ([SP03](../processes.md)). Patch Steward's own repository receives issues and pull requests. Does the steward screen this repository?

## Considered Options

- Self-screening in observe mode — screen this repository's own issues and pull requests in observe mode

No other option was recorded.

## Decision Outcome

Chosen option: "Self-screening in observe mode", because this repository supplies continuous real traffic for calibration.

Yes, in observe mode, starting when the GitHub-hosted full pipeline runs in observe mode, as continuous real traffic for calibration.

### Consequences

- In observe mode the steward records decisions and evidence with no report, label, or reviewer request ([SP03](../processes.md) step 1; [architecture §10](../architecture.md)).
- Observe mode runs the full pipeline and spends inference like any other mode ([architecture §12](../architecture.md) "Spending").

## More Information

- The project owner decided this on September 17, 2026, before implementation began. No design document restates it; this record is its only persistent statement.
