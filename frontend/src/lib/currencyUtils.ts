/**
 * Centralized currency formatting utilities
 *
 * Single source of truth for currency/cost formatting across the application.
 * Uses Intl.NumberFormat for locale-aware formatting.
 */

import { getIntlLocale } from '../i18n';

/**
 * Format a cost value as currency.
 *
 * Uses the user's locale to determine currency symbol position and formatting.
 * Default currency is USD, but formatting adapts to locale (e.g., $1.23 vs 1,23 $).
 *
 * @param cost - The cost in dollars (not cents)
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  cost: number,
  options: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    compact?: boolean;
  } = {}
): string {
  const locale = getIntlLocale();
  const {
    currency = 'USD',
    minimumFractionDigits: minDigitsOpt,
    maximumFractionDigits: maxDigitsOpt,
    compact = false,
  } = options;

  // Default to 2 decimal places, but ensure min <= max
  const maxDigits = maxDigitsOpt ?? 2;
  const minDigits = minDigitsOpt ?? Math.min(2, maxDigits);

  // For very small amounts, show more precision (only if caller didn't explicitly set digits)
  const autoAdjust = maxDigitsOpt === undefined && minDigitsOpt === undefined;
  const adjustedMinDigits = autoAdjust && cost > 0 && cost < 0.01 ? 3 : minDigits;
  const adjustedMaxDigits = autoAdjust && cost > 0 && cost < 0.01 ? 4 : maxDigits;

  // Final values for compact mode
  const finalMinDigits = compact && cost >= 100 ? 0 : adjustedMinDigits;
  const finalMaxDigits = compact && cost >= 100 ? 0 : adjustedMaxDigits;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Math.min(finalMinDigits, finalMaxDigits),
    maximumFractionDigits: finalMaxDigits,
    notation: compact && cost >= 1000 ? 'compact' : 'standard',
  }).format(cost);
}

/**
 * Format a cost in cents as currency.
 *
 * Convenience wrapper that converts cents to dollars before formatting.
 *
 * @param cents - The cost in cents
 * @param options - Formatting options (same as formatCurrency)
 * @returns Formatted currency string
 */
export function formatCostCents(
  cents: number,
  options: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    compact?: boolean;
  } = {}
): string {
  return formatCurrency(cents / 100, options);
}

/**
 * Format a cost value with automatic precision.
 *
 * Shows more decimal places for small amounts, fewer for large amounts.
 * Useful for displaying API costs that vary widely in magnitude.
 *
 * @param cost - The cost in dollars
 * @returns Formatted currency string with appropriate precision
 */
export function formatCostAuto(cost: number): string {
  const locale = getIntlLocale();

  // Very small amounts: show 4 decimal places
  if (cost > 0 && cost < 0.01) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(cost);
  }

  // Small amounts: show 3 decimal places
  if (cost > 0 && cost < 1) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(cost);
  }

  // Normal amounts: show 2 decimal places
  if (cost < 100) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cost);
  }

  // Large amounts: no decimal places
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cost);
}
