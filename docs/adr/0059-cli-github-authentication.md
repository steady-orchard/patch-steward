# ADR-0059: CLI GitHub authentication

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §6.5; `docs/user-manual/commands.md` "`steward preflight`"

## Context and Problem Statement

The local CLI reads GitHub with the user's own credentials rather than an installation token. Architecture §6.5
named `gh auth` or a personal access token as the two sources without stating an order. A token must never be
stored or printed, and public repositories should be readable without one. What credential does the CLI look
for, in what order, and how does it react when none works?

## Considered Options

- Environment variables, then the GitHub CLI — check `GH_TOKEN`, then `GITHUB_TOKEN`, then ask the installed
  `gh` for a token
- A steward-specific token variable or file — a dedicated credential source separate from existing conventions
- The GitHub CLI only — always defer to `gh auth token`, ignoring environment variables

## Decision Outcome

Chosen option: "Environment variables, then the GitHub CLI", because this order matches existing GitHub CLI
and Actions conventions, needs no new secret store, and lets a user override a stale `gh` session with an
environment variable. Deferring to `gh` alone would ignore the same variables Actions and other tools already
set; a steward-specific variable would just duplicate an existing convention.

The CLI checks `GH_TOKEN`, then `GITHUB_TOKEN`, then runs `gh auth token --hostname github.com` through the
bounded process runner (10 seconds, 4096 bytes of output), only when `gh` is installed and with token and host
variables removed from its own environment. An absent or failing `gh` means no token was found. A variable that
is set but unusable is reported as `auth.token-invalid`. The token is never stored or printed. Without any
token, public reads proceed unauthenticated with the warning `github.unauthenticated`; a missing or private
repository then exits with status 2 and asks the user for a token. A token GitHub rejects exits with status 2
(`preflight.token-rejected`) with no unauthenticated fallback, because falling back silently would hide a wrong
token rather than surface it.

### Consequences

- [Architecture §6.5](../architecture.md) states the credential order.
- The command reference documents `auth.token-invalid`, `github.unauthenticated`, and `preflight.token-rejected`.
- Tests prove the token never appears in command output, logs, or error messages.

## More Information

- The project owner decided this on September 26, 2026.
