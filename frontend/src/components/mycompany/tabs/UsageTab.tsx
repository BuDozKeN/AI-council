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

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Gauge, AlertTriangle, Zap, TrendingUp, DollarSign, Users, CheckCircle } from 'lucide-react';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { Skeleton } from '../../ui/Skeleton';
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

// Chart colors for models - using design system colors
const MODEL_COLORS: Record<string, string> = {
  'anthropic/claude-opus-4.5': 'hsl(217, 91%, 60%)', // Blue
  'anthropic/claude-sonnet-4': 'hsl(217, 91%, 70%)',
  'openai/gpt-4o': 'hsl(160, 84%, 39%)', // Green
  'openai/gpt-5.1': 'hsl(160, 84%, 49%)',
  'google/gemini-3-pro-preview': 'hsl(280, 100%, 65%)', // Purple
  'google/gemini-2.5-flash': 'hsl(280, 100%, 75%)',
  'x-ai/grok-4': 'hsl(0, 84%, 60%)', // Red
  'x-ai/grok-3': 'hsl(0, 84%, 70%)',
  'deepseek/deepseek-chat': 'hsl(45, 93%, 47%)', // Yellow
  'deepseek/deepseek-chat-v3-0324': 'hsl(45, 93%, 57%)',
};

const DEFAULT_COLOR = 'hsl(215, 20%, 65%)';

// Council roster - the 5 models that make up the council
const COUNCIL_ROSTER = [
  { id: 'gpt', name: 'GPT-5.1', role: 'Generalist Analysis', provider: 'OpenAI' },
  { id: 'claude', name: 'Claude Opus 4.5', role: 'Nuance & Writing', provider: 'Anthropic' },
  { id: 'gemini', name: 'Gemini 3 Pro', role: 'Rapid Synthesis', provider: 'Google' },
  { id: 'grok', name: 'Grok 4', role: 'Contrarian Perspectives', provider: 'xAI' },
  { id: 'deepseek', name: 'DeepSeek V3', role: 'Code & Logic', provider: 'DeepSeek' },
];

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

function getModelShortName(model: string): string {
  const parts = model.split('/');
  const name = parts[parts.length - 1] ?? model;
  return name
    .replace('claude-opus-4.5', 'Opus 4.5')
    .replace('claude-sonnet-4', 'Sonnet 4')
    .replace('gpt-5.1', 'GPT-5.1')
    .replace('gpt-4o', 'GPT-4o')
    .replace('gemini-3-pro-preview', 'Gemini 3')
    .replace('gemini-2.5-flash', 'Flash 2.5')
    .replace('grok-4', 'Grok 4')
    .replace('grok-3', 'Grok 3')
    .replace('deepseek-chat-v3-0324', 'DeepSeek')
    .replace('deepseek-chat', 'DeepSeek');
}

