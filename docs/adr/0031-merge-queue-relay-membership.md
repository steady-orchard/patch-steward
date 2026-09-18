# ADR-0031: Merge-queue relay membership and echo filtering

- Status: accepted
- Date: 2026-09-25
- Deciders: project owner
- Source: `docs/architecture.md` §6.4; `docs/processes.md` SP12; `probes/findings.md` PA06

## Context and Problem Statement

A credential-free relay runs on the merge-queue ref, and its completion starts the screening run on the default branch through `workflow_run` ([ADR-0013](0013-orchestration.md)). That run validates the relay identity and the current group membership; relay failure or removal cannot create success, because the queue times out without the required check.

The merge-queue probe on the organization's public test-bed observed three facts that the design left implicit (PA06 in the [findings record](../../probes/findings.md); [results](../../probes/pa06-merge-queue-relay/results/org-public.md), E4, E9, E10):

- Entries enqueued with a job `GITHUB_TOKEN` formed groups but started no `merge_group` run, so every such entry left the queue with its checks timed out: fail-closed, but silent to the enqueuer. Entries enqueued with the App installation token started the relay and the default-branch `workflow_run`.
- `workflow_run.pull_requests` is empty for relay runs, so the member pull request was resolved by parsing the queue ref name.
- The `workflow_run` sender is the enqueuer, which is the App bot when the App enqueued the entry, so an echo rule keyed on the sender alone would ignore relay completions of App-enqueued groups.

Does the design state these facts?

## Considered Options

- Record the relay facts — the merge-queue paragraph states that group membership is resolved from the queue ref and the group commit, not from `workflow_run.pull_requests`, and that echo filtering never applies to relay completions; troubleshooting states that entries enqueued by automation with a job `GITHUB_TOKEN` get no relay run and time out
- No text change — the fail-closed statements already hold; the three facts stay in the probe record as implementation notes

## Decision Outcome

Chosen option: "Record the relay facts", because the silent timeout of entries enqueued with a job `GITHUB_TOKEN` is visible to users and belongs in troubleshooting, and the other two facts constrain how the relay identity and the current group membership can be validated; without them they would have to be rediscovered when the merge queue is implemented.

Group membership is resolved from the queue ref and the group commit, not from `workflow_run.pull_requests`, which is empty for relay runs. Echo filtering never applies to a relay completion: the `workflow_run` sender is the enqueuer, which is the App bot when the App enqueued the entry. Entries enqueued by automation with a job `GITHUB_TOKEN` get no relay run and time out.

### Consequences

- The paragraph starting "Merge queue:" in [architecture §6.4](../architecture.md) states the membership and echo rules; [SP12](../processes.md) step 6 applies them.
- The [troubleshooting guide](../user-manual/troubleshooting.md) has a row for queue entries enqueued with a job `GITHUB_TOKEN`.
- The merge queue, and with it the relay, exists only where GitHub offers it for the repository's plan and visibility ([ADR-0025](0025-ruleset-dependent-controls-limitation.md)).

## More Information

- The project owner decided this on September 25, 2026.
