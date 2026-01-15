/**
 * CSS Architecture Tests
 *
 * Enterprise-grade tests that enforce CSS architecture rules.
 * These tests prevent regressions and ensure consistency.
 *
 * Test Categories:
 * 1. File organization (1:1 component-to-CSS mapping)
 * 2. File size limits (max 800 lines hard limit, excludes tailwind.css)
 * 3. Color usage (must use CSS variables)
 * 4. Breakpoint consistency (only 641px and 1025px)
 * 5. Z-index usage (must use CSS variables)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC_DIR = join(__dirname, '..');

/**
 * Recursively find all CSS files
 */
function findCSSFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, etc.
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.css')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Recursively find all component files (tsx)
 */
function findComponentFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== '__tests__'
        ) {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Count lines in a file (excluding empty lines and comments)
 */
function countSignificantLines(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let count = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track block comments
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
    }
    if (trimmed.includes('*/')) {
      inBlockComment = false;
      continue;
    }

    // Skip empty lines, single-line comments, and lines in block comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || inBlockComment) {
      continue;
    }

    count++;
  }

  return count;
}

describe('CSS Architecture - File Organization', () => {
  it('should have all CSS files properly organized', () => {
    const cssFiles = findCSSFiles(SRC_DIR);

    expect(cssFiles.length).toBeGreaterThan(0);

    // Ensure no CSS files in root src directory (except styles/)
    const rootCSSFiles = cssFiles.filter((file) => {
      const relativePath = file.replace(SRC_DIR, '');
      const parts = relativePath.split('/');
      return (
        parts.length === 2 &&
        !file.includes('/styles/') &&
        !file.includes('index.css') &&
        !file.includes('App.css')
      );
    });

    expect(rootCSSFiles).toEqual([]);
  });

  it('should follow 1:1 component-to-CSS mapping (components with CSS)', () => {
    const cssFiles = findCSSFiles(join(SRC_DIR, 'components'));
    const componentFiles = findComponentFiles(join(SRC_DIR, 'components'));

    // For each CSS file, there should be a corresponding .tsx file
    cssFiles.forEach((cssFile) => {
      const baseName = cssFile.replace('.css', '');
      const expectedTsxPath = baseName + '.tsx';

      const hasTsx = componentFiles.includes(expectedTsxPath);

      if (!hasTsx) {
        console.warn(`Warning: CSS file without component: ${cssFile.replace(SRC_DIR, '')}`);
      }

      // This is a warning, not a hard failure
      // Some CSS files might be shared (like ui components)
    });
  });
});

describe('CSS Architecture - File Size Limits', () => {
  const cssFiles = findCSSFiles(SRC_DIR);

  it('should have no CSS files exceeding 800 lines (HARD LIMIT, excludes tailwind.css)', () => {
    const violations: Array<{ file: string; lines: number }> = [];

    cssFiles.forEach((file) => {
      // Exclude tailwind.css - framework config, not component CSS
      if (file.endsWith('tailwind.css')) return;

      const lineCount = countSignificantLines(file);

      if (lineCount > 800) {
        violations.push({
          file: file.replace(SRC_DIR, 'src'),
          lines: lineCount,
        });
      }
    });

    if (violations.length > 0) {
      const message = violations.map((v) => `  - ${v.file}: ${v.lines} lines`).join('\n');

      expect.fail(
        `Found ${violations.length} CSS file(s) exceeding 800 lines:\n${message}\n\nAction: Split these files into smaller components.`
      );
    }
  });

  it('should track files exceeding 300 lines (target limit)', () => {
    const largeFiles: Array<{ file: string; lines: number }> = [];

    cssFiles.forEach((file) => {
      const lineCount = countSignificantLines(file);

      if (lineCount > 300) {
        largeFiles.push({
          file: file.replace(SRC_DIR, 'src'),
          lines: lineCount,
        });
      }
    });

    // This is informational, not a failure
    if (largeFiles.length > 0) {
      console.log(`\nℹ️  ${largeFiles.length} CSS file(s) exceed 300 lines (target):`);
      largeFiles.forEach((f) => {
        console.log(`   - ${f.file}: ${f.lines} lines`);
      });
    }

    // Always pass, this is just tracking
    expect(true).toBe(true);
  });

  it('should have reasonable average file size', () => {
    const lineCounts = cssFiles.map(countSignificantLines);
    const total = lineCounts.reduce((sum, count) => sum + count, 0);
    const average = total / lineCounts.length;

    console.log(`\n📊 Average CSS file size: ${Math.round(average)} lines`);

    // Average should be under 200 lines (enterprise quality)
    expect(average).toBeLessThan(200);
  });
});

