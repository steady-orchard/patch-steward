# ADR-0054: Attachment destinations, formats, and fetching

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/processes.md` SP06; `docs/architecture.md` §8, §13; `docs/user-manual/configuration.md` "Attachments"

## Context and Problem Statement

SP06 step 5 allows only approved public HTTPS destinations for attachments, with no private or link-local
redirects, no forwarded credentials, bytes hashed before handoff, and bounded count, size, redirects, time, and
decompression. GitHub stores attachments on its own hosts behind signed redirects
(`github.com/user-attachments/files/...` redirects to `objects.githubusercontent.com`, `.../assets/...` to an S3
host), and attachments of private repositories need authentication. Fetching a URL taken from submission text
risks reaching internal hosts. Which destinations may the steward fetch, in what formats, and with what
credentials?

## Decision Drivers

- Submission text is untrusted and must not be able to direct the steward at arbitrary network destinations.
- A required attachment that cannot be fetched must still resolve to a defined outcome, never a pass.

## Considered Options

- GitHub attachment hosts only, no credentials — allowlist GitHub's own attachment hosts, send no
  authentication, and hash bytes as they arrive
- Any public HTTPS host — allow any destination that resolves publicly
- Forward a GitHub token for private attachments — send an installation token so private-repository
  attachments resolve

## Decision Outcome

Chosen option: "GitHub attachment hosts only, no credentials", because an allowlist of GitHub's own hosts bounds
the fetch surface to destinations the platform itself controls, and sending no credential means submission text
can never make the steward read private data or leak a token; forwarding a token would attach a credential to a
URL chosen by untrusted text. Template destinations are `github.com`, `objects.githubusercontent.com`,
`github-production-user-asset-6210df.s3.amazonaws.com`, `user-images.githubusercontent.com`, and
`private-user-images.githubusercontent.com`; approved formats are `txt`, `log`, `md`, `json`, `patch`, `diff`,
`zip`, `gz`, `png`, `jpg`, `jpeg`, `gif`. An attachment is a URL with a GitHub attachment shape or on a
project-added destination, required when its field is required. Every hop must be `https`, on an approved host,
without user information or port, and resolve only to public addresses, with the connection made to the
checked address; redirects, time, per-file and total bytes are bounded. Bytes are SHA-256 hashed as they
arrive. No authorization header, cookie, token, or proxy credential is sent; images are never decoded; zip
(stored or deflated entries only) and gzip archives are inspected under entry, name, and decompression bounds
and never extracted.

A violation is `submission.attachment-violation` (`needs-changes`); a fetch failure is the cause
`attachment-fetch-failed` (`inconclusive`) for a required attachment and the advisory
`submission.attachment-unavailable` for an optional one, and an attachment that needs authentication fails like
any other fetch. `steward preflight` checks URLs statically and never fetches.

### Consequences

- The policy template carries these destination and format values.
- [SP06](../processes.md) step 5 states the rules.
- [Architecture §13](../architecture.md) lists the threat and its mitigations.
- A required attachment in a private repository must be inlined as a fenced code block.

## More Information

- The project owner decided this on September 26, 2026.