function getModelColor(model: string): string {
  // Try exact match
  if (MODEL_COLORS[model]) return MODEL_COLORS[model];
  // Try partial match
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (model.includes(key) || key.includes(model)) return color;
  }
  return DEFAULT_COLOR;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  error = null,
  period = 30,
  onPeriodChange,
  onAlertAcknowledge,
}: UsageTabProps) {
  // Calculate cache savings in cents (rough estimate)
  const cacheSavings = useMemo(() => {
    if (!usage) return 0;
    // Estimate: cached tokens save ~90% of input cost
    // Average input cost across models: ~$2/1M tokens
    const savingsPerMillion = 1.8; // $1.80 per million cached tokens
    const cachedMillions = usage.summary.total_cache_read_tokens / 1_000_000;
    return Math.round(cachedMillions * savingsPerMillion * 100); // In cents
  }, [usage]);

  // Prepare chart data - reverse to show oldest first (left to right)
  const chartData = useMemo(() => {
    if (!usage) return [];
    return [...usage.daily].reverse().map(day => ({
      date: formatDate(day.date),
      cost: day.estimated_cost_cents / 100,
      sessions: day.sessions,
      tokens: day.tokens_total,
    }));
  }, [usage]);

  // Model breakdown for pie chart
  const modelChartData = useMemo(() => {
    if (!usage || usage.models.length === 0) return [];
    return usage.models.map(m => ({
      name: getModelShortName(m.model),
      value: m.cost_cents,
      fullName: m.model,
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

  // Placeholder chart data for empty state - must be before early returns
  const emptyChartData = useMemo(() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cost: 0,
        sessions: 0,
        tokens: 0,
      });
    }
    return dates;
  }, []);

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
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
        {/* Roster skeleton */}
        <div className="mc-usage-roster">
          <Skeleton className="h-6 w-40 mb-4" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="mc-usage-roster-item">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
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

  // Use real data or placeholders
  const displayChartData = hasData ? chartData : emptyChartData;
  const displayModelData = hasData ? modelChartData : [];

  return (
    <div className="mc-usage">
      {/* Empty state banner */}
      {!hasData && (
        <div className="mc-usage-empty-banner">
          <Gauge size={18} />
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

      {/* Stats grid */}
      <div className={`mc-stats-grid ${!hasData ? 'empty-state' : ''}`}>
        <div className="mc-stat-card">
          <div className="mc-stat-value cost">
            {hasData ? formatCost(usage.summary.estimated_cost_cents) : '$0.00'}
          </div>
          <div className="mc-stat-label">
            <DollarSign size={12} />
            Total Cost
          </div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value">{hasData ? usage.summary.total_sessions : '0'}</div>
          <div className="mc-stat-label">
            <Users size={12} />
            Sessions
          </div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value">
            {hasData ? formatTokens(usage.summary.total_tokens) : '0'}
          </div>
          <div className="mc-stat-label">
            <TrendingUp size={12} />
            Tokens
          </div>
        </div>
        <div className="mc-stat-card highlight">
          <div className="mc-stat-value saved">
            {hasData ? formatCost(cacheSavings) : '$0.00'}
          </div>
          <div className="mc-stat-label">
            <Zap size={12} />
            Cache Saved
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="mc-usage-header">
        <div className="mc-usage-period-selector">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`mc-usage-period-btn ${period === opt.value ? 'active' : ''}`}
              onClick={() => onPeriodChange?.(opt.value)}
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={displayChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                  labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                  formatter={(value) => [`$${(value as number).toFixed(2)}`, 'Cost']}
                />
                <Bar
                  dataKey="cost"
                  fill="hsl(217, 91%, 60%)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model breakdown */}
        <div className={`mc-usage-section ${!hasData ? 'empty-state' : ''}`}>
          <h3 className="mc-usage-section-title">Cost by Model</h3>
          <div className="mc-usage-models-grid">
            <div className="mc-usage-pie-container">
              {displayModelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={displayModelData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {displayModelData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getModelColor(entry.fullName)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                      formatter={(value) => [formatCost(value as number), 'Cost']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="mc-usage-pie-placeholder">
                  <div className="mc-usage-pie-ring" />
                  <span>No model data</span>
                </div>
              )}
            </div>
            <div className="mc-usage-models-list">
              {hasData && usage.models.length > 0 ? (
                usage.models.map((model) => (
                  <div key={model.model} className="mc-usage-model-item">
                    <div
                      className="mc-usage-model-dot"
                      style={{ background: getModelColor(model.model) }}
                    />
                    <div className="mc-usage-model-info">
                      <span className="mc-usage-model-name">
                        {getModelShortName(model.model)}
                      </span>
                      <span className="mc-usage-model-stats">
                        {formatTokens(model.tokens_input + model.tokens_output)} tokens
                      </span>
                    </div>
                    <span className="mc-usage-model-cost">
                      {formatCost(model.cost_cents)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="mc-usage-models-empty">
                  <p>Model usage breakdown will appear here after your first council session.</p>
                </div>
              )}
            </div>
          </div>
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
                  <AlertTriangle size={12} />
                  {rateLimits.warnings[0]}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Council roster */}
        <div className="mc-usage-section">
          <h3 className="mc-usage-section-title">Active Council Roster</h3>
          <div className="mc-usage-roster">
            {COUNCIL_ROSTER.map(member => (
              <div key={member.id} className="mc-usage-roster-item">
                <div className="mc-usage-roster-status">
                  <CheckCircle size={14} />
                </div>
                <div className="mc-usage-roster-info">
                  <span className="mc-usage-roster-name">{member.name}</span>
                  <span className="mc-usage-roster-role">{member.role}</span>
                </div>
                <span className="mc-usage-roster-provider">{member.provider}</span>
              </div>
            ))}
          </div>
          <p className="mc-usage-roster-note">
            Council composition is optimized by AxCouncil for maximum consensus accuracy.
          </p>
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
              <span className="mc-usage-extra-label">Cache hit rate</span>
              <span className="mc-usage-extra-value">
                {hasData ? `${usage.summary.cache_hit_rate.toFixed(1)}%` : '0%'}
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
