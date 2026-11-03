// Browser E2E for the customer + manufacturer app. Runs against a local mira-backend (see support/globalSetup.js)
// pointed at the dev database, with fresh throwaway users per run.
//   E2E_ALLOW_DB=dev E2E_USERS_FILE=../test-users.txt npm run test:e2e
import { defineConfig, devices } from '@playwright/test';

export const E2E_API_PORT = Number(process.env.E2E_PORT || 9101);
export const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT || 5201);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  outputDir: './.results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: './.report', open: 'never' }]],
  globalSetup: './support/globalSetup.js',
  globalTeardown: './support/globalTeardown.js',
  use: {
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 780 }, channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npx vite --port ${E2E_WEB_PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${E2E_WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_URL: `http://127.0.0.1:${E2E_API_PORT}` },
  },
});
