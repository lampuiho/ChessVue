import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/GlobalSetup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/JourneyResults.json' }]],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: [
    { name: 'browser', testMatch: 'Browser.spec.ts', use: { baseURL: 'http://127.0.0.1:4173' } },
    { name: 'journeys', testMatch: 'journeys/**/*.spec.ts', use: { baseURL: 'http://127.0.0.1:4174' } },
  ],
});
