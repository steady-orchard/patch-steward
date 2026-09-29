import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCheckoutArchive } from './checkout.js';
import { createFixtureRepository, loadFixtureManifest, readArchiveEntries } from './fixture-repository.fixture.test.js';

describe('checkout archive from a real repository', { timeout: 60000 }, () => {
  it('builds an archive from a real repository', async () => {
    const repo = createFixtureRepository(loadFixtureManifest('hostile-materialization.json'));
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-checkout-'));
    try {
      const result = await buildCheckoutArchive({
        repo: { repoDir: repo.dir, env: repo.env, configArgs: [] },
        commit: repo.commit,
        overlay: [],
        limits: { checkoutFiles: 100000, checkoutBytes: 536870912, overlayFiles: 200, overlayBytes: 10485760 },
        timeoutMs: 60000,
        outputDir,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const entries = readArchiveEntries(result.value.archivePath);
      const find = (p: string) => entries.find((e) => e.path === p);
      expect(find('checkout/README.md')?.content?.equals(Buffer.from('line one\r\nline two\r\n'))).toBe(true);
      expect(find('checkout/bin/tool.sh')?.mode).toBe(0o755);
      expect(find('checkout/bin/tool.sh')?.content?.toString('utf8')).toContain('$Format:%H$');
      expect(find('checkout/escape')?.kind).toBe('symlink');
      expect(find('checkout/escape')?.linkTarget).toBe('../../../../etc/passwd');
      expect(find('checkout/absolute')?.kind).toBe('symlink');
      expect(find('checkout/absolute')?.linkTarget).toBe('/etc/shadow');
      expect(entries.some((e) => e.path.startsWith('checkout/vendor/evil'))).toBe(false);
      expect(result.value.facts.skipped_submodules).toEqual(['vendor/evil']);
      expect(result.value.facts.tree).toBe(repo.tree);
      expect(result.value.facts.files).toBe(8);
    } finally {
      repo.dispose();
      fs.rmSync(outputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
