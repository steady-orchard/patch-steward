# ADR-0058: GitHub read adapter without an SDK dependency

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.3

## Context and Problem Statement

Intake and preflight read repositories, issues, pull requests and their files, the open pull requests sharing
a commit, issue comments, and the policy directory. Every response is untrusted data that invariant 5 requires
runtime validation for, and every read is bounded by `limits.github.*`. The policy revision read through the
API must equal the git tree id that [ADR-0038](0038-policy-revision-git-tree-id.md) defined, whose API path
was not implemented at the time. The project adds no dependency without need. What client reads GitHub, and
how does it stay within these constraints?

## Considered Options

- REST over the built-in fetch — plain HTTP calls to the REST API using Node's fetch, with the steward's own
  validation and pagination
- Octokit — the GitHub-maintained SDK client
- GraphQL — a single query language client for every read

## Decision Outcome

Chosen option: "REST over the built-in fetch", because every response shape stays under the steward's own
runtime validation regardless of what a client library would parse, REST covers every read needed so far, and
the fetch function is trivial to replace in tests with recorded responses. Octokit and GraphQL clients would
add a dependency and their own response typing that the steward would still have to re-validate at runtime.

The adapter calls only `https://api.github.com` (`GITHUB_API_URL` is never read), sending
`Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28` on every request, with an
injectable fetch function so tests substitute recorded responses. Each response is capped at 5242880 bytes and
validated with a schema that ignores unknown keys and checks only the required ones. Pagination follows `Link`
headers for at most 30 pages of 100 items each, and only follows next links that stay on `https://api.github.com`.
Every request and retry is charged against a budget: `limits.github.requests_per_run` and `retries_per_request`
from the policy, or 20 requests with 2 retries before a policy is known. Retries apply only to server errors,
network errors, and rate limits, honoring wait times up to 60 seconds; redirects are never followed. Failures
are typed `github.*`: `github-unavailable` or `rate-limited` causes, `github.unauthorized` for a 401 or a 403
without a rate-limit signal, and `github.not-found` for a 404.

The policy source resolves the branch to a commit, reads the `.github` contents listing at that commit, and
takes the `sha` of the `patch-steward` entry as the revision, equal to
`git rev-parse <commit>:.github/patch-steward`. It then reads the recursive tree, never truncated, and reads
`policy.yml` as a regular blob, reporting "no published policy" when the directory or file is absent. Author
identity is read into results but never enters a contract input.

### Consequences

- [Architecture §6.3](../architecture.md) describes the adapter's requests, budgets, and failure typing.
- Recorded responses in `fixtures/github/` and the live tier ([ADR-0061](0061-live-probe-test-runner.md)) check
  that recorded shapes match what GitHub serves.
- GraphQL and any write operation are not implemented by this adapter.

## More Information

- The project owner decided this on September 26, 2026.
