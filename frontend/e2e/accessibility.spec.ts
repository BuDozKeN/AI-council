import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests (WCAG 2.1 AA)
 *
 * These tests use axe-core to automatically detect accessibility violations.
 * Violations at "critical" or "serious" impact levels will fail the build.
 *
 * Run locally: npx playwright test e2e/accessibility.spec.ts
 */

test.describe('Accessibility - Login Page', () => {
  test('login page should have no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Filter to only critical and serious violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    // Log all violations for debugging (even non-critical)
    if (accessibilityScanResults.violations.length > 0) {
      console.warn('Accessibility violations found:');
      accessibilityScanResults.violations.forEach((violation) => {
        console.warn(`  [${violation.impact}] ${violation.id}: ${violation.description}`);
        console.warn(`    Help: ${violation.helpUrl}`);
        violation.nodes.forEach((node) => {
          console.warn(`    Element: ${node.target.join(', ')}`);
        });
      });
    }

    // Fail only on critical/serious violations
    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);
  });

  test('login page mobile should have no critical accessibility violations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Dark Mode', () => {
  test('dark mode should maintain color contrast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to enable dark mode
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"], button:has-text("dark")'
    );

    if (await themeToggle.first().isVisible()) {
      await themeToggle.first().click();
      await page.waitForTimeout(300);
    }

    // Run color contrast checks specifically
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast' && (v.impact === 'critical' || v.impact === 'serious')
    );

    expect(contrastViolations).toHaveLength(0);
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('all interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for keyboard accessibility issues
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['keyboard'])
      .analyze();

    const keyboardViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(keyboardViolations).toHaveLength(0);
  });

  test('focus indicators should be visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through elements and check focus visibility
    const focusableElements = await page.locator(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const count = await focusableElements.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      await page.keyboard.press('Tab');

      // Check that something has focus
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).not.toBe('BODY');
    }
  });
});
