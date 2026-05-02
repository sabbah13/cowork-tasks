import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the artifact package.
 *
 * E2E tests under `test/e2e/**` use Playwright's runner, not Vitest. Exclude
 * them so `vitest run` doesn't try to load them as Vitest specs.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'test/e2e/**'],
  },
});
