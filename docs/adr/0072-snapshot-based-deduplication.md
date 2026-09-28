# ADR-0072: Snapshot-based deduplication and event identity

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.4; `docs/processes.md` SP06 step 1, SP19 step 3

## Context and Problem Statement

`gate` must deduplicate before it claims work, cancels, or spends: a title-only edit or an unchanged echo must
keep the current owner, while a changed body, an explicit rerun, or a reopen must replace it (architecture
§6.4). Events carry no reliable indication of which input changed, writes made with the App token trigger
workflows (`probes/findings.md`, PA07), and the publication receipts that identify echoes are recorded in the
newest owner's record. What identifies a duplicate, and in what order does `gate` decide?

## Considered Options

- Deduplicate by snapshot against the newest committed owner
- Deduplicate by event identity
- Deduplicate a reopened submission by snapshot like any other event
- Fail `gate` on an ambiguous or incomplete ownership listing

## Decision Outcome

Chosen option: "Deduplicate by snapshot against the newest committed owner", because a title-only edit is a new
event with an unchanged snapshot, reopening restarts screening (SP03 step 2), and failing on an ambiguous listing
would block the replacement that resolves it.

Accepted events: the pull request wrapper runs on `pull_request_target` `opened`, `synchronize`, `edited`,
`reopened`, `ready_for_review`, and `closed`; the issues wrapper on `issues` `opened`, `edited`, `reopened`,
`closed`, and `deleted`.

Before any token, `gate` authenticates the event: the payload file (at most 26214400 bytes) validates against a
schema; the event name matches the wrapper; the payload repository's name and id equal the runner's; the ref is
the default branch; the server and API URLs are GitHub.com's; an `issues` event for a pull request is refused. A
failure is `gate.event-invalid`: no token, nothing committed.

Event identity (event, action, submission, the triggering object's id and `updated_at`, run id, attempt) is
recorded in the ownership record for audit, not used for deduplication.

Order in `gate`: authenticate (tokens, the installation's bot user id, the trusted policy) -> list the ownership
artifacts for every event kind -> closures take a record-only path -> verified-echo check -> capture ->
deduplication decision -> contract and caps -> commitment. The listing precedes the echo check because the
receipts come from it.

Rules: a new attempt of a run (an explicit rerun) commits a new owner; a `reopened` event commits a new owner;
otherwise, when the newest owner is unique, its record valid, and its snapshot hash and policy revision equal the
captured ones, the event is a duplicate: no upload, no cancellation, no cap evaluation, no evidence, and the job
summary names the kept owner. With no unexpired owner, the latest published run's `run.json` in the evidence
store (a directory listing under 1000 entries, one file of at most 1048576 bytes) stands in. An ambiguous or
incomplete listing commits (the new artifact becomes the unique newest). An unavailable listing or an invalid
record fails `gate` before commitment (`ownership.listing-unavailable`, `ownership.record-invalid`), except for
explicit reruns and reopens, which commit.

Echo rule: an event whose sender is this installation's bot user (looked up once per job) and whose triggering
resource id is among the publication receipts of the unique newest owner's valid record is a duplicate with
reason `echo` and is dropped before capture. An echo that cannot be verified is not an echo. No receipts are
recorded yet, because nothing is published on submissions in observe mode, so bot-sent events are captured and
deduplicated by snapshot; the rule is tested with synthetic receipts.

### Consequences

- [architecture §6.4](../architecture.md) and [SP06](../processes.md) step 1 state the order and rules,
  [SP19](../processes.md) step 3 the rescreening triggers, and architecture §12.1 the payload bound; on the
  test-beds a title-only edit and an edit by the App kept the owner (S02, S03), a body edit committed a new owner
  (S04), a reopen committed (S10), and a rerun committed (S12) (`scenarios/README.md`); ownership listing and
  records follow [ADR-0071](0071-ownership-record-and-artifact-protocol.md).

## More Information

- The project owner decided this on September 27, 2026, including the order in which the ownership listing
  precedes the echo check.
