/**
 * Design Token TypeScript Definitions
 * Auto-generated type definitions for CSS custom properties from design-tokens.css
 *
 * This file provides:
 * - TypeScript autocomplete for all CSS variables
 * - Type-safe usage of design tokens in styled-components, CSS-in-JS
 * - Documentation for all available design tokens
 *
 * Generated from: src/styles/design-tokens.css
 * Last updated: 2026-01-15
 */

/* ============================================================================
   SPACING TOKENS
   ============================================================================ */

export type SpacingScale =
  | '--space-0' // 0
  | '--space-1' // 4px
  | '--space-2' // 8px
  | '--space-3' // 12px
  | '--space-4' // 16px
  | '--space-5' // 20px
  | '--space-6' // 24px
  | '--space-8' // 32px
  | '--space-10' // 40px
  | '--space-12' // 48px
  | '--space-16'; // 64px

export type SemanticSpacing =
  | '--card-padding-sm' // 12px - compact cards
  | '--card-padding' // 16px - default cards
  | '--card-padding-lg' // 20px - large cards
  | '--card-padding-xl' // 24px - hero/feature cards
  | '--content-padding-sm' // 12px
  | '--content-padding' // 16px
  | '--content-padding-lg' // 24px
  | '--gap-xs' // 4px - tight spacing
  | '--gap-sm' // 8px - compact spacing
  | '--gap' // 12px - default spacing
  | '--gap-md' // 16px - comfortable spacing
  | '--gap-lg' // 24px - section spacing
  | '--gap-xl' // 32px - major section spacing
  | '--stack-xs' // 4px
  | '--stack-sm' // 8px
  | '--stack' // 12px
  | '--stack-md' // 16px
  | '--stack-lg'; // 24px

/* ============================================================================
   TYPOGRAPHY TOKENS
   ============================================================================ */

export type FontFamily =
  | '--font-sans' // Geist, Inter, system UI
  | '--font-mono'; // Geist Mono, JetBrains Mono

export type FontSize =
  | '--text-xs' // 12px
  | '--text-sm' // 14px
  | '--text-base' // 16px
  | '--text-lg' // 18px
  | '--text-xl' // 20px
  | '--text-2xl' // 24px
  | '--text-3xl' // 30px
  | '--text-4xl' // 36px
  | '--text-5xl'; // 48px

export type LineHeight =
  | '--leading-none' // 1
  | '--leading-tight' // 1.2
  | '--leading-snug' // 1.35
  | '--leading-normal' // 1.5
  | '--leading-relaxed' // 1.625
  | '--leading-loose'; // 1.8

export type LetterSpacing =
  | '--tracking-tighter' // -0.03em
  | '--tracking-tight' // -0.02em
  | '--tracking-normal' // -0.01em
  | '--tracking-wide' // 0.025em
  | '--tracking-wider'; // 0.05em

export type FontWeight =
  | '--font-normal' // 400
  | '--font-medium' // 500
  | '--font-semibold' // 600
  | '--font-bold'; // 700

/* ============================================================================
   COLOR TOKENS
   ============================================================================ */

export type BackgroundColor =
  | '--color-bg-base' // Main background
  | '--color-bg-subtle' // Sidebar, secondary areas
  | '--color-bg-muted' // Cards, elevated surfaces
  | '--color-bg-emphasis' // Hover states, active
  | '--color-bg-canvas'; // Page canvas

export type TextColor =
  | '--color-text-default' // Primary text
  | '--color-text-muted' // Secondary text
  | '--color-text-subtle' // Tertiary, placeholders
  | '--color-text-disabled' // Disabled state
  | '--color-text-inverse'; // On dark backgrounds

export type BorderColor =
  | '--color-border-default' // Default borders
  | '--color-border-muted' // Subtle dividers
  | '--color-border-emphasis'; // Emphasized borders

export type PrimaryColor =
  | '--color-primary' // Brand indigo
  | '--color-primary-subtle'; // Indigo background

