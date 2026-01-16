/** @type {import('stylelint').Config} */
import deprecationWarnings from './stylelint-plugins/deprecation-warnings.js';

export default {
  plugins: [deprecationWarnings],
  extends: ['stylelint-config-standard'],
  rules: {
    // Custom deprecation warnings plugin
    'axcouncil/no-deprecated-patterns': true,

    // Prevent !important in custom code (library files exempted via overrides)
    'declaration-no-important': true,

    // Prevent hardcoded z-index values - use CSS variables
    // Note: Currently just documenting intention; custom plugin needed for enforcement
    // All z-index should use: var(--z-base), var(--z-elevated), var(--z-dropdown), etc.

    // Prevent hardcoded colors - use CSS variables or Tailwind
    // Note: Token definition files are exempt via overrides below
    // Changed from 'warning' to TRUE (error) now that all violations are fixed
    'color-no-hex': [true, {
      message: 'Avoid hex colors. Use CSS custom properties (var(--color-*)) from design tokens instead.',
    }],
    'color-named': ['never', {
      message: 'Avoid named colors. Use CSS custom properties (var(--color-*)) from design tokens instead.',
    }],

    // Consistent units
    'length-zero-no-unit': true,

    // Allow CSS nesting (modern CSS)
    'selector-nested-pattern': null,

    // Don't enforce specific selector patterns
    'selector-class-pattern': null,

    // Allow custom properties without specific pattern
    'custom-property-pattern': null,

    // Allow Tailwind's @apply and other at-rules
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'layer',
          'config',
          'screen',
          'import',
          'keyframes',
        ],
      },
    ],

    // Don't require vendor prefixes (handled by PostCSS/Autoprefixer)
    'property-no-vendor-prefix': true,
    'value-no-vendor-prefix': true,

    // Allow duplicate selectors in media queries
    'no-duplicate-selectors': null,

    // TODO: Fix and enable after structural refactor (audit: 2026-01-15)
    'no-descending-specificity': null, // 50+ violations - fix during file splitting
    'media-feature-range-notation': null, // Modern range syntax - fix in batch
    'keyframes-name-pattern': null, // Allow any keyframe naming
    'property-no-deprecated': null, // Temporarily allow deprecated properties

    // Ignore specific function names (CSS variables)
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme', 'var', 'calc', 'env', 'clamp', 'min', 'max'],
      },
    ],
  },
  ignoreFiles: ['**/node_modules/**', '**/dist/**'],
  overrides: [
    {
      // Token definition files - exempt from color rules (they DEFINE the colors)
      files: ['**/design-tokens.css', '**/tailwind.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
      },
    },
    {
      // Third-party library files - exempt from !important rule
      files: ['**/sonner.css'],
      rules: {
        'declaration-no-important': null,
      },
    },
  ],
};
