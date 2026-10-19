import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4321',
    ...devices['Desktop Chrome'],
    channel: 'chrome', // uses the installed Google Chrome (no browser download)
    viewport: { width: 1400, height: 1038 },
    deviceScaleFactor: 1,
  },
  webServer: { command: 'npx astro preview --port 4321', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
});
