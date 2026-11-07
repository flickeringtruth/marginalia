/* End-to-end tests (dev only, not shipped). Run: npm run e2e   (first time: npx playwright install chromium webkit)
   Four projects cover the phone (iPhone SE and 15 sizes) and desktop, in Chromium and WebKit.
   The voice Worker is mocked, so the tests need no network apart from the CDN scripts the app loads (JSZip). */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.mjs',
  timeout: 60000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'node e2e/serve.mjs 4173', url: 'http://127.0.0.1:4173/index.html', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium-iphone15', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } } }
  ]
});
