import { describe, expect, it } from 'vitest';
import {
  classifyPath,
  changedPathSet,
  consistentCategories,
  isTrustedPath,
  isExecutionSensitivePath,
  isPolicyDirectoryPath,
  detectPathFlags,
} from './paths.js';
import type { PathChange, PathClass } from './paths.js';

const TEST_PATHS = [
  'src/test/a.ts',
  'packages/core/src/index.test.ts',
  'tests/test_parse.py',
  'conftest.py',
  'spec/models/user_spec.rb',
  'src/FooTest.java',
  'fixtures/policies/valid/minimal.yml',
  'test/helpers/setup.ts',
];

const DOCS_PATHS = [
  'README.md',
  'docs/architecture.md',
  'LICENSE',
  '.github/CONTRIBUTING.md',
  'man/steward.1',
  'CHANGELOG',
  'docs/diagram.png',
];

const INFRA_PATHS = [
  '.github/workflows/ci.yml',
  'package.json',
  'packages/core/package.json',
  'pnpm-lock.yaml',
  'Cargo.toml',
  'CMakeLists.txt',
  '.gitignore',
  'src/.eslintrc.json',
  'config/app.yml',
  'scripts/release.sh',
  'tools/gen.ts',
  '.vscode/settings.json',
  'Dockerfile',
  'ci/build.sh',
];

const CODE_PATHS = [
  'src/index.ts',
  'lib/parse.rs',
  'data/values.json',
  'src/main.cpp',
  'packages/core/src/index.ts',
  'sub/scripts/x.sh',
];

