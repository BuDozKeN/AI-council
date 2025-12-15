/**
 * Centralized color definitions for AI Council
 *
 * This file is the SINGLE SOURCE OF TRUTH for all color schemes.
 * Import from here instead of defining colors locally in components.
 */

// ============================================
// DEPARTMENT COLORS
// ============================================
// Subtle, professional colors that don't compete with type badges
// Each department gets a consistent color based on its ID hash

export const DEPT_COLORS = [
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', hoverBg: '#fde68a' },  // Amber
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', hoverBg: '#bfdbfe' },  // Blue
  { bg: '#dcfce7', text: '#166534', border: '#86efac', hoverBg: '#bbf7d0' },  // Green
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4', hoverBg: '#fbcfe8' },  // Pink
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc', hoverBg: '#c7d2fe' },  // Indigo
  { bg: '#fef9c3', text: '#854d0e', border: '#fde047', hoverBg: '#fef08a' },  // Yellow
  { bg: '#ccfbf1', text: '#115e59', border: '#5eead4', hoverBg: '#99f6e4' },  // Teal
  { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af', hoverBg: '#fecdd3' },  // Rose
];

/**
 * Get consistent color for a department based on its ID
 * @param {string} deptId - Department UUID
 * @returns {object} Color object with bg, text, border, hoverBg
 */
export function getDeptColor(deptId) {
  if (!deptId) return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb', hoverBg: '#e5e7eb' };

  // Simple hash based on first chars of UUID
  const hash = deptId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DEPT_COLORS[hash % DEPT_COLORS.length];
}

// ============================================
// PLAYBOOK TYPE COLORS (SOP, Framework, Policy)
// ============================================

export const PLAYBOOK_TYPE_COLORS = {
  sop: {
    bg: '#dbeafe',
    text: '#1d4ed8',
    border: '#93c5fd',
    hoverBg: '#bfdbfe',
    shadowColor: 'rgba(29, 78, 216, 0.15)'
  },
  framework: {
    bg: '#fef3c7',
    text: '#b45309',
    border: '#fcd34d',
    hoverBg: '#fde68a',
    shadowColor: 'rgba(180, 83, 9, 0.15)'
  },
  policy: {
    bg: '#f3e8ff',
    text: '#7c3aed',
    border: '#c4b5fd',
    hoverBg: '#e9d5ff',
    shadowColor: 'rgba(124, 58, 237, 0.15)'
  }
};

/**
 * Get color scheme for a playbook type
 * @param {string} type - 'sop', 'framework', or 'policy'
 * @returns {object} Color object
 */
export function getPlaybookTypeColor(type) {
  return PLAYBOOK_TYPE_COLORS[type] || PLAYBOOK_TYPE_COLORS.sop;
}

// ============================================
// CSS VARIABLE INJECTION
// ============================================

/**
 * Generate CSS custom properties for a department
 * Use this for inline styles or CSS-in-JS
 */
export function getDeptCSSVars(deptId) {
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
export function getTypeCSSVars(type) {
  const colors = getPlaybookTypeColor(type);
  return {
    '--type-bg': colors.bg,
    '--type-text': colors.text,
    '--type-border': colors.border,
    '--type-hover-bg': colors.hoverBg,
  };
}
