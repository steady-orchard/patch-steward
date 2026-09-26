import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const coreSource = fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@patch-steward/core': coreSource } },
  test: {
    include: ['packages/*/src/**/*.live.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
