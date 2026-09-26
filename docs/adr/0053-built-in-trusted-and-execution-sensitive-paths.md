# ADR-0053: Built-in trusted and execution-sensitive path lists

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/architecture.md` §8; `docs/user-manual/configuration.md` "Built-in trusted paths" and "Built-in execution-sensitive paths"

## Context and Problem Statement

Architecture §8 named built-in trusted and execution-sensitive path lists without settling their contents. The
policy can only add to these lists (`.additional`), never remove from them, so their starting coverage matters.
Screening must work for repositories in any language, and which compiled ecosystem's result parsing is
supported first, Rust or C++, was not yet chosen.

## Considered Options

- Broad, ecosystem-generic built-in lists — cover common CI, build, and test tooling paths across many
  ecosystems from the start
- Minimal lists with project additions — only workflow definitions and the policy directory built in, with
  everything else left to `.additional`
- Lists detected from the repository's toolchain — infer trusted and execution-sensitive paths by reading the
  repository's own configuration

## Decision Outcome

Chosen option: "Broad, ecosystem-generic built-in lists", because minimal lists would miss the files that most
often change how tests run, leaving most projects to rediscover and add the same patterns themselves; detecting
the lists from the repository's own toolchain would mean reading untrusted repository content to decide what is
sensitive, which is circular. A false positive, such as `scripts/**` or `**/harness/**` holding product code, or
a formatter configuration file matching a build-tooling pattern, costs maintainer triage but never causes a
rejection, and projects can extend the lists further but cannot remove entries.

Trusted paths cover workflow definitions and actions, the policy directory, `CODEOWNERS`, CI scripts, and the
configuration of common CI services. Execution-sensitive paths cover manifests, lockfiles, package-manager,
build, and test configuration, reporters, shared test helpers, harness code, repository mechanics, and
`scripts/**`, across JavaScript and TypeScript, Rust, C and C++, Go, Python, Ruby, JVM, .NET, PHP and Elixir,
Bazel, and containers, so both candidate compiled ecosystems are covered before either is chosen. A path may
match both lists at once. A trusted-path match adds the advisory `submission.trusted-path-change` and prevents
reliance on PR-controlled CI. An execution-sensitive match adds `submission.execution-sensitive-change`
(`uncertain`, maintainer triage).

### Consequences

- [Architecture §8](../architecture.md) describes the lists by group.
- The [configuration reference](../user-manual/configuration.md) lists every built-in pattern.
- [SP06 step 6](../processes.md) applies these lists when screening a diff.

## More Information

- The project owner decided this on September 26, 2026.