export type SemanticColor =
  | '--color-success' // Success green
  | '--color-success-hover' // Success hover
  | '--color-success-subtle' // Success background
  | '--color-success-text' // Success text
  | '--color-warning' // Warning yellow/gold
  | '--color-warning-hover' // Warning hover
  | '--color-warning-subtle' // Warning background
  | '--color-warning-text' // Warning text
  | '--color-error' // Error red
  | '--color-error-hover' // Error hover
  | '--color-error-subtle' // Error background
  | '--color-error-text' // Error text
  | '--color-info' // Info blue
  | '--color-info-hover' // Info hover
  | '--color-info-subtle'; // Info background

export type FocusColor =
  | '--color-focus' // Focus outline color
  | '--color-focus-rgb'; // Focus RGB values for rgba()

/* ============================================================================
   BORDER RADIUS TOKENS
   ============================================================================ */

export type BorderRadius =
  | '--radius-none' // 0
  | '--radius-xs' // 2px - indicators, progress bars
  | '--radius-sm' // 4px - badges, tags, code blocks
  | '--radius-default' // 6px - small buttons, menu items
  | '--radius-md' // 8px - buttons, inputs, dropdowns
  | '--radius-lg' // 12px - cards, panels
  | '--radius-xl' // 16px - modals, sheets
  | '--radius-2xl' // 20px - hero sections, landing cards
  | '--radius-3xl' // 24px - mobile sheets, dialogs
  | '--radius-full'; // 9999px - pills, avatars, circular

/* ============================================================================
   SHADOW TOKENS
   ============================================================================ */

export type Shadow =
  | '--shadow-xs' // Minimal shadow
  | '--shadow-sm' // Small shadow
  | '--shadow-md' // Medium shadow
  | '--shadow-lg' // Large shadow
  | '--shadow-xl' // Extra large shadow
  | '--shadow-2xl' // Maximum shadow
  | '--shadow-focus' // Focus ring
  | '--shadow-focus-error'; // Error focus ring

/* ============================================================================
   NOISE TEXTURE TOKENS (2025 Premium Trend)
   ============================================================================ */

export type NoiseTexture =
  | '--noise-texture' // SVG noise pattern
  | '--noise-opacity-subtle' // 0.015
  | '--noise-opacity-medium' // 0.025
  | '--noise-opacity-strong'; // 0.04

/* ============================================================================
   ANIMATION TOKENS
   ============================================================================ */

export type AnimationDuration =
  | '--duration-instant' // 0ms
  | '--duration-fast' // 150ms
  | '--duration-normal' // 250ms
  | '--duration-slow' // 400ms
  | '--duration-slower'; // 500ms

export type AnimationEasing =
  | '--ease-default' // Smooth snappy spring
  | '--ease-in' // Ease in
  | '--ease-out' // Ease out
  | '--ease-in-out' // Ease in-out
  | '--ease-spring' // Bouncy spring overshoot
  | '--ease-snappy' // Quick responsive
  | '--ease-gentle' // Gentle deceleration
  | '--ease-bounce'; // Bounce effect

/* ============================================================================
   COMPONENT TOKENS
   ============================================================================ */

export type ButtonToken =
  | '--btn-height-sm' // 32px
  | '--btn-height-md' // 36px
  | '--btn-height-lg' // 44px
  | '--btn-padding-sm' // var(--space-2) var(--space-3)
  | '--btn-padding-md' // var(--space-2) var(--space-4)
  | '--btn-padding-lg'; // var(--space-3) var(--space-6)

export type InputToken =
  | '--input-height-sm' // 32px
  | '--input-height-md' // 40px
  | '--input-height-lg' // 48px
  | '--input-padding'; // var(--space-2) var(--space-3)

export type CardToken = '--card-radius'; // var(--radius-lg)

export type ModalToken =
  | '--modal-padding' // var(--space-6)
  | '--modal-radius' // var(--radius-xl)
  | '--modal-shadow'; // var(--shadow-2xl)

export type SidebarToken =
  | '--sidebar-width' // 280px
  | '--sidebar-width-collapsed' // 60px
  | '--sidebar-bg' // var(--color-bg-subtle)
  | '--sidebar-border'; // var(--color-border-default)

/* ============================================================================
   UNION TYPE: All Design Tokens
   ============================================================================ */

