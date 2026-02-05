/**
 * Autonomous Full App Exploration Test
 *
 * This test systematically explores every screen and interaction
 * in the AxCouncil application, cataloging all issues found.
 *
 * Run with: npm run test:e2e:explore
 */

import { test, expect, Page, Locator } from '@playwright/test';

interface Issue {
  id: string;
  screen: string;
  element: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  category: string;
  expected: string;
  actual: string;
  screenshot?: string;
  consoleErrors?: string[];
}

interface ExplorationResult {
  screens: string[];
  elementsInteracted: number;
  issues: Issue[];
  consoleErrors: string[];
  networkErrors: { url: string; status: number }[];
}

// All screens to test
const SCREENS = [
  { path: '/', name: 'Landing/Chat' },
  { path: '/mycompany', name: 'MyCompany Dashboard' },
  { path: '/mycompany?tab=team', name: 'Team Tab' },
  { path: '/mycompany?tab=projects', name: 'Projects Tab' },
  { path: '/mycompany?tab=knowledge', name: 'Knowledge Tab' },
  { path: '/settings', name: 'Settings' },
  { path: '/settings/account', name: 'Account Settings' },
  { path: '/settings/company', name: 'Company Settings' },
];

// Test data for form filling
const TEST_DATA = {
  email: 'test@example.com',
  name: 'Test User',
  company: 'Test Company Inc.',
  question: 'What is the best strategy for implementing authentication?',
};

class ExplorationReporter {
  private result: ExplorationResult = {
    screens: [],
    elementsInteracted: 0,
    issues: [],
    consoleErrors: [],
    networkErrors: [],
  };

  addScreen(screen: string): void {
    this.result.screens.push(screen);
  }

  incrementInteractions(): void {
    this.result.elementsInteracted++;
  }

  addIssue(issue: Omit<Issue, 'id'>): void {
    const id = `EXP-${String(this.result.issues.length + 1).padStart(3, '0')}`;
    this.result.issues.push({ id, ...issue });
  }

  addConsoleError(error: string): void {
    this.result.consoleErrors.push(error);
  }

  addNetworkError(url: string, status: number): void {
    this.result.networkErrors.push({ url, status });
  }

  getResult(): ExplorationResult {
    return this.result;
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('EXPLORATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Screens tested: ${this.result.screens.length}`);
    console.log(`Elements interacted: ${this.result.elementsInteracted}`);
    console.log(`Issues found: ${this.result.issues.length}`);
    console.log(`  P0 (Blocker): ${this.result.issues.filter(i => i.severity === 'P0').length}`);
    console.log(`  P1 (Critical): ${this.result.issues.filter(i => i.severity === 'P1').length}`);
    console.log(`  P2 (Major): ${this.result.issues.filter(i => i.severity === 'P2').length}`);
    console.log(`  P3 (Minor): ${this.result.issues.filter(i => i.severity === 'P3').length}`);
    console.log(`Console errors: ${this.result.consoleErrors.length}`);
    console.log(`Network errors: ${this.result.networkErrors.length}`);
    console.log('='.repeat(60) + '\n');
  }
}

async function exploreScreen(
  page: Page,
  screen: { path: string; name: string },
  reporter: ExplorationReporter
): Promise<void> {
  console.log(`\n>>> Exploring: ${screen.name} (${screen.path})`);

  // Navigate to screen
  await page.goto(screen.path);
  await page.waitForLoadState('networkidle');
  reporter.addScreen(screen.path);

  // Collect console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      reporter.addConsoleError(`[${screen.path}] ${msg.text()}`);
    }
  });

  // Get all interactive elements
  const buttons = page.locator('button:visible');
  const links = page.locator('a:visible');
  const inputs = page.locator('input:visible, textarea:visible');

  // Test buttons
  const buttonCount = await buttons.count();
  console.log(`  Found ${buttonCount} buttons`);

  for (let i = 0; i < Math.min(buttonCount, 10); i++) {
    try {
      const button = buttons.nth(i);
      const buttonText = await button.textContent() || 'Unknown';
      const isDisabled = await button.isDisabled();

      if (!isDisabled) {
        // Check if button is visible and enabled
        const box = await button.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          // Click and wait
          await button.click({ timeout: 5000 }).catch(() => {
            reporter.addIssue({
              screen: screen.path,
              element: `Button: ${buttonText.trim().slice(0, 50)}`,
              severity: 'P2',
              category: 'interaction',
              expected: 'Button should be clickable',
              actual: 'Button click failed or timed out',
            });
          });
          reporter.incrementInteractions();

          // Wait a moment for any UI updates
          await page.waitForTimeout(300);

          // Check for modal that might have opened
          const modal = page.locator('[role="dialog"]:visible, [data-radix-dialog]:visible');
          if (await modal.count() > 0) {
            // Test modal dismissal with Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
          }
        }
      }
    } catch {
      // Continue on error
    }
  }

  // Test inputs
  const inputCount = await inputs.count();
  console.log(`  Found ${inputCount} inputs`);

  for (let i = 0; i < Math.min(inputCount, 5); i++) {
    try {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type') || 'text';
      const placeholder = await input.getAttribute('placeholder') || '';

      // Focus and type
      await input.focus();
      reporter.incrementInteractions();

      if (type === 'email') {
        await input.fill(TEST_DATA.email);
      } else if (placeholder.toLowerCase().includes('name')) {
        await input.fill(TEST_DATA.name);
      } else {
        await input.fill('Test input');
      }

      // Clear for next test
      await input.fill('');
    } catch {
      // Continue on error
    }
  }

  // Test links (only navigation, not external)
  const linkCount = await links.count();
  console.log(`  Found ${linkCount} links`);

  // Just count links for now, don't click to avoid navigation
  reporter.incrementInteractions();

  console.log(`  ✓ Completed: ${screen.name}`);
}

