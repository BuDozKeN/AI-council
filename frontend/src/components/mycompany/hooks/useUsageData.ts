/**
 * useUsageData - Hook for LLM usage analytics
 *
 * Fetches usage data, rate limits, and budget alerts from the backend.
 * Provides formatted data ready for charts and display.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';

const log = logger.scope('useUsageData');

// ============================================================================
// Types
// ============================================================================

export interface UsageSummary {
  total_sessions: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  estimated_cost_cents: number;
  avg_tokens_per_session: number;
  cache_hit_rate: number;
}

export interface DailyUsage {
  date: string;
  sessions: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cache_read_tokens: number;
  estimated_cost_cents: number;
}

export interface ModelUsage {
  model: string;
  sessions: number;
  tokens_input: number;
  tokens_output: number;
  cost_cents: number;
}

export interface RateLimitConfig {
  sessions_per_hour: number;
  sessions_per_day: number;
  tokens_per_month: number;
  budget_cents_per_month: number;
  alert_threshold_percent: number;
}

export interface RateLimitCurrent {
  sessions_hourly: number;
  sessions_daily: number;
  tokens_monthly: number;
  budget_monthly_cents: number;
}

export interface RateLimitStatus {
  tier: string;
  config: RateLimitConfig;
  current: RateLimitCurrent;
  warnings: string[];
  exceeded: string[];
}

export interface BudgetAlert {
  id: string;
  alert_type: string;
  current_value: number;
  limit_value: number;
  created_at: string;
  acknowledged: boolean;
}

export interface UsageData {
  summary: UsageSummary;
  daily: DailyUsage[];
  models: ModelUsage[];
  period_days: number;
}

export type UsagePeriod = 7 | 30 | 90;

// ============================================================================
// Hook
// ============================================================================

interface UseUsageDataOptions {
  companyId: string | null;
  initialPeriod?: UsagePeriod;
}

export function useUsageData({ companyId, initialPeriod = 30 }: UseUsageDataOptions) {
  // Data state
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitStatus | null>(null);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);

  // UI state
  const [period, setPeriod] = useState<UsagePeriod>(initialPeriod);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageLoaded, setUsageLoaded] = useState(false);

  // Load all data - single function without nested callbacks
  const loadData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      // Load usage, rate limits, and alerts in parallel
      const [usageResult, rateLimitsResult, alertsResult] = await Promise.allSettled([
        api.getLlmUsage(companyId, period),
        api.getRateLimits(companyId),
        api.getBudgetAlerts(companyId, { acknowledged: false, limit: 10 }),
      ]);

      // Process usage result (required)
      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value);
        setUsageLoaded(true);
      } else {
        log.error('Failed to load usage data', { error: usageResult.reason });
        const errorMessage = usageResult.reason instanceof Error
          ? usageResult.reason.message
          : 'Failed to load usage data';
        setError(errorMessage);
      }

      // Process rate limits result (optional)
      if (rateLimitsResult.status === 'fulfilled') {
        setRateLimits(rateLimitsResult.value);
      } else {
        log.error('Failed to load rate limits', { error: rateLimitsResult.reason });
      }

      // Process alerts result (optional)
      if (alertsResult.status === 'fulfilled') {
        setAlerts(alertsResult.value.alerts || []);
      } else {
        log.error('Failed to load alerts', { error: alertsResult.reason });
      }
    } catch (err) {
      log.error('Failed to load usage data', { error: err });
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [companyId, period]);

  // Load on mount and when dependencies change
  useEffect(() => {
    if (companyId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData already depends on companyId and period
  }, [companyId, period]);

  // Reset when company changes
  useEffect(() => {
    setUsage(null);
    setRateLimits(null);
    setAlerts([]);
    setUsageLoaded(false);
    setError(null);
  }, [companyId]);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!companyId) return;

    try {
      await api.acknowledgeBudgetAlert(companyId, alertId);
      // Remove from local state
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      log.error('Failed to acknowledge alert', { error: err });
      throw err;
    }
  }, [companyId]);

  // Change period and reload
  const changePeriod = useCallback((newPeriod: UsagePeriod) => {
    setPeriod(newPeriod);
    setUsageLoaded(false);
  }, []);

  return {
    // Data
    usage,
    rateLimits,
    alerts,

    // State
    period,
    loading,
    error,
    usageLoaded,

    // Actions
    loadData,
    changePeriod,
    acknowledgeAlert,
  };
}