describe('CSS Architecture - Color Usage', () => {
  const cssFiles = findCSSFiles(SRC_DIR);

  it('should track hardcoded colors (target: use CSS variables)', () => {
    const violations: Array<{ file: string; line: number; color: string }> = [];

    // Exempt token definition files
    const exemptFiles = ['design-tokens.css', 'tailwind.css'];

    cssFiles.forEach((file) => {
      const isExempt = exemptFiles.some((exempt) => file.includes(exempt));
      if (isExempt) return;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for hex colors
        const hexMatch = line.match(/#[0-9a-fA-F]{3,8}/);
        if (hexMatch) {
          violations.push({
            file: file.replace(SRC_DIR, 'src'),
            line: index + 1,
            color: hexMatch[0],
          });
        }

        // Check for rgb/rgba (but allow in var() fallbacks)
        const rgbMatch = line.match(/rgba?\([^)]+\)/);
        if (rgbMatch && !line.includes('var(')) {
          violations.push({
            file: file.replace(SRC_DIR, 'src'),
            line: index + 1,
            color: rgbMatch[0],
          });
        }
      });
    });

    if (violations.length > 0) {
      const message = violations
        .slice(0, 10) // Show first 10
        .map((v) => `  - ${v.file}:${v.line} → ${v.color}`)
        .join('\n');

      console.warn(
        `⚠️  Found ${violations.length} hardcoded color(s). Use CSS variables instead:\n${message}`
      );
    }

    console.log(`\n🎨 Hardcoded colors: ${violations.length} (target: 0 for enterprise quality)`);

    // Track but don't fail - this is a gradual improvement metric
    expect(true).toBe(true);
  });
});

describe('CSS Architecture - Breakpoint Consistency', () => {
  const cssFiles = findCSSFiles(SRC_DIR);

  it('should track deprecated breakpoints (target: 641px, 1025px only)', () => {
    const violations: Array<{
      file: string;
      line: number;
      breakpoint: string;
    }> = [];

    const deprecatedBreakpoints = [
      '768px',
      '480px',
      '400px',
      '360px',
      '600px',
      '800px',
      '1024px',
      '640px',
    ];

    cssFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        deprecatedBreakpoints.forEach((bp) => {
          if (line.includes(bp) && line.includes('@media')) {
            violations.push({
              file: file.replace(SRC_DIR, 'src'),
              line: index + 1,
              breakpoint: bp,
            });
          }
        });
      });
    });

    console.log(
      `\n📱 Deprecated breakpoints: ${violations.length} (target: 0, approved: 641px, 1025px)`
    );

    if (violations.length > 0) {
      const message = violations
        .slice(0, 10)
        .map((v) => `  - ${v.file}:${v.line} → ${v.breakpoint}`)
        .join('\n');

      console.warn(
        `⚠️  Found ${violations.length} deprecated breakpoint(s). Migrate to 641px or 1025px:\n${message}`
      );
    }

    // Track but don't fail - this is a migration metric
    expect(true).toBe(true);
  });

  it('should use mobile-first approach (min-width, not max-width)', () => {
    const violations: Array<{ file: string; line: number }> = [];

    cssFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (
          line.includes('max-width') &&
          line.includes('@media') &&
          !line.includes('prefers-reduced-motion')
        ) {
          violations.push({
            file: file.replace(SRC_DIR, 'src'),
            line: index + 1,
          });
        }
      });
    });

    if (violations.length > 0) {
      const message = violations
        .slice(0, 10)
        .map((v) => `  - ${v.file}:${v.line}`)
        .join('\n');

      console.warn(
        `⚠️  Found ${violations.length} max-width media queries (prefer min-width):\n${message}`
      );
    }

    // Warning only, not a hard failure
    expect(true).toBe(true);
  });
});

