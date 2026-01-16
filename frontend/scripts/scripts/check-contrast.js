#!/usr/bin/env node
/* eslint-disable no-console, no-undef */
/**
 * Color Contrast Checker - WCAG 2.1 AA Compliance
 *
 * Verifies that all color combinations meet WCAG 2.1 AA requirements:
 * - Normal text (< 18px): 4.5:1 minimum
 * - Large text (>= 18px or bold >= 14px): 3:1 minimum
 * - UI components and graphics: 3:1 minimum
 *
 * Run: node scripts/check-contrast.js
 */

// WCAG 2.1 contrast ratio formula
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function contrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return null;

  const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

// Color pairs to check (from tailwind.css design tokens)
const colorPairs = [
  // Primary text
  {
    name: 'Primary text on white',
    fg: '#333333',
    bg: '#ffffff',
    required: 4.5,
    context: 'Body text',
  },
  {
    name: 'Secondary text on white',
    fg: '#666666',
    bg: '#ffffff',
    required: 4.5,
    context: 'Secondary text',
  },
  {
    name: 'Tertiary text on white',
    fg: '#4b5563',
    bg: '#ffffff',
    required: 4.5,
    context: 'Labels, captions',
  },

  // Dark mode text
  {
    name: 'Primary text (dark mode)',
    fg: '#f8fafc',
    bg: '#0f172a',
    required: 4.5,
    context: 'Body text (dark)',
  },
  {
    name: 'Secondary text (dark mode)',
    fg: '#64748b',
    bg: '#0f172a',
    required: 4.5,
    context: 'Secondary text (dark)',
  },
  {
    name: 'Tertiary text (dark mode)',
    fg: '#64748b',
    bg: '#0f172a',
    required: 4.5,
    context: 'Labels, captions (dark)',
  },

  // Buttons
  {
    name: 'Primary button',
    fg: '#ffffff',
    bg: '#4f46e5',
    required: 4.5,
    context: 'Default button text',
  },
  {
    name: 'Success button',
    fg: '#ffffff',
    bg: '#047857',
    required: 4.5,
    context: 'Success actions',
  },
  {
    name: 'Error button',
    fg: '#ffffff',
    bg: '#dc2626',
    required: 4.5,
    context: 'Destructive actions',
  },

  // UI components
  {
    name: 'Focus ring',
    fg: '#4f46e5',
    bg: '#ffffff',
    required: 3,
    context: 'Focus indicator',
  },
  {
    name: 'Border on white',
    fg: '#64748b',
    bg: '#ffffff',
    required: 3,
    context: 'UI borders',
  },

  // Disabled states
  {
    name: 'Disabled text',
    fg: '#4b5563',
    bg: '#f3f4f6',
    required: 4.5,
    context: 'Disabled inputs',
  },
];

// Run checks
console.log('\n🎨 WCAG 2.1 AA Color Contrast Check\n');
console.log('=' .repeat(80));

let passCount = 0;
let failCount = 0;
const failures = [];

colorPairs.forEach(({ name, fg, bg, required, context }) => {
  const ratio = contrastRatio(fg, bg);

  if (!ratio) {
    console.log(`❌ ${name}: Invalid colors (${fg}, ${bg})`);
    failCount++;
    return;
  }

  const pass = ratio >= required;
  const status = pass ? '✅' : '❌';

  console.log(
    `${status} ${name.padEnd(35)} ${ratio.toFixed(2)}:1 (need ${required}:1) - ${context}`
  );

  if (pass) {
    passCount++;
  } else {
    failCount++;
    failures.push({ name, fg, bg, ratio, required, context });
  }
});

console.log('=' .repeat(80));
console.log(`\n✅ Passed: ${passCount}/${colorPairs.length}`);
console.log(`❌ Failed: ${failCount}/${colorPairs.length}\n`);

if (failures.length > 0) {
  console.log('⚠️  FAILURES THAT NEED FIXING:\n');
  failures.forEach(({ name, fg, bg, ratio, required, context }) => {
    console.log(`  ${name}:`);
    console.log(`    Foreground: ${fg}`);
    console.log(`    Background: ${bg}`);
    console.log(`    Ratio: ${ratio.toFixed(2)}:1 (need ${required}:1)`);
    console.log(`    Context: ${context}`);
    console.log(`    Suggestion: ${ratio < required ? 'Darken foreground or lighten background' : 'N/A'}\n`);
  });

  process.exit(1);
} else {
  console.log('🎉 All color pairs pass WCAG 2.1 AA requirements!\n');
  process.exit(0);
}
