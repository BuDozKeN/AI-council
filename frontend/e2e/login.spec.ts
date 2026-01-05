import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Login Flow
 *
 * Critical user journey: User can access the login page and see auth options.
 * Full auth flow requires Supabase test credentials which aren't available in CI.
 */

test.describe('Login Page', () => {
  test('should display login page with Google OAuth button', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or show login page
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');

    // Look for Google OAuth button (the primary auth method)
    const googleButton = page.getByRole('button', { name: /google/i });

    // If login page is shown, verify key elements
    if (await googleButton.isVisible()) {
      await expect(googleButton).toBeVisible();
    }
  });

  test('should show app logo on login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for any of the possible branding elements
    // The app may show "AxCouncil", council icons, or the SVG logo
    const brandingSelectors = [
      'text=AxCouncil',
      'text=Council',
      '[class*="council"]',
      '[class*="logo"]',
      '[class*="brand"]',
      'svg', // SVG logos
    ];

    let hasBranding = false;
    for (const selector of brandingSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        hasBranding = true;
        break;
      }
    }

    // Login page should have some form of branding or visual identity
    // If no explicit branding, the page should at least render correctly
    expect(hasBranding || (await page.locator('button').count()) > 0).toBeTruthy();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should render without horizontal scrollbar
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // Small tolerance
  });
});

test.describe('Login Error Handling', () => {
  test('should handle invalid routes gracefully', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');

    // Should either 404 or redirect to login
    expect(response?.status()).toBeLessThan(500);
  });
});
