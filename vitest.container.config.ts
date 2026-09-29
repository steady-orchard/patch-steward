import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const coreSource = fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@patch-steward/core': coreSource } },
  test: {
    include: ['packages/*/src/**/*.container.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    fileParallelism: false,
    testTimeout: 300000,
    hookTimeout: 300000,
  },
});
