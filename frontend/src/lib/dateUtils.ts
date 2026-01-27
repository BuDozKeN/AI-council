/**
 * Centralized date formatting utilities
 *
 * Single source of truth for date formatting across the application.
 * Uses unambiguous format (day month year) to avoid US/EU confusion.
 * Locale-aware: formats dates according to user's language preference.
 */

import i18n from '../i18n';
import { getIntlLocale } from '../i18n';

type DateInput = string | number | Date | null | undefined;

/**
 * Get current locale for Intl APIs.
 * This is called on each format to ensure it picks up language changes.
 */
const getLocale = (): string => getIntlLocale();

/**
 * Format a date as "6 December 2025"
 * Use for: member join dates, created dates, formal displays
 */
export const formatDate = (date: DateInput): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Format a date as "6 Dec 2025"
 * Use for: compact displays where space is limited
 */
export const formatDateShort = (date: DateInput): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format a date as "Dec 6" (no year)
 * Use for: recent dates within the same year, update timestamps
 */
export const formatDateCompact = (date: DateInput): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'short',
  });
};

/**
 * Format a date as "Monday, 6 December 2025"
 * Use for: activity logs, detailed date displays
 */
export const formatDateWithWeekday = (date: DateInput): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(getLocale(), {
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
export const formatRelativeDate = (date: DateInput): string => {
  if (!date) return '';

  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Use i18n translations for relative dates
  if (diffMins < 1) return i18n.t('dates.justNow');
  if (diffMins < 60) return i18n.t('dates.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('dates.hoursAgo', { count: diffHours });
  if (diffDays < 7) return i18n.t('dates.daysAgo', { count: diffDays });

  return formatDateShort(date);
};

/**
 * Format date for grouping (activity logs, conversation lists)
 * Returns "Today", "Yesterday", or weekday with date (adds year for entries older than 30 days)
 */
export const formatDateGroup = (date: DateInput): string => {
  if (!date) return '';

  const d = new Date(date);
  const now = new Date();

  // Reset time parts for comparison
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayOnly = new Date(todayOnly);
  yesterdayOnly.setDate(yesterdayOnly.getDate() - 1);

  if (dateOnly.getTime() === todayOnly.getTime()) return i18n.t('dates.today');
  if (dateOnly.getTime() === yesterdayOnly.getTime()) return i18n.t('dates.yesterday');

  // Calculate days elapsed
  const diffMs = todayOnly.getTime() - dateOnly.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  // For entries older than 30 days, include the year
  if (diffDays > 30) {
    return new Date(date).toLocaleDateString(getLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // For activity grouping within 30 days: "Monday, 6 Dec"
  return new Date(date).toLocaleDateString(getLocale(), {
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
export const formatDateTime = (date: DateInput): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString(getLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