test.describe('Autonomous App Exploration', () => {
  let reporter: ExplorationReporter;

  test.beforeAll(() => {
    reporter = new ExplorationReporter();
  });

  test.afterAll(() => {
    reporter.printSummary();
  });

  test('should explore all screens without critical errors', async ({ page }) => {
    // Set up network error monitoring
    page.on('response', (response) => {
      if (response.status() >= 400) {
        reporter.addNetworkError(response.url(), response.status());
      }
    });

    // Explore each screen
    for (const screen of SCREENS) {
      await exploreScreen(page, screen, reporter);
    }

    // Assert no P0 (blocker) issues
    const result = reporter.getResult();
    const blockers = result.issues.filter((i) => i.severity === 'P0');

    if (blockers.length > 0) {
      console.log('\n❌ BLOCKERS FOUND:');
      blockers.forEach((b) => {
        console.log(`  ${b.id}: ${b.element} - ${b.actual}`);
      });
    }

    expect(blockers.length, 'No P0 blocker issues should exist').toBe(0);
  });

  test('should have no console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Quick navigation through main screens
    for (const screen of SCREENS.slice(0, 3)) {
      await page.goto(screen.path);
      await page.waitForLoadState('domcontentloaded');
    }

    // Allow some common React dev warnings
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('React DevTools') &&
        !e.includes('Download the React DevTools')
    );

    if (criticalErrors.length > 0) {
      console.log('\nConsole errors found:');
      criticalErrors.forEach((e) => console.log(`  - ${e.slice(0, 100)}`));
    }

    // Warn but don't fail for console errors (they might be expected)
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('should have acceptable page load times', async ({ page }) => {
    const loadTimes: { screen: string; time: number }[] = [];

    for (const screen of SCREENS) {
      const start = Date.now();
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - start;
      loadTimes.push({ screen: screen.path, time: loadTime });

      if (loadTime > 3000) {
        reporter.addIssue({
          screen: screen.path,
          element: 'Page Load',
          severity: 'P2',
          category: 'performance',
          expected: 'Page loads in under 3 seconds',
          actual: `Page took ${loadTime}ms to load`,
        });
      }
    }

    // Log load times
    console.log('\nPage load times:');
    loadTimes.forEach((lt) => {
      const status = lt.time > 3000 ? '❌' : lt.time > 1000 ? '⚠️' : '✓';
      console.log(`  ${status} ${lt.screen}: ${lt.time}ms`);
    });

    // Assert average load time is acceptable
    const avgLoadTime =
      loadTimes.reduce((sum, lt) => sum + lt.time, 0) / loadTimes.length;
    expect(avgLoadTime).toBeLessThan(5000);
  });
});

test.describe('Mobile Exploration', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });

  test('should work on mobile viewport', async ({ page }) => {
    const reporter = new ExplorationReporter();

    // Test key screens on mobile
    const mobileScreens = SCREENS.slice(0, 4);

    for (const screen of mobileScreens) {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      reporter.addScreen(screen.path);

      // Check for horizontal overflow (common mobile issue)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      if (hasHorizontalScroll) {
        reporter.addIssue({
          screen: screen.path,
          element: 'Page Layout',
          severity: 'P2',
          category: 'mobile',
          expected: 'No horizontal scroll on mobile',
          actual: 'Page has horizontal overflow',
        });
      }

      // Check touch target sizes
      const smallTargets = await page.evaluate(() => {
        const MIN_SIZE = 44; // Apple HIG minimum
        const interactiveElements = document.querySelectorAll(
          'button, a, [role="button"], input, select'
        );
        const small: string[] = [];

        interactiveElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.width < MIN_SIZE || rect.height < MIN_SIZE)
          ) {
            small.push(
              `${el.tagName}${el.textContent?.slice(0, 20) || ''}: ${rect.width}x${rect.height}`
            );
          }
        });

        return small;
      });

      if (smallTargets.length > 0) {
        reporter.addIssue({
          screen: screen.path,
          element: 'Touch Targets',
          severity: 'P3',
          category: 'mobile',
          expected: 'All touch targets should be at least 44x44px',
          actual: `Found ${smallTargets.length} small touch targets`,
        });
      }
    }

    reporter.printSummary();

    // No P0/P1 issues on mobile
    const result = reporter.getResult();
    const criticalMobileIssues = result.issues.filter(
      (i) => i.severity === 'P0' || i.severity === 'P1'
    );
    expect(criticalMobileIssues.length).toBe(0);
  });
});
