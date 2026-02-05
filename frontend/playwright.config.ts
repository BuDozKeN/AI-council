import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Enhanced with AI-powered testing capabilities for $25M exit readiness
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI for stability */
  workers: process.env.CI ? 1 : undefined,
  /* Global timeout for each test */
  timeout: 30 * 1000,
  /* Expect timeout */
  expect: {
    timeout: 10 * 1000,
    toHaveScreenshot: {
      /* Allow 1% pixel difference for anti-aliasing */
      maxDiffPixelRatio: 0.01,
      /* Animation must be stable before screenshot */
      animations: 'disabled',
    },
  },
  /* Reporter to use */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    /* JSON reporter for CI/CD integration */
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  /* Output directory for test artifacts */
  outputDir: 'test-results',
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'on-first-retry',
    /* Viewport size */
    viewport: { width: 1280, height: 720 },
    /* Action timeout */
    actionTimeout: 15 * 1000,
    /* Navigation timeout */
    navigationTimeout: 30 * 1000,
  },

  /* Snapshot directory for visual regression tests */
  snapshotDir: './e2e/__snapshots__',

  /* Configure projects for major browsers and devices */
  projects: [
    /* Desktop Browsers */
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
    /* Mobile Viewports */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    /* Tablet Viewports */
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
    },
    /* Autonomous Exploration Project (AI-powered) */
    {
      name: 'explorer',
      testDir: './e2e/autonomous',
      use: {
        ...devices['Desktop Chrome'],
        /* Extended timeout for autonomous exploration */
        actionTimeout: 30 * 1000,
        navigationTimeout: 60 * 1000,
      },
      timeout: 5 * 60 * 1000, /* 5 minutes for exploration tests */
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
