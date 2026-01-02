/**
 * UsageTab - LLM Usage Analytics Dashboard
 *
 * Displays:
 * - Summary stats (cost, sessions, tokens, cache savings)
 * - Stacked bar chart showing daily usage by model
 * - Council roster (transparency, not configuration)
 * - Budget progress bar
 * - Unacknowledged alerts
 *
 * Following the Council synthesis recommendation:
 * - Focus on transparency, not configuration
 * - Showcase multi-model value through visualization
 */

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Gauge, AlertTriangle, Zap, TrendingUp, Bot } from 'lucide-react';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { Skeleton } from '../../ui/Skeleton';
import { getModelPersona, getModelColor as getModelColorFromPersona } from '../../../config/modelPersonas';
import type {
  UsageData,
  RateLimitStatus,
  BudgetAlert,
  UsagePeriod,
} from '../hooks/useUsageData';

// ============================================================================
// Constants
// ============================================================================

const PERIOD_OPTIONS: { value: UsagePeriod; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
];

// Responsive breakpoint (matches CSS media queries)
const MOBILE_BREAKPOINT = 768;

// Chart dimensions (responsive) - compact, data-driven
const CHART_CONFIG = {
  bar: {
    // Base height + per-bar height for dynamic sizing
    baseHeight: { mobile: 60, desktop: 80 },
    perBarHeight: { mobile: 28, desktop: 32 },
    maxHeight: { mobile: 200, desktop: 220 },
    minHeight: { mobile: 100, desktop: 120 },
    margin: {
      mobile: { top: 8, right: 8, left: 0, bottom: 8 },
      desktop: { top: 12, right: 16, left: 8, bottom: 12 },
    },
    fontSize: { mobile: 10, desktop: 11 },
    yAxisWidth: { mobile: 32, desktop: 45 },
    xAxisHeight: { mobile: 24, desktop: 28 },
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function formatCost(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 0.01) return '$0.00';
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  if (dollars < 100) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(0)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Get short display name for a model using centralized persona config
 */
function getModelShortName(model: string): string {
  return getModelPersona(model).shortName;
}

/**
 * Get color for a model using centralized persona config
 */
function getModelColor(model: string): string {
  return getModelColorFromPersona(model);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate dynamic chart height based on number of data points
 */
function getChartHeight(dataPoints: number, isMobile: boolean): number {
  const config = CHART_CONFIG.bar;
  const base = isMobile ? config.baseHeight.mobile : config.baseHeight.desktop;
  const perBar = isMobile ? config.perBarHeight.mobile : config.perBarHeight.desktop;
  const min = isMobile ? config.minHeight.mobile : config.minHeight.desktop;
  const max = isMobile ? config.maxHeight.mobile : config.maxHeight.desktop;

  const calculated = base + (dataPoints * perBar);
  return Math.min(max, Math.max(min, calculated));
}

// ============================================================================
// Props
// ============================================================================

interface UsageTabProps {
  usage?: UsageData | null;
  rateLimits?: RateLimitStatus | null;
  alerts?: BudgetAlert[];
  loading?: boolean;
  usageLoaded?: boolean;
  isRefetching?: boolean; // Background refresh (old data still visible)
  error?: string | null;
  period?: UsagePeriod;
  onPeriodChange?: (period: UsagePeriod) => void;
  onAlertAcknowledge?: (alertId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function UsageTab({
  usage = null,
  rateLimits = null,
  alerts = [],
  loading: _loading = false,
  usageLoaded = false,
  isRefetching = false,
  error = null,
  period = 30,
  onPeriodChange,
  onAlertAcknowledge,
}: UsageTabProps) {
  // Mobile detection for responsive chart heights
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate cache savings in cents (rough estimate)
  const cacheSavings = useMemo(() => {
    if (!usage) return 0;
    // Estimate: cached tokens save ~90% of input cost
    // Average input cost across models: ~$2/1M tokens
    const savingsPerMillion = 1.8; // $1.80 per million cached tokens
    const cachedMillions = usage.summary.total_cache_read_tokens / 1_000_000;
    return Math.round(cachedMillions * savingsPerMillion * 100); // In cents
  }, [usage]);

  // Prepare chart data - ONLY real data, no mock/padding
  const chartData = useMemo(() => {
    if (!usage) return [];

    // Filter to only days with actual usage - no fake data
    const daysWithData = usage.daily.filter(day =>
      day.sessions > 0 || day.tokens_total > 0 || day.estimated_cost_cents > 0
    );

    // Sort chronologically (oldest first for left-to-right display)
    return [...daysWithData]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(day => ({
        date: formatDate(day.date),
        cost: day.estimated_cost_cents / 100,
        sessions: day.sessions,
        tokens: day.tokens_total,
      }));
  }, [usage]);

  // Budget progress
  const budgetProgress = useMemo(() => {
    if (!rateLimits) return null;
    const current = rateLimits.current.budget_monthly_cents ?? 0;
    const limit = rateLimits.config.budget_cents_per_month ?? 10000;
    const percent = limit > 0 ? (current / limit) * 100 : 0;
    return { current, limit, percent: Math.min(percent, 100) };
  }, [rateLimits]);


  // Show skeleton during initial load (when not yet loaded and no error)
  if (!usageLoaded && !error) {
    return (
      <div className="mc-usage">
        {/* Stats skeleton */}
        <div className="mc-stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="mc-stat-card">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* Period selector skeleton */}
        <div className="mc-usage-header">
          <Skeleton className="h-8 w-32" />
        </div>
        {/* Chart skeleton */}
        <div className="mc-usage-chart-container">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mc-empty">
        <AlertTriangle size={32} className="mc-empty-icon" style={{ color: 'var(--color-warning)' }} />
        <p className="mc-empty-title">Failed to load usage data</p>
        <p className="mc-empty-hint">{error}</p>
      </div>
    );
  }

  // Check if we have data or showing empty state
  const hasData = usage && usage.summary.total_sessions > 0;

  return (
    <div className="mc-usage">
      {/* Empty state banner */}
      {!hasData && (
        <div className="mc-usage-empty-banner">
          <Gauge size={20} />
          <span>Start a council session to see usage analytics</span>
        </div>
      )}

      {/* Unacknowledged alerts */}
      {alerts.length > 0 && (
        <div className="mc-usage-alerts">
          {alerts.map(alert => (
            <div key={alert.id} className="mc-usage-alert">
              <AlertTriangle size={16} className="mc-usage-alert-icon" />
              <span className="mc-usage-alert-text">
                {alert.alert_type.replace(/_/g, ' ')}:{' '}
                {alert.current_value} / {alert.limit_value}
              </span>
              {onAlertAcknowledge && (
                <button
                  className="mc-usage-alert-dismiss"
                  onClick={() => onAlertAcknowledge(alert.id)}
                >
                  Dismiss
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className={`mc-stats-grid ${!hasData ? 'empty-state' : ''}`}>
        <div className="mc-stat-card">
          <Gauge size={20} className="mc-stat-icon" />
          <div className="mc-stat-content">
            <span className="mc-stat-value">
              {hasData ? formatCost(usage.summary.estimated_cost_cents) : '$0.00'}
            </span>
            <span className="mc-stat-label">Total Cost</span>
          </div>
        </div>
        <div className="mc-stat-card">
          <Bot size={20} className="mc-stat-icon" />
          <div className="mc-stat-content">
            <span className="mc-stat-value">
              {hasData ? usage.summary.total_sessions : 0}
            </span>
            <span className="mc-stat-label">Sessions</span>
          </div>
        </div>
        <div className="mc-stat-card">
          <TrendingUp size={20} className="mc-stat-icon" />
          <div className="mc-stat-content">
            <span className="mc-stat-value">
              {hasData ? formatTokens(usage.summary.total_tokens) : '0'}
            </span>
            <span className="mc-stat-label">Tokens</span>
          </div>
        </div>
        <div className="mc-stat-card accent">
          <Zap size={20} className="mc-stat-icon" />
          <div className="mc-stat-content">
            <span className="mc-stat-value">
              {hasData ? `${usage.summary.cache_hit_rate.toFixed(1)}%` : '0%'}
            </span>
            <span className="mc-stat-label">Cache Hit Rate</span>
            {hasData && cacheSavings > 0 && (
              <span className="mc-stat-sublabel">Saved {formatCost(cacheSavings)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Header with period selector */}
      <div className="mc-usage-header">
        <h2 className="mc-usage-title">Usage</h2>
        <div className={`mc-usage-period-toggle ${isRefetching ? 'loading' : ''}`}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`mc-usage-period-opt ${period === opt.value ? 'active' : ''}`}
              onClick={() => onPeriodChange?.(opt.value)}
              disabled={isRefetching}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollableContent className="mc-usage-scroll">
        {/* Daily cost chart */}
        <div className={`mc-usage-section ${!hasData ? 'empty-state' : ''}`}>
          <h3 className="mc-usage-section-title">Daily Cost</h3>
          <div className="mc-usage-chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height={getChartHeight(chartData.length, isMobile)}
                debounce={50}
              >
                <BarChart
                  data={chartData}
                  margin={isMobile ? CHART_CONFIG.bar.margin.mobile : CHART_CONFIG.bar.margin.desktop}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: isMobile ? CHART_CONFIG.bar.fontSize.mobile : CHART_CONFIG.bar.fontSize.desktop,
                      fill: 'var(--color-text-secondary)',
                    }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    height={isMobile ? CHART_CONFIG.bar.xAxisHeight.mobile : CHART_CONFIG.bar.xAxisHeight.desktop}
                  />
                  <YAxis
                    tick={{
                      fontSize: isMobile ? CHART_CONFIG.bar.fontSize.mobile : CHART_CONFIG.bar.fontSize.desktop,
                      fill: 'var(--color-text-secondary)',
                    }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tickFormatter={(v) => `$${v}`}
                    width={isMobile ? CHART_CONFIG.bar.yAxisWidth.mobile : CHART_CONFIG.bar.yAxisWidth.desktop}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                    labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 4 }}
                    formatter={(value) => [`$${(value as number).toFixed(2)}`, 'Cost']}
                  />
                  <Bar
                    dataKey="cost"
                    fill="var(--color-primary)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={80}
                    minPointSize={3}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="mc-usage-chart-empty">
                <TrendingUp size={32} />
                <span>No usage data for this period</span>
              </div>
            )}
          </div>
        </div>

        {/* Model breakdown - clean horizontal bars */}
        <div className={`mc-usage-section ${!hasData ? 'empty-state' : ''}`}>
          <h3 className="mc-usage-section-title">Cost by Model</h3>
          {hasData && usage.models.length > 0 ? (
            <div className="mc-usage-model-bars">
              {usage.models.map((model) => {
                const maxCost = Math.max(...usage.models.map(m => m.cost_cents));
                const percentage = maxCost > 0 ? (model.cost_cents / maxCost) * 100 : 0;
                return (
                  <div key={model.model} className="mc-usage-model-row">
                    <div className="mc-usage-model-label">
                      <div
                        className="mc-usage-model-dot"
                        style={{ background: getModelColor(model.model) }}
                      />
                      <span className="mc-usage-model-name">
                        {getModelShortName(model.model)}
                      </span>
                    </div>
                    <div className="mc-usage-model-bar-wrapper">
                      <div
                        className="mc-usage-model-bar-fill"
                        style={{
                          width: `${percentage}%`,
                          background: getModelColor(model.model),
                        }}
                      />
                    </div>
                    <div className="mc-usage-model-values">
                      <span className="mc-usage-model-cost">
                        {formatCost(model.cost_cents)}
                      </span>
                      <span className="mc-usage-model-tokens">
                        {formatTokens(model.tokens_input + model.tokens_output)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mc-usage-models-empty">
              <p>Model usage will appear here after your first council session.</p>
            </div>
          )}
        </div>

        {/* Budget progress */}
        <div className={`mc-usage-section ${!hasData ? 'empty-state' : ''}`}>
          <h3 className="mc-usage-section-title">Monthly Budget</h3>
          <div className="mc-usage-budget">
            <div className="mc-usage-budget-header">
              <span className="mc-usage-budget-current">
                {budgetProgress ? formatCost(budgetProgress.current) : '$0.00'}
              </span>
              <span className="mc-usage-budget-limit">
                / {budgetProgress ? formatCost(budgetProgress.limit) : '$100.00'}
              </span>
            </div>
            <div className="mc-usage-budget-bar">
              <div
                className={`mc-usage-budget-fill ${budgetProgress && budgetProgress.percent >= 80 ? 'warning' : ''} ${budgetProgress && budgetProgress.percent >= 100 ? 'exceeded' : ''}`}
                style={{ width: `${budgetProgress?.percent ?? 0}%` }}
              />
            </div>
            <div className="mc-usage-budget-footer">
              <span className="mc-usage-budget-percent">
                {budgetProgress ? `${budgetProgress.percent.toFixed(0)}% used` : '0% used'}
              </span>
              {rateLimits?.warnings.length ? (
                <span className="mc-usage-budget-warning">
                  <AlertTriangle size={16} />
                  {rateLimits.warnings[0]}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Additional stats */}
        <div className={`mc-usage-section ${!hasData ? 'empty-state' : ''}`}>
          <h3 className="mc-usage-section-title">Session Stats</h3>
          <div className="mc-usage-extra-stats">
            <div className="mc-usage-extra-stat">
              <span className="mc-usage-extra-label">Avg tokens/session</span>
              <span className="mc-usage-extra-value">
                {hasData ? formatTokens(usage.summary.avg_tokens_per_session) : '0'}
              </span>
            </div>
            <div className="mc-usage-extra-stat">
              <span className="mc-usage-extra-label">Ranking parse rate</span>
              <span className="mc-usage-extra-value">
                {hasData ? `${usage.summary.parse_success_rate?.toFixed(1) ?? 100}%` : '100%'}
              </span>
            </div>
            <div className="mc-usage-extra-stat">
              <span className="mc-usage-extra-label">Input tokens</span>
              <span className="mc-usage-extra-value">
                {hasData ? formatTokens(usage.summary.total_input_tokens) : '0'}
              </span>
            </div>
            <div className="mc-usage-extra-stat">
              <span className="mc-usage-extra-label">Output tokens</span>
              <span className="mc-usage-extra-value">
                {hasData ? formatTokens(usage.summary.total_output_tokens) : '0'}
              </span>
            </div>
          </div>
        </div>
      </ScrollableContent>
    </div>
  );
}

export default UsageTab;
