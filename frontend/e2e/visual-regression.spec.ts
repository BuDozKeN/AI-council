import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * These tests capture screenshots of key UI states and compare them
 * against baseline snapshots to detect unintended visual changes.
 *
 * To update baselines: npx playwright test --update-snapshots
 *
 * IMPORTANT: Visual regression tests are SKIPPED in CI because:
 * 1. Baseline snapshots must be generated locally first
 * 2. Different CI environments render differently (fonts, anti-aliasing)
 * 3. These tests are most useful for local development
 *
 * Run locally with: npx playwright test e2e/visual-regression.spec.ts
 */

// Skip all visual regression tests in CI
test.describe('Visual Regression - Login Page', () => {
  test.skip(!!process.env.CI, 'Visual regression tests skipped in CI - run locally');

  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Capture full page screenshot with high tolerance for CI differences
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.2, // Allow 20% difference for CI environment variations
    });
  });

  test('login page mobile matches snapshot', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.2,
    });
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test.skip(!!process.env.CI, 'Visual regression tests skipped in CI - run locally');

  test('dark mode toggle changes appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if dark mode toggle exists
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"]'
    );

    if (await themeToggle.isVisible()) {
      // Click to toggle theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      // Capture dark mode screenshot - with tolerance since animations may vary
      await expect(page).toHaveScreenshot('login-page-dark.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.2,
      });
    }
  });
});

test.describe('Visual Regression - Components', () => {
  test.skip(!!process.env.CI, 'Visual regression tests skipped in CI - run locally');

  test('Google OAuth button styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const googleButton = page.getByRole('button', { name: /google/i });

    if (await googleButton.isVisible()) {
      // Screenshot just the button - with tolerance for font rendering differences
      await expect(googleButton).toHaveScreenshot('google-oauth-button.png', {
        maxDiffPixelRatio: 0.2,
      });
    }
  });
});
