import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Cowork Tasks artifact e2e suite.
 *
 * Key differences from the default:
 *   - `slowMo: 120` slows pointer/keyboard events to look like a real user
 *     in recorded videos.
 *   - `video: { mode: 'on', size: { width: 1440, height: 900 } }` records
 *     every test at full viewport.
 *   - Each test injects a CSS cursor + click ripple via
 *     `addInitScript` (see `test/e2e/cursor.ts`) so the recorded video shows
 *     where the user is clicking.
 *   - Generous default `expect` timeout so polled assertions (which wait
 *     for the artifact's 2-second polling) don't flake under slowMo.
 */
export default defineConfig({
  testDir: './test/e2e',
  outputDir: './test/e2e/.results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './test/e2e/.report', open: 'never' }],
  ],
  retries: 0,
  fullyParallel: false,
  expect: { timeout: 10_000 },
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:5179',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: { mode: 'on', size: { width: 1680, height: 960 } },
    viewport: { width: 1680, height: 960 },
    launchOptions: {
      // Slows pointer events and key presses so videos read like a real
      // user. Headed runs feel sluggish; headless videos look natural.
      slowMo: 120,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1680, height: 960 },
      },
    },
  ],
  webServer: {
    command: 'node test/e2e/server.mjs',
    url: 'http://127.0.0.1:5179/__health',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30_000,
  },
});
