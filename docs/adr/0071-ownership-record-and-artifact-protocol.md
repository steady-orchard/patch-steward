# ADR-0071: Ownership record and artifact protocol

- Status: accepted
- Date: 2026-09-27
- Deciders: project owner
- Source: `docs/architecture.md` §6.4, §9, §12.1; `docs/processes.md` §0.1, SP13

## Context and Problem Statement

Architecture §6.4 makes the upload of an immutable per-submission ownership artifact the commitment point of a
run and orders owners by the artifact's `created_at` ([ADR-0026](0026-ownership-artifact-ordering.md)), but left
the artifact's name, its retention, the record schema, and the consistency window of the artifact listing under
concurrent `gate` jobs open. Measured facts (`probes/findings.md`): the listing showed a new upload after at
most 2 s (median 1 s; PA02.5); `created_at` has 1-second resolution; retention requests are capped at 90 days
(PA02.6); a re-run attempt's upload of the same name replaces the earlier attempt's artifact and ids are not
monotonic across attempts (PA02.3). Question: how is the ownership artifact named, recorded, ordered, and read?

## Considered Options

- One validated record per artifact, ordered by creation time, re-listed after a settle delay
- Order owners by artifact id
- Let a run publish when its own artifact shares the greatest creation time

## Decision Outcome

Chosen option: "One validated record per artifact, ordered by creation time, re-listed after a settle delay",
because artifact ids are not monotonic across re-run attempts (PA02.3) and a tie at the greatest creation time
cannot show which run is newest.

Name `steward-ownership-pr-<number>` or `steward-ownership-issue-<number>` (decimal, no leading zero); the
artifact holds one file `ownership.json`, uploaded by `gate` with `actions/upload-artifact` pinned by commit SHA
and a requested retention of 90 days; the upload's success is the commitment point, and `gate` reports its run
committed only in a step after the upload.

The record: record type `ownership`, version 1, strict schema, canonical JSON of at most 16384 bytes; fields:
repository; subject (type and number); run id and attempt; check id (null until check runs exist); snapshot
hash; policy revision; disposition (`runnable`, `early-exit`, or `queued`); admission (`not-required` so far);
cap evaluation (null for an early exit, otherwise the state `within`, `daily-runs`, or
`per-author-concurrent-runs` with the daily and per-author counts and limits); event identity (event name,
action, the triggering object's id and `updated_at`, sender id and type); author id; and `created_at`, which is
informational only.

Listing: by exact name, 100 artifacts per page, at most 10 pages (a longer listing is incomplete); expired
artifacts are ignored.

Newest owner: the unexpired artifact with the greatest `created_at` reported by the API; two or more sharing it
are ambiguous; artifact ids never order.

Download: one redirect to an HTTPS host on public addresses, sent without an `Authorization` header; a zip of at
most 65536 bytes with exactly one entry named `ownership.json`; every downloaded record is validated, and a
record whose repository, subject, name, or run id disagrees with its artifact is invalid and treated like an
unavailable read.

`publish` reads its own artifact before the evidence commit and binds it to the handoff records; the artifact's
`created_at` and `expires_at` give the effective retention, which is logged and shown in the job summary, and a
value below 90 days is a warning, not a failure (90 days measured on the test-beds).

After the evidence commit `publish` waits 10000 ms, five times the measured maximum visibility delay, re-lists,
and decides in order: an unavailable or incomplete listing, or its own artifact missing or changed, is unknown;
any tie at the greatest `created_at` is unknown, whether or not its own artifact is among them; a unique newer
artifact whose record validates supersedes the run (reason `newer-owner`, successor run id and attempt from that
record), an invalid one is unknown; when its own artifact is newest, it recaptures the submission under the live
default-branch policy: a failure is unknown, a changed snapshot hash or policy revision supersedes the run
(reason `snapshot-changed`), otherwise the run is current. Unknown fails publication with
`publish.freshness-unknown`; it never supersedes.

With no unexpired artifact there is no owner, and deduplication falls back to the latest published evidence
snapshot (ADR-0072).

Rejected options: ordering by id (PA02.3); letting a tie that includes the run's own artifact publish (a tie
cannot authorize publication; the next run resolves it).

### Consequences

- [architecture §6.4](../architecture.md) states the protocol, [architecture §9](../architecture.md) the record,
  and [architecture §12.1](../architecture.md) the settle delay, record size, download size, listing pages, and
  requested retention; architecture §15 no longer lists the naming, retention, listing consistency, or record
  schema; [SP13](../processes.md) step 4 applies the ordered evaluation; the invariant 8 conformance tests prove
  that ties and incomplete listings block publication, that a newer owner supersedes, and that unknown freshness
  fails publication.

## More Information

- The project owner decided this on September 27, 2026.
