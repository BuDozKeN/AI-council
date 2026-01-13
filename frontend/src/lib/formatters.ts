/**
 * Centralized Internationalized Formatting Utilities
 *
 * Provides consistent date, time, number, and currency formatting
 * that respects user locale settings.
 */

import { getIntlLocale } from '../i18n';
import i18n from '../i18n';

/**
 * Format a date in the user's locale
 * @param date - Date to format
 * @param format - Formatting style: 'short' (1/1/24), 'medium' (Jan 1, 2024), 'long' (January 1, 2024)
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'medium'
): string => {
  const locale = getIntlLocale();
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: format,
  }).format(dateObj);
};

/**
 * Format a date and time in the user's locale
 * @param date - Date to format
 * @param dateFormat - Date style
 * @param timeFormat - Time style
 * @returns Formatted date-time string
 */
export const formatDateTime = (
  date: Date | string,
  dateFormat: 'short' | 'medium' | 'long' = 'medium',
  timeFormat: 'short' | 'medium' | 'long' = 'short'
): string => {
  const locale = getIntlLocale();
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: dateFormat,
    timeStyle: timeFormat,
  }).format(dateObj);
};

/**
 * Format a time in the user's locale
 * @param date - Date to extract time from
 * @param format - Time style: 'short' (1:30 PM), 'medium' (1:30:00 PM), 'long' (1:30:00 PM GMT)
 * @returns Formatted time string
 */
export const formatTime = (
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'short'
): string => {
  const locale = getIntlLocale();
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    timeStyle: format,
  }).format(dateObj);
};

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 * @param date - Date to compare to now
 * @returns Localized relative time string
 */
export const formatRelativeTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const t = i18n.t.bind(i18n);

  // Future dates
  if (diffMs < 0) {
    const absDiffMins = Math.abs(diffMins);
    const absDiffHours = Math.abs(diffHours);
    const absDiffDays = Math.abs(diffDays);

    if (absDiffMins < 60) return t('dates.inMinutes', { count: absDiffMins });
    if (absDiffHours < 24) return t('dates.inHours', { count: absDiffHours });
    return t('dates.inDays', { count: absDiffDays });
  }

  // Past dates
  if (diffSecs < 60) return t('dates.justNow');
  if (diffMins < 60) return t('dates.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('dates.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('dates.daysAgo', { count: diffDays });
  if (diffWeeks < 4) return t('dates.weeksAgo', { count: diffWeeks });
  if (diffMonths < 12) return t('dates.monthsAgo', { count: diffMonths });
  return t('dates.yearsAgo', { count: diffYears });
};

/**
 * Format a number in the user's locale
 * @param num - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export const formatNumber = (num: number, decimals = 0): string => {
  const locale = getIntlLocale();

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format a large number with compact notation (e.g., 1.2K, 3.4M)
 * @param num - Number to format
 * @param decimals - Number of decimal places
 * @returns Compact formatted number string
 */
export const formatCompactNumber = (num: number, decimals = 1): string => {
  const locale = getIntlLocale();

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format a percentage in the user's locale
 * @param num - Number to format (0.75 = 75%)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercent = (num: number, decimals = 0): string => {
  const locale = getIntlLocale();

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format a currency amount in the user's locale
 * @param amount - Amount to format
 * @param currency - ISO 4217 currency code (USD, EUR, GBP, JPY, etc.)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  const locale = getIntlLocale();

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Format a file size in bytes to human-readable format
 * @param bytes - Number of bytes
 * @returns Formatted file size (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  const t = i18n.t.bind(i18n);

  if (bytes === 0) return `0 ${t('fileSize.bytes')}`;

  const k = 1024;
  const sizes = [
    'fileSize.bytes',
    'fileSize.kb',
    'fileSize.mb',
    'fileSize.gb',
    'fileSize.tb',
  ];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

  return `${size} ${t(sizes[i])}`;
};

/**
 * Format a duration in milliseconds to human-readable format
 * @param ms - Duration in milliseconds
 * @returns Formatted duration (e.g., "2h 30m")
 */
export const formatDuration = (ms: number): string => {
  const t = i18n.t.bind(i18n);

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0
      ? `${days}${t('duration.d')} ${remainingHours}${t('duration.h')}`
      : `${days}${t('duration.d')}`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}${t('duration.h')} ${remainingMinutes}${t('duration.m')}`
      : `${hours}${t('duration.h')}`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}${t('duration.m')} ${remainingSeconds}${t('duration.s')}`
      : `${minutes}${t('duration.m')}`;
  }
  return `${seconds}${t('duration.s')}`;
};

/**
 * Format a month/year (e.g., "January 2024")
 * @param date - Date to format
 * @returns Formatted month and year
 */
export const formatMonthYear = (date: Date | string): string => {
  const locale = getIntlLocale();
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
  }).format(dateObj);
};

/**
 * Check if a date is today
 * @param date - Date to check
 * @returns True if the date is today
 */
export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
};

/**
 * Check if a date is yesterday
 * @param date - Date to check
 * @returns True if the date is yesterday
 */
export const isYesterday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear()
  );
};

/**
 * Format a date with smart relative/absolute formatting
 * - "Just now" for < 1 minute ago
 * - "X minutes/hours ago" for < 24 hours ago
 * - "Yesterday" for yesterday
 * - Full date for older dates
 */
export const formatSmartDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) {
    return formatRelativeTime(dateObj);
  }

  if (isYesterday(dateObj)) {
    return i18n.t('dates.yesterday');
  }

  return formatDate(dateObj, 'medium');
};
