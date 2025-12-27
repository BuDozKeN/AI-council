/**
 * Centralized color definitions for AI Council
 *
 * This file provides RUNTIME color utilities for dynamic styling.
 * For static/CSS-based theming, prefer using CSS variables from design-tokens.css
 *
 * These hex values are intentionally hardcoded because:
 * 1. They're used for runtime hash-based color assignment (e.g., department colors)
 * 2. CSS variables can't be used in JavaScript color calculations
 * 3. The getComputedStyle() approach is too slow for frequent lookups
 *
 * When adding new colors, ensure they have a corresponding CSS variable
 * in tailwind.css for consistency in static contexts.
 */

interface DeptColor {
  bg: string;
  text: string;
  border: string;
  hoverBg: string;
}

interface PlaybookTypeColor extends DeptColor {
  shadowColor: string;
}

type PlaybookType = 'sop' | 'framework' | 'policy';

// ============================================
// DEPARTMENT COLORS
// ============================================
// Subtle, professional colors that don't compete with type badges
// Each department gets a consistent color based on its ID hash
// These values align with Tailwind's color palette

export const DEPT_COLORS: DeptColor[] = [
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', hoverBg: '#fde68a' },  // Amber (amber-100, amber-800, amber-300, amber-200)
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', hoverBg: '#bfdbfe' },  // Blue (blue-100, blue-800, blue-300, blue-200)
  { bg: '#dcfce7', text: '#166534', border: '#86efac', hoverBg: '#bbf7d0' },  // Green (green-100, green-800, green-300, green-200)
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4', hoverBg: '#fbcfe8' },  // Pink (pink-100, pink-800, pink-300, pink-200)
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc', hoverBg: '#c7d2fe' },  // Indigo (indigo-100, indigo-800, indigo-300, indigo-200)
  { bg: '#fef9c3', text: '#854d0e', border: '#fde047', hoverBg: '#fef08a' },  // Yellow (yellow-100, yellow-800, yellow-300, yellow-200)
  { bg: '#ccfbf1', text: '#115e59', border: '#5eead4', hoverBg: '#99f6e4' },  // Teal (teal-100, teal-800, teal-300, teal-200)
  { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af', hoverBg: '#fecdd3' },  // Rose (rose-100, rose-800, rose-300, rose-200)
];

/**
 * Get consistent color for a department based on its ID
 */
export function getDeptColor(deptId: string | null | undefined): DeptColor {
  if (!deptId) return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb', hoverBg: '#e5e7eb' };

  // Simple hash based on first chars of UUID
  const hash = deptId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DEPT_COLORS[hash % DEPT_COLORS.length] ?? { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb', hoverBg: '#e5e7eb' };
}

// ============================================
// PLAYBOOK TYPE COLORS (SOP, Framework, Policy)
// ============================================
// These align with the tokens in tailwind.css:
// - SOP: blue-100, blue-700, blue-300, blue-200
// - Framework: amber-100, amber-700, amber-300, amber-200
// - Policy: purple-100, purple-600, purple-300, purple-200

export const PLAYBOOK_TYPE_COLORS: Record<PlaybookType, PlaybookTypeColor> = {
  sop: {
    bg: '#dbeafe',        // blue-100 / var(--color-blue-100)
    text: '#1d4ed8',      // blue-700 / var(--color-blue-700)
    border: '#93c5fd',    // blue-300 / var(--color-blue-300)
    hoverBg: '#bfdbfe',   // blue-200 / var(--color-blue-200)
    shadowColor: 'rgba(29, 78, 216, 0.15)'
  },
  framework: {
    bg: '#fef3c7',        // amber-100 / var(--color-amber-100)
    text: '#b45309',      // amber-700 / var(--color-amber-700)
    border: '#fcd34d',    // amber-300 / var(--color-amber-300)
    hoverBg: '#fde68a',   // amber-200 / var(--color-amber-200)
    shadowColor: 'rgba(180, 83, 9, 0.15)'
  },
  policy: {
    bg: '#f3e8ff',        // purple-100 / var(--color-purple-100)
    text: '#7c3aed',      // purple-600 / var(--color-purple-600)
    border: '#c4b5fd',    // purple-300 / var(--color-purple-300)
    hoverBg: '#e9d5ff',   // purple-200 / var(--color-purple-200)
    shadowColor: 'rgba(124, 58, 237, 0.15)'
  }
};

/**
 * Get color scheme for a playbook type
 */
export function getPlaybookTypeColor(type: string | null | undefined): PlaybookTypeColor {
  if (type && type in PLAYBOOK_TYPE_COLORS) {
    return PLAYBOOK_TYPE_COLORS[type as PlaybookType];
  }
  return PLAYBOOK_TYPE_COLORS.sop;
}

// ============================================
// CSS VARIABLE INJECTION
// ============================================

interface CSSVars {
  [key: string]: string;
}

/**
 * Generate CSS custom properties for a department
 * Use this for inline styles or CSS-in-JS
 */
export function getDeptCSSVars(deptId: string | null | undefined): CSSVars {
  const colors = getDeptColor(deptId);
  return {
    '--dept-bg': colors.bg,
    '--dept-text': colors.text,
    '--dept-border': colors.border,
    '--dept-hover-bg': colors.hoverBg,
  };
}

/**
 * Generate CSS custom properties for a playbook type
 */
export function getTypeCSSVars(type: string | null | undefined): CSSVars {
  const colors = getPlaybookTypeColor(type);
  return {
    '--type-bg': colors.bg,
    '--type-text': colors.text,
    '--type-border': colors.border,
    '--type-hover-bg': colors.hoverBg,
  };
}
