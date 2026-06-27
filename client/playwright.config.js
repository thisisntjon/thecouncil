import { defineConfig, devices } from '@playwright/test';

// Deterministic, fully-mocked UI-QA suite for "The Council".
// The app is assumed to be ALREADY RUNNING (Vite on :5173) — we never start a webServer here.
// All provider/network traffic is intercepted via page.route in tests/e2e/mock.js ($0, offline).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../artifacts/ui-qa/playwright-report', open: 'never' }],
  ],
  // Keep traces/test-results local to client/ (gitignored build noise).
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on-first-retry',
    // Freeze CSS animations/spinners for stable visual diffs.
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Tailwind animate-spin/pulse + framer-motion entrance settle quickly;
      // disable animations and allow a tiny pixel budget for AA/subpixel noise.
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
  ],
});