describe('paths', () => {
  it('path classes follow the precedence test, docs, infra, code', () => {
    for (const path of TEST_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('test');
    }
    for (const path of DOCS_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('docs');
    }
    for (const path of INFRA_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('infra');
    }
    for (const path of CODE_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('code');
    }
  });

  it('path class table covers every list group', () => {
    for (const path of TEST_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('test');
    }
    for (const path of DOCS_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('docs');
    }
    for (const path of INFRA_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('infra');
    }
    for (const path of CODE_PATHS) {
      expect(classifyPath(path)).toBe<PathClass>('code');
    }
  });

  it('docs category needs docs paths and allows test paths', () => {
    expect(consistentCategories(['README.md'])).toEqual(['docs', 'chore']);
    expect(consistentCategories(['README.md', 'src/test/a.ts'])).toEqual(['docs', 'chore']);
    expect(consistentCategories(['src/index.ts', 'README.md'])).not.toContain('docs');
  });

  it('chore category needs docs or infra paths and no code path', () => {
    expect(consistentCategories(['package.json'])).toEqual(['chore']);
    expect(consistentCategories(['package.json', 'README.md'])).toEqual(['chore']);
    expect(consistentCategories(['src/test/a.ts'])).toEqual([]);
  });

  it('code categories need a code path', () => {
    expect(consistentCategories(['src/index.ts'])).toEqual(['bugfix', 'feature', 'refactor', 'security']);
    expect(consistentCategories(['src/index.ts', 'package.json', 'src/index.test.ts'])).toEqual([
      'bugfix',
      'feature',
      'refactor',
      'security',
    ]);
  });

  it('an empty diff is consistent with no category', () => {
    expect(consistentCategories([])).toEqual([]);
  });

  it('renamed and copied paths contribute both paths', () => {
    const changes: readonly PathChange[] = [
      { kind: 'renamed', path: 'src/b.ts', previousPath: 'docs/a.md' },
      { kind: 'copied', path: 'lib/c.ts', previousPath: 'lib/a.ts' },
      { kind: 'modified', path: 'src/b.ts', previousPath: null },
      { kind: 'deleted', path: 'old.txt', previousPath: null },
    ];
    expect(changedPathSet(changes)).toEqual(['docs/a.md', 'lib/a.ts', 'lib/c.ts', 'old.txt', 'src/b.ts']);

    const modifiedWithPrevious: readonly PathChange[] = [{ kind: 'modified', path: 'src/b.ts', previousPath: 'src/old.ts' }];
    expect(changedPathSet(modifiedWithPrevious)).toEqual(['src/b.ts']);
  });

  it('trusted and execution-sensitive detection covers every list group', () => {
    const executionSensitiveTrue = [
      'packages/cli/package.json',
      'vitest.config.ts',
      'packages/core/tsconfig.test.json',
      'crates/x/Cargo.toml',
      '.cargo/config.toml',
      'src/CMakeLists.txt',
      'cmake/warnings.cmake',
      'build/app.vcxproj',
      'go.mod',
      'requirements-dev.txt',
      'Gemfile',
      'widget.gemspec',
      'gradle/wrapper/gradle-wrapper.properties',
      'pom.xml',
      'src/App/App.csproj',
      '.config/dotnet-tools.json',
      'composer.json',
      'mix.exs',
      'BUILD.bazel',
      'tools/defs.bzl',
      'Dockerfile.dev',
      'compose.yaml',
      '.gitmodules',
      'test/reporters/junit.ts',
      'jest-reporter.config.js',
      'tests/helpers/fixtures.ts',
      'src/test-utils/render.tsx',
      'vitest.setup.ts',
      'scripts/ci.sh',
    ];
    const executionSensitiveFalse = [
      'src/index.ts',
      'docs/package.json.md',
      'sub/scripts/x.sh',
      'README.md',
      '.github/workflows/ci.yml',
    ];
    for (const path of executionSensitiveTrue) {
      expect(isExecutionSensitivePath(path, [])).toBe(true);
    }
    for (const path of executionSensitiveFalse) {
      expect(isExecutionSensitivePath(path, [])).toBe(false);
    }

    const trustedTrue = [
      '.github/workflows/ci.yml',
      '.github/actions/setup/action.yml',
      'action.yml',
      'sub/action.yaml',
      '.github/patch-steward/policy.yml',
      'CODEOWNERS',
      '.github/CODEOWNERS',
      'docs/CODEOWNERS',
      '.gitlab-ci.yml',
      '.circleci/config.yml',
      'Jenkinsfile',
      'ci/build.sh',
      'azure-pipelines.yml',
    ];
    const trustedFalse = ['src/ci/x.ts', 'src/index.ts', '.github/ISSUE_TEMPLATE/bug.yml', 'package.json'];
    for (const path of trustedTrue) {
      expect(isTrustedPath(path, [])).toBe(true);
    }
    for (const path of trustedFalse) {
      expect(isTrustedPath(path, [])).toBe(false);
    }
  });

  it('project additions extend trusted and execution-sensitive paths', () => {
    expect(isTrustedPath('deploy/prod.sh', ['deploy/**'])).toBe(true);
    expect(isTrustedPath('deploy/prod.sh', [])).toBe(false);
    expect(isExecutionSensitivePath('src/test-env.ts', ['src/test-env.ts'])).toBe(true);
    expect(isExecutionSensitivePath('src/test-env.ts', [])).toBe(false);
    expect(classifyPath('deploy/prod.sh')).toBe<PathClass>('code');
  });

  it('policy directory paths are flagged', () => {
    expect(isPolicyDirectoryPath('.github/patch-steward/policy.yml')).toBe(true);
    expect(isPolicyDirectoryPath('.github/patch-steward')).toBe(true);
    expect(isPolicyDirectoryPath('.github/patch-steward/runner/Dockerfile')).toBe(true);
    expect(isPolicyDirectoryPath('.github/patch-steward-x/a')).toBe(false);
    expect(isPolicyDirectoryPath('docs/.github/patch-steward/policy.yml')).toBe(false);

    expect(
      detectPathFlags(['src/a.ts', '.github/workflows/ci.yml', 'package.json', '.github/patch-steward/policy.yml'], {
        trusted: [],
        executionSensitive: [],
      }),
    ).toEqual({
      trusted: ['.github/patch-steward/policy.yml', '.github/workflows/ci.yml'],
      executionSensitive: ['package.json'],
      policy: ['.github/patch-steward/policy.yml'],
    });
  });
});
