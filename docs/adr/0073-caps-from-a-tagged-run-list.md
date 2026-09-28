# ADR-0073: Approximate caps from a tagged run list

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §12, §12.1; `docs/processes.md` SP19 step 1

## Context and Problem Statement

Architecture §12 evaluates `limits.caps.daily_runs` and `limits.caps.per_author_concurrent_runs` from the Actions
run list, with no steward state ([ADR-0013](0013-orchestration.md)). The run list does not say which submission
or author a run screens: its `pull_requests` field is empty for pull requests from forks, while the run name
that the default-branch wrapper sets is reported as the run's `display_title` for every run, including events
sent by a bot and re-run attempts (`probes/findings.md`, PA09). A cap evaluation measured 3 requests per listed
workflow. How does `gate` count runs?

## Considered Options

- Tag each run through the wrapper run name and count from three run-list queries
- Attribute runs through the run list's pull request field
- Exclude the App's own runs by sender type alone

## Decision Outcome

Chosen option: "Tag each run through the wrapper run name and count from three run-list queries", because the
run list's pull request field is empty for pull requests from forks (PA09) and the sender type `Bot` also
matches other bots such as Dependabot.

The run name is
`steward <pr|issue> <number> author <author id> event <event> <action> sender <sender id> <sender type>`, holding
only numbers and platform enumerations, never a title, body, login, or ref; `gate` parses it with a fixed
grammar, reading at most 1024 characters. `gate` runs three run-list queries: runs created today
(UTC), runs in progress, and queued runs, 100 per page and at most 10 pages each, about 3 requests when each
query fits one page. A run counts only when its workflow path is one of the two wrappers
(`.github/workflows/steward-pr.yml`, `.github/workflows/steward-issues.yml`) and its event is one they accept, so
a pull request cannot add counted runs through its own workflow definitions.

The daily count is today's counted runs, except those whose run name parses with this installation's bot user as
sender; a run name that does not parse counts, which is cost-safe; this run is included. The run is queued when
the count exceeds `limits.caps.daily_runs`. The per-author count is queued or in-progress counted runs whose run
name names the submission author, this run included; it is queued when it exceeds
`limits.caps.per_author_concurrent_runs`. The daily cap is checked first.

A read failure or a listing beyond 10 pages fails `gate` before commitment with `caps.run-list-unavailable`,
never an undercount; more than the API's 1000 results for the day counts as over the daily cap, whose hard
maximum is 1000.

Caps are evaluated only for otherwise runnable work; a duplicate is never cap-checked or queued. Duplicates,
closures, early exits, and comment runs still appear in the run list and count against later evaluations: an
approximate, cost-safe overcount, documented as such. The author id is used only for this count and for closure
attribution, never for an outcome.

### Consequences

- [architecture §12](../architecture.md) (aggregate caps) and [architecture §12.1](../architecture.md) (run-list
  pages, run display title length) state the rules and bounds; [SP19](../processes.md) step 1 applies them;
  over-cap runs record a waiting run directory; on a test-bed the daily cap of 1 and the per-author cap of 1
  queued the over-cap issues (S11, `scenarios/README.md`); how the approximate daily inference aggregate is
  computed stays open (architecture §15).

## More Information

- The project owner decided this on September 27, 2026.
