/**
 * Stylelint Custom Plugin: CSS Deprecation Warnings
 *
 * Warns about deprecated patterns and anti-patterns in the CSS codebase.
 * This helps maintain consistency and prevent re-introduction of bad patterns.
 *
 * Enterprise-grade feature: Codifies architectural decisions as linting rules.
 */

import stylelint from 'stylelint';

const ruleName = 'axcouncil/no-deprecated-patterns';
const messages = stylelint.utils.ruleMessages(ruleName, {
  deprecatedBreakpoint: (value) =>
    `Deprecated breakpoint "${value}". Use only 641px (tablet) or 1025px (desktop).`,
  deprecatedZIndex: (value) =>
    `Hardcoded z-index "${value}". Use CSS variables: var(--z-base), var(--z-elevated), etc.`,
  deprecatedImportant: () =>
    `Avoid !important. Increase specificity or use @layer instead.`,
  deprecatedColorFunction: (fn) =>
    `Deprecated color function "${fn}()". Use CSS variables: var(--color-*).`,
  deprecatedPixelValue: (prop, value) =>
    `Hardcoded pixel value "${value}" for "${prop}". Use spacing tokens: var(--space-*).`,
  deprecatedSelector: (selector) =>
    `Deprecated selector pattern "${selector}". This pattern was removed in refactoring.`,
});

/**
 * Deprecated breakpoints that should not be reintroduced
 * Only allow: 641px (tablet), 1025px (desktop)
 */
const DEPRECATED_BREAKPOINTS = [
  '768px',
  '480px',
  '400px',
  '360px',
  '600px',
  '800px',
  '1024px', // Use 1025px instead
  '640px', // Use 641px instead
];

/**
 * Properties that should use spacing tokens, not hardcoded pixels
 */
const SPACING_PROPERTIES = [
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'padding-inline',
  'padding-block',
  'padding-inline-start',
  'padding-inline-end',
  'padding-block-start',
  'padding-block-end',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'margin-inline',
  'margin-block',
  'gap',
  'row-gap',
  'column-gap',
];

/**
 * Deprecated color functions (use CSS variables instead)
 */
const DEPRECATED_COLOR_FUNCTIONS = ['rgb', 'rgba', 'hsl', 'hsla'];

/**
 * Deprecated selector patterns (from old code that was refactored)
 * Add any selectors here that should trigger warnings if reintroduced
 */
const DEPRECATED_SELECTORS = [
  // Example: selectors from mega-files that were split
  // '.chat-interface-mega-file', // Example
];

const ruleFunction = (primary, _secondaryOptions, _context) => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true, false],
    });

    if (!validOptions || !primary) {
      return;
    }

    // Check media queries for deprecated breakpoints
    root.walkAtRules('media', (atRule) => {
      const params = atRule.params;

      DEPRECATED_BREAKPOINTS.forEach((breakpoint) => {
        if (params.includes(breakpoint)) {
          stylelint.utils.report({
            message: messages.deprecatedBreakpoint(breakpoint),
            node: atRule,
            result,
            ruleName,
            severity: 'warning',
          });
        }
      });
    });

    // Check declarations
    root.walkDecls((decl) => {
      const prop = decl.prop;
      const value = decl.value;

      // Warn about hardcoded z-index (unless it's a CSS variable)
      if (prop === 'z-index' && !value.includes('var(--z-')) {
        const isNumeric = !isNaN(value);
        if (isNumeric && parseInt(value) !== 0) {
          stylelint.utils.report({
            message: messages.deprecatedZIndex(value),
            node: decl,
            result,
            ruleName,
            severity: 'warning',
          });
        }
      }

      // Warn about !important (unless in whitelisted files or patterns)
      if (value.includes('!important')) {
        // Allow !important in specific cases (accessibility, @media prefers-reduced-motion)
        const isAccessibilityException =
          root.source.input.file &&
          (root.source.input.file.includes('index.css') ||
            root.source.input.file.includes('design-tokens.css'));

        const isReducedMotionException =
          decl.parent.selector &&
          decl.parent.selector.includes('prefers-reduced-motion');

        if (!isAccessibilityException && !isReducedMotionException) {
          stylelint.utils.report({
            message: messages.deprecatedImportant(),
            node: decl,
            result,
            ruleName,
            severity: 'warning',
          });
        }
      }

      // Warn about deprecated color functions (rgb, rgba, etc.)
      DEPRECATED_COLOR_FUNCTIONS.forEach((fn) => {
        if (value.includes(`${fn}(`)) {
          // Exempt token definition files
          const isTokenFile =
            root.source.input.file &&
            (root.source.input.file.includes('design-tokens.css') ||
              root.source.input.file.includes('tailwind.css'));

          if (!isTokenFile) {
            stylelint.utils.report({
              message: messages.deprecatedColorFunction(fn),
              node: decl,
              result,
              ruleName,
              severity: 'warning',
            });
          }
        }
      });

      // Warn about hardcoded pixel values in spacing properties
      if (SPACING_PROPERTIES.includes(prop)) {
        // Match pixel values like "16px", "32px" but not "0" or CSS variables
        const pixelValueRegex = /\b(\d+(?:\.\d+)?)px\b/g;
        const matches = value.match(pixelValueRegex);

        if (matches) {
          matches.forEach((match) => {
            const numValue = parseFloat(match);
            // Allow 0px, and exempt token definition files
            if (numValue === 0) return;

            const isTokenFile =
              root.source.input.file &&
              (root.source.input.file.includes('design-tokens.css') ||
                root.source.input.file.includes('tailwind.css') ||
                root.source.input.file.includes('index.css'));

            // Only warn if it's not using a CSS variable
            if (!value.includes('var(--') && !isTokenFile) {
              stylelint.utils.report({
                message: messages.deprecatedPixelValue(prop, match),
                node: decl,
                result,
                ruleName,
                severity: 'warning',
              });
            }
          });
        }
      }
    });

    // Check selectors for deprecated patterns
    root.walkRules((rule) => {
      const selector = rule.selector;

      DEPRECATED_SELECTORS.forEach((deprecatedSelector) => {
        if (selector.includes(deprecatedSelector)) {
          stylelint.utils.report({
            message: messages.deprecatedSelector(deprecatedSelector),
            node: rule,
            result,
            ruleName,
            severity: 'error', // Error because these should never come back
          });
        }
      });
    });
  };
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

export default stylelint.createPlugin(ruleName, ruleFunction);
