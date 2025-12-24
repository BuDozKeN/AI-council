/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // Prevent !important (warn to allow gradual cleanup)
    'declaration-no-important': true,

    // Prevent hardcoded z-index values - use CSS variables
    // Note: Currently just documenting intention; custom plugin needed for enforcement
    // All z-index should use: var(--z-base), var(--z-elevated), var(--z-dropdown), etc.

    // Prevent hardcoded colors - use CSS variables or Tailwind
    // 'color-no-hex': true, // Too strict for now - enable after migration
    'color-named': 'never',

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

    // Ignore specific function names (CSS variables)
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme', 'var', 'calc', 'env', 'clamp', 'min', 'max'],
      },
    ],
  },
  ignoreFiles: ['**/node_modules/**', '**/dist/**'],
};
