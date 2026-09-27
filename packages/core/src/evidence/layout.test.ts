import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixedRandom } from '../clock.js';
import { LOCAL_RUN_ID_PATTERN } from '../records/common.js';

import {
  RUN_FILES,
  executionFilePath,
  findingFilePath,
  findingId,
  localEvidenceLocation,
  localRunId,
  maintainerActionFilePath,
  metricsStorePath,
  recordTypeForPath,
  repositoryStoreRoot,
  runStorePath,
  stagingStorePath,
} from './layout.js';

describe('evidence layout', () => {
  it('local run ids combine the UTC start time and 32 random bits', () => {
    const id = localRunId(new Date('2026-09-27T10:15:00.120Z'), fixedRandom('3f9a1c2e'));
    expect(id).toBe('local-20260927T101500Z-3f9a1c2e');
    expect(LOCAL_RUN_ID_PATTERN.test(id)).toBe(true);
  });

  it('run directories follow the approved layout', () => {
    const id = 'local-20260927T101500Z-3f9a1c2e';
    expect(runStorePath('pull_request', 12, id, 1)).toBe(`runs/pr-12/${id}`);
    expect(runStorePath('issue', 29, id, 1)).toBe(`runs/issue-29/${id}`);
    expect(runStorePath('pull_request', 12, 123456, 2)).toBe('runs/pr-12/123456-2');
    expect(stagingStorePath(id, 1)).toBe(`runs/.staging/${id}`);
    expect(findingId(12)).toBe('finding-0012');
    expect(findingFilePath(1)).toBe('findings/finding-0001.json');
    expect(executionFilePath(1)).toBe('executions/execution-0001.json');
    expect(maintainerActionFilePath(1)).toBe('maintainer-actions/action-0001.json');
    expect(() => findingId(0)).toThrow(RangeError);
    expect(() => findingId(10000)).toThrow(RangeError);
    expect(RUN_FILES.run).toBe('run.json');
    expect(RUN_FILES.submission).toBe('submission.json');
    expect(RUN_FILES.policyRevision).toBe('policy-revision.json');
    expect(RUN_FILES.decision).toBe('decision.json');
    expect(RUN_FILES.report).toBe('report.json');
    expect(RUN_FILES.reportMarkdown).toBe('report.md');
    expect(RUN_FILES.log).toBe('logs/steward.txt');
  });

  it('metrics files use the monthly partition of the run start', () => {
    const id = 'local-20260927T101500Z-3f9a1c2e';
    expect(metricsStorePath('2026-09-30T23:59:59.000Z', id, 1)).toBe(`metrics/2026-09/${id}.json`);
  });

  it('record types follow the file names', () => {
    expect(recordTypeForPath('run.json')).toBe('run');
    expect(recordTypeForPath('submission.json')).toBe('submission');
    expect(recordTypeForPath('policy-revision.json')).toBe('policy-revision');
    expect(recordTypeForPath('decision.json')).toBe('decision');
    expect(recordTypeForPath('report.json')).toBe('report');
    expect(recordTypeForPath('findings/finding-0001.json')).toBe('finding');
    expect(recordTypeForPath('executions/execution-0001.json')).toBe('execution-record');
    expect(recordTypeForPath('maintainer-actions/action-0001.json')).toBe('maintainer-action');
    expect(recordTypeForPath('report.md')).toBeNull();
    expect(recordTypeForPath('logs/steward.txt')).toBeNull();
    expect(recordTypeForPath('manifest.json')).toBeUndefined();
    expect(recordTypeForPath('notes.txt')).toBeUndefined();
    expect(recordTypeForPath('../run.json')).toBeUndefined();
    expect(recordTypeForPath('findings/finding-1.json')).toBeUndefined();
  });

  it('repository store roots reject unsafe names', () => {
    const good = repositoryStoreRoot('/tmp/e', 'octo/demo');
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.value).toBe(path.join('/tmp/e', 'octo', 'demo'));
    }

    for (const repository of ['octo/..', 'octo/.', 'bad', 'a/b/c']) {
      const result = repositoryStoreRoot('/tmp/e', repository);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.code).toBe('evidence.layout-invalid');
      }
    }
  });

  it('evidence locations are store-relative paths', () => {
    const location = localEvidenceLocation('runs/pr-12/x');
    expect(location('')).toBe('runs/pr-12/x');
    expect(location('findings/finding-0001.json')).toBe('runs/pr-12/x/findings/finding-0001.json');
  });
});
