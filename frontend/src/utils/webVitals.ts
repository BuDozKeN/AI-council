/* eslint-disable no-console -- Dev logging for web vitals metrics */
/**
 * Web Vitals Performance Monitoring
 *
 * Tracks Core Web Vitals metrics for performance optimization:
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - TTFB (Time to First Byte)
 * - INP (Interaction to Next Paint) - replaced FID in web-vitals v4+
 *
 * In production, these metrics should be sent to an analytics service.
 */

import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';
import * as Sentry from '@sentry/react';

type MetricName = 'CLS' | 'FCP' | 'LCP' | 'TTFB' | 'INP';

// Log metrics in development, send to Sentry in production
function sendToAnalytics(metric: Metric): void {
  // Development: Log to console with styling
  if (import.meta.env.DEV) {
    const color = getMetricColor(metric);
    console.log(
      `%c[Web Vitals] ${metric.name}: ${Math.round(metric.value)}${getMetricUnit(metric.name)}`,
      `color: ${color}; font-weight: bold;`
    );
    return;
  }

  // Production: Send to Sentry as custom measurements
  // This enables Sentry's Web Vitals dashboard and alerts
  try {
    // Add as breadcrumb for context in error reports
    Sentry.addBreadcrumb({
      category: 'web-vitals',
      message: `${metric.name}: ${Math.round(metric.value)}${getMetricUnit(metric.name)} (${metric.rating})`,
      level: metric.rating === 'poor' ? 'warning' : 'info',
      data: {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
      },
    });

    // Send poor metrics as measurements on the current transaction
    // This allows tracking in Sentry Performance dashboard
    if (metric.rating === 'poor') {
      Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
    }
  } catch {
    // Sentry not initialized - fall back to sessionStorage
  }

  // Also store in sessionStorage for debugging
  const vitals = JSON.parse(sessionStorage.getItem('webVitals') || '{}');
  vitals[metric.name] = {
    value: metric.value,
    rating: metric.rating, // 'good', 'needs-improvement', or 'poor'
    delta: metric.delta,
    id: metric.id,
    timestamp: Date.now(),
  };
  sessionStorage.setItem('webVitals', JSON.stringify(vitals));
}

// Get color based on metric rating
function getMetricColor(metric: Metric): string {
  const colors: Record<string, string> = {
    good: '#4CAF50',
    'needs-improvement': '#FF9800',
    poor: '#F44336',
  };
  return colors[metric.rating] ?? '#2196F3';
}

// Get unit for each metric
function getMetricUnit(name: MetricName): string {
  const units: Record<MetricName, string> = {
    CLS: '', // unitless
    FCP: 'ms',
    LCP: 'ms',
    TTFB: 'ms',
    INP: 'ms',
  };
  return units[name] ?? '';
}

/**
 * Initialize Web Vitals tracking
 *
 * Call this once in your app's entry point (main.jsx)
 */
export function initWebVitals() {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  try {
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics); // INP replaced FID in web-vitals v4+
  } catch (error) {
    console.warn('Failed to initialize Web Vitals:', error);
  }
}

/**
 * Get collected Web Vitals from sessionStorage
 * Useful for debugging and displaying in a dev panel
 */
export function getWebVitals() {
  if (typeof window === 'undefined') return {};
  return JSON.parse(sessionStorage.getItem('webVitals') || '{}');
}

/**
 * Clear collected Web Vitals
 */
export function clearWebVitals() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('webVitals');
  }
}

export default initWebVitals;
