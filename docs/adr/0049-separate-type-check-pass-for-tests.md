# ADR-0049: Tests are type-checked by a separate compiler pass

- Status: accepted
- Date: 2026-09-26
- Deciders: project owner
- Source: `docs/user-manual/configuration.md` "TypeScript"

## Context and Problem Statement

Each package's `tsconfig.json` excludes `**/*.test.ts`, so `pnpm build` never compiled test files, and Vitest
strips types at run time without checking them. No Vitest type-check mode was configured, and ESLint's rules
here are not type-aware. Under the strict compiler options in force (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, and the rest of `tsconfig.base.json`), a test file could carry a type error that no
tool in the toolchain would ever report. What checks the types of test code?

## Considered Options

- Vitest typecheck mode — enable Vitest's type-check feature
- Type-aware ESLint — lint rules that require type information
- Tests in the package build — stop excluding tests from `tsc`, which would emit tests into `dist/`
- Separate compiler pass — `tsc --noEmit` over each package's sources and tests, run locally and in CI on both
  operating systems

## Decision Outcome

Chosen option: "Separate compiler pass", because it checks test files with exactly the same compiler options
the package build already uses, emits nothing, and leaves the build output, the Vitest configuration, and the
ESLint configuration untouched. Vitest's own type-check mode and type-aware ESLint rules would each add a
second place to configure compiler behavior and a different way of surfacing an error; including tests in the
package build would ship test files into `dist/`, which no package needs.

Each package gains a `tsconfig.test.json` that extends the package's own `tsconfig.json`, sets `noEmit: true`,
and removes the test exclusion so the package's source and test files are checked together with the package's
own compiler options. A root `pnpm typecheck` script runs this check across every package. The CLI package's
check configuration maps the `@patch-steward/core` specifier to the core package's sources with `paths`, and
sets `rootDir` to the packages directory, so the check needs no prior build of `core`. CI runs a Typecheck step
between the Compile and Test steps, on both Ubuntu and Windows.

### Consequences

- The configuration reference's TypeScript section documents `tsconfig.test.json` and the `pnpm typecheck`
  script.
- The command reference and the installation guide list `pnpm typecheck` alongside the other root scripts.
- `.github/workflows/ci.yml` runs a Typecheck step.
- The repository guidance file (`CLAUDE.md`) lists `pnpm typecheck` among the project's commands.

## More Information

- The project owner decided this on September 26, 2026.
