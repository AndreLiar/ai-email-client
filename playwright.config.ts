import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: true },
      testMatch: 'e2e/smoke.test.ts',
    },
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        headless: false,
        storageState: 'e2e/auth-state.json',
        video: 'on',
        screenshot: 'on',
        trace: 'on',
        launchOptions: { slowMo: 200 },
      },
      testMatch: 'e2e/flow.test.ts',
    },
  ],
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  outputDir: 'e2e/results',
});
