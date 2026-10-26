import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/desktop', globalSetup: './e2e/desktop/DesktopSetup.ts',
  fullyParallel: false, workers: 1, retries: 0, forbidOnly: !!process.env.CI,
  timeout: process.env.CHESSVUE_DESKTOP_INTERACTIVE === '1' ? 600000 : 90000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/DesktopResults.json' }]],
  projects: [{ name: 'desktop', testMatch: '**/*.spec.ts' }],
});
