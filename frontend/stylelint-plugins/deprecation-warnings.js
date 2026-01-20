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
 * Standard breakpoints:
 * - Very small phones: max-width/width <= 360px (intentional, for tiny screens)
 * - Small phones: max-width/width <= 400px (intentional, for small Androids)
 * - Mobile: default (no query) or max-width/width <= 640px
 * - Tablet: min-width: 641px (or width >= 641px)
 * - Desktop: min-width: 1025px (or width >= 1025px)
 *
 * We warn about:
 * - min-width with wrong values (use 641px or 1025px)
 * - Non-standard breakpoints that aren't for small phones
 */
const ALWAYS_DEPRECATED_BREAKPOINTS = [
  '768px',
  '480px',
  '600px',
  '800px',
  // Note: 360px and 400px are intentionally allowed for small phone targeting
];

/**
 * Breakpoints that are deprecated only in min-width context
 * (max-width: 640px and max-width: 1024px are fine)
 */
const MIN_WIDTH_DEPRECATED = [
  '640px', // Use 641px for min-width
  '1024px', // Use 1025px for min-width
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

      // Always warn about these breakpoints
      ALWAYS_DEPRECATED_BREAKPOINTS.forEach((breakpoint) => {
        // Use word boundary regex to avoid matching "600px" in "1600px"
        const breakpointRegex = new RegExp(`(?<![0-9])${breakpoint.replace('px', '')}px\\b`);
        if (breakpointRegex.test(params)) {
          stylelint.utils.report({
            message: messages.deprecatedBreakpoint(breakpoint),
            node: atRule,
            result,
            ruleName,
            severity: 'warning',
          });
        }
      });

      // For 640px and 1024px, only warn if used in min-width context
      MIN_WIDTH_DEPRECATED.forEach((breakpoint) => {
        if (params.includes(breakpoint)) {
          // Check if it's a min-width query (should use 641px/1025px instead)
          // Patterns: "min-width: 640px", "width >= 640px", "width > 639px"
          const isMinWidthPattern =
            params.includes(`min-width: ${breakpoint}`) ||
            params.includes(`min-width:${breakpoint}`) ||
            params.includes(`width >= ${breakpoint}`) ||
            params.includes(`width>= ${breakpoint}`) ||
            params.includes(`width >=${breakpoint}`) ||
            params.includes(`width>=${breakpoint}`) ||
            // Also catch "(640px <= width)" syntax
            params.includes(`${breakpoint} <= width`) ||
            params.includes(`${breakpoint} <=width`) ||
            params.includes(`${breakpoint}<=width`) ||
            params.includes(`${breakpoint}<= width`);

          // Only warn for min-width patterns, not max-width/width <=
          if (isMinWidthPattern) {
            const suggestedValue = breakpoint === '640px' ? '641px' : '1025px';
            stylelint.utils.report({
              message: messages.deprecatedBreakpoint(breakpoint) + ` Use ${suggestedValue} for min-width queries.`,
              node: atRule,
              result,
              ruleName,
              severity: 'warning',
            });
          }
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

          // Allow rgb(var(--color-*)) pattern - this is the correct way to apply
          // opacity to CSS variable colors since CSS can't do var(--color) / 50%
          const usesVariableColor = value.includes(`${fn}(var(--`);

          if (!isTokenFile && !usesVariableColor) {
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
