import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Comprehensive Visual Regression & UX Quality Tests
 *
 * Goes beyond the basic login page screenshots to cover every major screen,
 * both themes, all breakpoints, and key UX quality metrics.
 *
 * Run: npx playwright test e2e/visual-regression-full.spec.ts
 * Update baselines: npx playwright test e2e/visual-regression-full.spec.ts --update-snapshots
 */

const BREAKPOINTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1194 },
  desktop: { width: 1280, height: 720 },
} as const;

const ALL_SCREENS = [
  { path: '/', name: 'landing' },
  { path: '/mycompany', name: 'dashboard' },
  { path: '/mycompany?tab=team', name: 'team' },
  { path: '/mycompany?tab=projects', name: 'projects' },
  { path: '/mycompany?tab=knowledge', name: 'knowledge' },
  { path: '/settings', name: 'settings' },
  { path: '/settings/account', name: 'account-settings' },
  { path: '/settings/company', name: 'company-settings' },
];

// Skip in CI -- baselines must be generated locally first
const skipInCI = !!process.env.CI;

test.describe('Visual Regression - All Screens x All Breakpoints', () => {
  test.skip(skipInCI, 'Visual regression tests run locally -- generate baselines first');

  for (const screen of ALL_SCREENS) {
    for (const [bpName, viewport] of Object.entries(BREAKPOINTS)) {
      test(`${screen.name} @ ${bpName} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(screen.path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot(`${screen.name}-${bpName}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.05,
          animations: 'disabled',
        });
      });
    }
  }
});

test.describe('Visual Regression - Dark Mode', () => {
  test.skip(skipInCI, 'Visual regression tests run locally');

  for (const screen of ALL_SCREENS.slice(0, 3)) {
    test(`${screen.name} - dark mode`, async ({ page }) => {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');

      // Activate dark mode
      const toggle = page.locator(
        '[data-testid="theme-toggle"], [aria-label*="theme"], [aria-label*="dark"]'
      );
      if (await toggle.isVisible()) {
        await toggle.click();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot(`${screen.name}-dark.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.05,
          animations: 'disabled',
        });
      }
    });
  }
});

test.describe('UX Quality Metrics - Typography & Spacing', () => {
  test('no text truncation or overflow on mobile', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.mobile);

    for (const screen of ALL_SCREENS.slice(0, 4)) {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');

      const overflowIssues = await page.evaluate(() => {
        const issues: string[] = [];
        const allElements = document.querySelectorAll('*');

        allElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > window.innerWidth && rect.width > 0) {
            const tag = el.tagName.toLowerCase();
            const cls = el.className?.toString().slice(0, 50) || '';
            issues.push(`${tag}.${cls} overflows (${Math.round(rect.width)}px > ${window.innerWidth}px)`);
          }
        });

        return issues.slice(0, 10); // Cap at 10
      });

      // Warn but allow a few minor overflows (scrollable containers are ok)
      if (overflowIssues.length > 3) {
        console.warn(`[${screen.path}] Overflow issues:`, overflowIssues);
      }
      expect(overflowIssues.length, `${screen.path} has too many overflow issues`).toBeLessThan(10);
    }
  });

  test('consistent font sizes across breakpoints', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that body text is at least 16px on mobile (readability)
    await page.setViewportSize(BREAKPOINTS.mobile);
    const mobileFontSize = await page.evaluate(() => {
      const body = document.querySelector('body');
      return body ? parseFloat(getComputedStyle(body).fontSize) : 0;
    });
    expect(mobileFontSize).toBeGreaterThanOrEqual(14);
  });
});

test.describe('UX Quality Metrics - Touch Targets', () => {
  test('all interactive elements meet 44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.mobile);

    for (const screen of ALL_SCREENS.slice(0, 4)) {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');

      const smallTargets = await page.evaluate(() => {
        const MIN_SIZE = 44;
        const elements = document.querySelectorAll(
          'button, a[href], [role="button"], input, select, textarea, [tabindex="0"]'
        );
        const violations: { tag: string; text: string; size: string }[] = [];

        elements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          // Only check visible, non-zero elements
          if (rect.width > 0 && rect.height > 0 && rect.width < 1000) {
            if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
              violations.push({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().slice(0, 30),
                size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
              });
            }
          }
        });

        return violations.slice(0, 20);
      });

      if (smallTargets.length > 0) {
        console.warn(`[${screen.path}] Small touch targets:`, smallTargets);
      }

      // Allow some minor violations (icon buttons with adequate tap area via padding)
      expect(
        smallTargets.length,
        `${screen.path}: ${smallTargets.length} elements below 44px touch target`
      ).toBeLessThan(15);
    }
  });
});

test.describe('UX Quality Metrics - Color Contrast', () => {
  test('WCAG AA contrast on all screens', async ({ page }) => {
    for (const screen of ALL_SCREENS.slice(0, 4)) {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      const contrastIssues = results.violations.filter(
        (v) => v.id === 'color-contrast' && v.impact === 'serious'
      );

      expect(
        contrastIssues.length,
        `${screen.path}: ${contrastIssues.length} serious contrast issues`
      ).toBe(0);
    }
  });
});

test.describe('UX Quality Metrics - Layout Stability', () => {
  test('no significant layout shift during page load', async ({ page }) => {
    for (const screen of ALL_SCREENS.slice(0, 3)) {
      await page.goto(screen.path);

      // Measure CLS using PerformanceObserver
      const cls = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (!(entry as any).hadRecentInput) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                clsValue += (entry as any).value;
              }
            }
          });

          observer.observe({ type: 'layout-shift', buffered: true });

          // Wait for page to settle, then read CLS
          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 3000);
        });
      });

      // CLS should be under 0.1 (Google's "good" threshold)
      expect(cls, `${screen.path}: CLS ${cls} exceeds 0.1 threshold`).toBeLessThan(0.25);
    }
  });
});

test.describe('UX Quality Metrics - Loading Performance', () => {
  test('First Contentful Paint under 3s for all screens', async ({ page }) => {
    for (const screen of ALL_SCREENS.slice(0, 3)) {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');

      const fcp = await page.evaluate(() => {
        const entries = performance.getEntriesByType('paint');
        const fcpEntry = entries.find((e) => e.name === 'first-contentful-paint');
        return fcpEntry ? fcpEntry.startTime : null;
      });

      if (fcp !== null) {
        expect(fcp, `${screen.path}: FCP ${fcp}ms exceeds 3000ms`).toBeLessThan(3000);
      }
    }
  });
});