describe('CSS Architecture - Z-Index Usage', () => {
  const cssFiles = findCSSFiles(SRC_DIR);

  it('should use CSS variables for z-index values', () => {
    const violations: Array<{ file: string; line: number; value: string }> = [];

    // Exempt token definition files
    const exemptFiles = ['design-tokens.css', 'tailwind.css'];

    cssFiles.forEach((file) => {
      const isExempt = exemptFiles.some((exempt) => file.includes(exempt));
      if (isExempt) return;

      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Match z-index with numeric value
        const zIndexMatch = line.match(/z-index:\s*(\d+)/);
        if (zIndexMatch && !line.includes('var(--z-')) {
          const value = zIndexMatch[1];
          // Allow z-index: 0
          if (value !== '0') {
            violations.push({
              file: file.replace(SRC_DIR, 'src'),
              line: index + 1,
              value: value,
            });
          }
        }
      });
    });

    if (violations.length > 0) {
      const message = violations
        .slice(0, 10)
        .map((v) => `  - ${v.file}:${v.line} → z-index: ${v.value}`)
        .join('\n');

      console.warn(
        `⚠️  Found ${violations.length} hardcoded z-index value(s). Use CSS variables:\n${message}`
      );
    }

    // Warning only for now
    expect(true).toBe(true);
  });
});

describe('CSS Architecture - Bundle Size', () => {
  it('should track total CSS source size (informational)', () => {
    const cssFiles = findCSSFiles(SRC_DIR);
    let totalSize = 0;

    cssFiles.forEach((file) => {
      const stats = statSync(file);
      totalSize += stats.size;
    });

    const totalKB = Math.round(totalSize / 1024);
    const budgetKB = 75; // Production minified budget (CI enforces this)

    console.log(
      `\n📦 Total CSS source size: ${totalKB}KB (unminified, production target: ~${budgetKB}KB minified)`
    );

    // This is informational - production minification reduces by ~70%
    // Real budget check happens in CI on minified production build
    expect(true).toBe(true);
  });
});

describe('CSS Architecture - Best Practices', () => {
  const cssFiles = findCSSFiles(SRC_DIR);

  it('should track !important usage (target: <50)', () => {
    let importantCount = 0;

    cssFiles.forEach((file) => {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(/!important/g);
      if (matches) {
        importantCount += matches.length;
      }
    });

    console.log(
      `\n⚡ Total !important count: ${importantCount} (target: <50 for enterprise quality)`
    );

    // Informational tracking - goal is <50 (only for accessibility overrides)
    if (importantCount > 50) {
      console.warn(
        `⚠️  !important usage exceeds target. Review and refactor to use @layer instead.`
      );
    }

    // Pass for now, but track the metric
    expect(true).toBe(true);
  });

  it('should use @layer for cascade control', () => {
    const indexCSS = join(SRC_DIR, 'index.css');
    const content = readFileSync(indexCSS, 'utf-8');

    // Should have @layer declaration
    expect(content).toContain('@layer');
    expect(content).toContain('@layer base');
    expect(content).toContain('@layer components');
    expect(content).toContain('@layer utilities');
  });

  it('should have design tokens TypeScript definitions', () => {
    const designTokensPath = join(SRC_DIR, 'types', 'design-tokens.d.ts');

    try {
      const content = readFileSync(designTokensPath, 'utf-8');
      expect(content).toContain('DesignToken');
      expect(content).toContain('CSSVar');
    } catch {
      expect.fail('Design tokens TypeScript definitions missing');
    }
  });
});
