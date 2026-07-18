import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for RevealPeerJS e2e tests
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Tests may interfere with each other (same lobby)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run sequentially to avoid lobby conflicts
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'pnpm test-server',
    url: 'http://localhost:8080',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
