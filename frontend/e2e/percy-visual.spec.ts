import { test } from '@playwright/test';

/**
 * Percy Visual Testing Integration
 *
 * Percy captures screenshots and compares them in the cloud with AI-powered
 * visual diffing. Unlike Playwright's built-in screenshots, Percy:
 * - Renders in real cloud browsers (not emulation)
 * - Uses AI to ignore noise (animations, dynamic content, ads)
 * - Provides a team review UI for approving/rejecting changes
 * - Tracks visual history over time
 *
 * Setup:
 *   1. Sign up at https://percy.io and create a project
 *   2. Set PERCY_TOKEN in your environment / CI secrets
 *   3. Run: npx percy exec -- npx playwright test e2e/percy-visual.spec.ts
 *
 * Without PERCY_TOKEN set, Percy commands are no-ops (tests still pass).
 */

// Percy snapshot helper -- dynamic import so tests don't fail without @percy/playwright
async function percySnapshot(page: ReturnType<typeof test['info']> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]['page'] extends infer P ? P : never, name: string, options?: Record<string, unknown>) {
  try {
    const { percySnapshot: snap } = await import('@percy/playwright');
    await snap(page, name, options);
  } catch {
    // Percy not available or PERCY_TOKEN not set -- skip silently
  }
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  tablet: { width: 834, height: 1194 },
  mobile: { width: 390, height: 844 },
} as const;

test.describe('Percy Visual Tests - Core Screens', () => {
  test('Login / Landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // settle animations

    await percySnapshot(page, 'Login Page - Desktop');

    await page.setViewportSize(VIEWPORTS.tablet);
    await percySnapshot(page, 'Login Page - Tablet');

    await page.setViewportSize(VIEWPORTS.mobile);
    await percySnapshot(page, 'Login Page - Mobile');
  });

  test('Login page - Dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Toggle dark mode
    const toggle = page.locator('[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"]');
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(300);
      await percySnapshot(page, 'Login Page - Dark Mode');
    }
  });
});

test.describe('Percy Visual Tests - App Screens', () => {
  // These require authentication. In CI, mock auth or skip.
  const SCREENS = [
    { path: '/', name: 'Chat Interface' },
    { path: '/mycompany', name: 'MyCompany Dashboard' },
    { path: '/mycompany?tab=team', name: 'Team Tab' },
    { path: '/mycompany?tab=projects', name: 'Projects Tab' },
    { path: '/mycompany?tab=knowledge', name: 'Knowledge Tab' },
    { path: '/settings', name: 'Settings' },
    { path: '/settings/account', name: 'Account Settings' },
    { path: '/settings/company', name: 'Company Settings' },
  ];

  for (const screen of SCREENS) {
    test(`${screen.name} - responsive snapshots`, async ({ page }) => {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Desktop
      await percySnapshot(page, `${screen.name} - Desktop`);

      // Mobile
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(300);
      await percySnapshot(page, `${screen.name} - Mobile`);
    });
  }
});

test.describe('Percy Visual Tests - Component States', () => {
  test('Empty states across screens', async ({ page }) => {
    // Navigate to screens that may show empty states
    await page.goto('/mycompany?tab=knowledge');
    await page.waitForLoadState('networkidle');
    await percySnapshot(page, 'Empty State - Knowledge');
  });

  test('Error states', async ({ page }) => {
    // Navigate to invalid route for 404
    await page.goto('/nonexistent-page');
    await page.waitForLoadState('networkidle');
    await percySnapshot(page, 'Error State - 404');
  });
});
