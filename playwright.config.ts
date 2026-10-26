import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/* iPad Safari is the primary target, so the sizes here are the ones the brief
   names: an iPad both ways up, and a 375px phone, in Chromium. CI also runs
   everything in WebKit, Safari's engine, at the iPad's size: speech, audio,
   pointer events and the offline worker are where the engines differ, and
   Chromium alone passed things Safari might not. Set PW_WEBKIT=1 to run it
   elsewhere, once `npx playwright install webkit` has fetched it. */
const WEBKIT = !!process.env.CI || !!process.env.PW_WEBKIT;
/* Use the browser Playwright installed for itself; PLAYWRIGHT_CHROMIUM points
   at another one where the environment ships its own. */
const PRESET = process.env.PLAYWRIGHT_CHROMIUM;
const CHROME = PRESET && existsSync(PRESET) ? PRESET : undefined;
const chrome = { ...devices['Desktop Chrome'], launchOptions: CHROME ? { executablePath: CHROME } : {} };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /* a GitHub runner has four cores; CI runs each device as its own job (.github/workflows/ci.yml) */
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'ipad-portrait', use: { ...chrome, viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'ipad-landscape', use: { ...chrome, viewport: { width: 1180, height: 820 }, hasTouch: true } },
    { name: 'phone', use: { ...chrome, viewport: { width: 375, height: 667 }, hasTouch: true } },
    ...(WEBKIT ? [{ name: 'ipad-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 820, height: 1180 }, hasTouch: true } }] : []),
  ],
  webServer: {
    /* CI has just built it in its own step, and building twice only costs time */
    command: process.env.CI
      ? 'npx vite preview --port 4173 --strictPort'
      : 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