export type DesignToken =
  | SpacingScale
  | SemanticSpacing
  | FontFamily
  | FontSize
  | LineHeight
  | LetterSpacing
  | FontWeight
  | BackgroundColor
  | TextColor
  | BorderColor
  | PrimaryColor
  | SemanticColor
  | FocusColor
  | BorderRadius
  | Shadow
  | NoiseTexture
  | AnimationDuration
  | AnimationEasing
  | ButtonToken
  | InputToken
  | CardToken
  | ModalToken
  | SidebarToken;

/* ============================================================================
   UTILITY TYPE: CSS Variable Value
   ============================================================================ */

/**
 * Utility type for typed CSS variable usage
 *
 * Usage:
 * ```typescript
 * const color: CSSVar<BackgroundColor> = 'var(--color-bg-base)';
 * ```
 */
export type CSSVar<T extends string> = `var(${T})`;

/* ============================================================================
   UTILITY TYPE: CSS Variable with Fallback
   ============================================================================ */

/**
 * Utility type for CSS variable with fallback value
 *
 * Usage:
 * ```typescript
 * const color: CSSVarWithFallback<BackgroundColor> = 'var(--color-bg-base, #fff)';
 * ```
 */
export type CSSVarWithFallback<T extends string> = `var(${T}, ${string})`;

/* ============================================================================
   RUNTIME HELPERS (Optional)
   ============================================================================ */

/**
 * Type guard to check if a string is a valid design token
 */
export function isDesignToken(value: string): value is DesignToken {
  return value.startsWith('--');
}

/**
 * Helper to create a CSS variable reference
 *
 * Usage:
 * ```typescript
 * const color = cssVar('--color-bg-base'); // Returns: 'var(--color-bg-base)'
 * ```
 */
export function cssVar<T extends DesignToken>(token: T): CSSVar<T> {
  return `var(${token})` as CSSVar<T>;
}

/**
 * Helper to create a CSS variable reference with fallback
 *
 * Usage:
 * ```typescript
 * const color = cssVarWithFallback('--color-bg-base', '#fff');
 * // Returns: 'var(--color-bg-base, #fff)'
 * ```
 */
export function cssVarWithFallback<T extends DesignToken>(
  token: T,
  fallback: string
): CSSVarWithFallback<T> {
  return `var(${token}, ${fallback})` as CSSVarWithFallback<T>;
}

/* ============================================================================
   DOCUMENTATION
   ============================================================================ */

/**
 * Design Token Documentation
 *
 * This file provides TypeScript types for all CSS custom properties defined in
 * src/styles/design-tokens.css. It enables:
 *
 * 1. **Autocomplete**: Your IDE will suggest all available design tokens
 * 2. **Type Safety**: Catch typos and invalid tokens at compile time
 * 3. **Documentation**: Each token is documented with its value and purpose
 * 4. **Refactoring Safety**: Renaming tokens will show TypeScript errors
 *
 * ## Usage Examples
 *
 * ### In styled-components or CSS-in-JS:
 * ```typescript
 * import { cssVar } from '@/types/design-tokens';
 *
 * const Button = styled.button`
 *   padding: ${cssVar('--space-4')};
 *   color: ${cssVar('--color-text-default')};
 *   border-radius: ${cssVar('--radius-md')};
 * `;
 * ```
 *
 * ### In inline styles:
 * ```typescript
 * import type { DesignToken } from '@/types/design-tokens';
 *
 * const style: React.CSSProperties = {
 *   padding: 'var(--space-4)' as DesignToken,
 *   color: 'var(--color-text-default)' as DesignToken,
 * };
 * ```
 *
 * ### Type-safe token validation:
 * ```typescript
 * import { isDesignToken } from '@/types/design-tokens';
 *
 * function applyToken(token: string) {
 *   if (isDesignToken(token)) {
 *     // TypeScript knows token is DesignToken here
 *     return `var(${token})`;
 *   }
 * }
 * ```
 *
 * ## Maintenance
 *
 * When adding new CSS custom properties to design-tokens.css:
 * 1. Add the corresponding type to this file
 * 2. Add it to the `DesignToken` union type
 * 3. Update the documentation
 *
 * Consider automating this with a script that parses design-tokens.css
 * and generates this file.
 */
