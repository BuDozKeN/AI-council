import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * These tests capture screenshots of key UI states and compare them
 * against baseline snapshots to detect unintended visual changes.
 *
 * To update baselines: npx playwright test --update-snapshots
 */

test.describe('Visual Regression - Login Page', () => {
  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Capture full page screenshot
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
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
    });
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test('dark mode toggle changes appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if dark mode toggle exists
    const themeToggle = page.locator('[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"]');

    if (await themeToggle.isVisible()) {
      // Click to toggle theme
      await themeToggle.click();
      await page.waitForTimeout(300);

      // Capture dark mode screenshot
      await expect(page).toHaveScreenshot('login-page-dark.png', {
        fullPage: true,
      });
    }
  });
});

test.describe('Visual Regression - Components', () => {
  test('Google OAuth button styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const googleButton = page.getByRole('button', { name: /google/i });

    if (await googleButton.isVisible()) {
      // Screenshot just the button
      await expect(googleButton).toHaveScreenshot('google-oauth-button.png');
    }
  });
});
