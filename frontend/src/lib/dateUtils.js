/**
 * Centralized date formatting utilities
 *
 * Single source of truth for date formatting across the application.
 * Uses unambiguous format (day month year) to avoid US/EU confusion.
 */

const DATE_LOCALE = 'en-GB';

/**
 * Format a date as "6 December 2025"
 * Use for: member join dates, created dates, formal displays
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Format a date as "6 Dec 2025"
 * Use for: compact displays where space is limited
 */
export const formatDateShort = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format a date as "Dec 6" (no year)
 * Use for: recent dates within the same year, update timestamps
 */
export const formatDateCompact = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
  });
};

/**
 * Format a date as "Monday, 6 December 2025"
 * Use for: activity logs, detailed date displays
 */
export const formatDateWithWeekday = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Format a relative date like "Just now", "5m ago", "2h ago", "3d ago"
 * Falls back to formatDateShort for older dates
 * Use for: activity feeds, last updated timestamps
 */
export const formatRelativeDate = (date) => {
  if (!date) return '';

  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateShort(date);
};

/**
 * Format date for grouping (activity logs, conversation lists)
 * Returns "Today", "Yesterday", or weekday with date
 */
export const formatDateGroup = (date) => {
  if (!date) return '';

  const d = new Date(date);
  const now = new Date();

  // Reset time parts for comparison
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayOnly = new Date(todayOnly);
  yesterdayOnly.setDate(yesterdayOnly.getDate() - 1);

  if (dateOnly.getTime() === todayOnly.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';

  // For activity grouping: "Monday, 6 Dec"
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
};

/**
 * Format datetime with time for tooltips
 * Returns "Sat, 6 Dec 2025, 14:30"
 * Use for: conversation tooltips, detailed timestamps
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
