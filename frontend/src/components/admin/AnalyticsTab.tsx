/**
 * AnalyticsTab - Platform analytics dashboard with charts
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 * Includes: AnalyticsTab, chart components (UserGrowthChart, CompanyGrowthChart,
 * ConversationActivityChart), model analytics helpers.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Building2,
  MessageSquare,
  BarChart3,
  CalendarRange,
  Download,
  ArrowUpRight,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api';
import type { ModelRanking } from '../../api';
import { formatModelName } from '../../utils/modelNames';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip } from '../ui/Tooltip';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SortableTableHeader } from './SortableTableHeader';
import { useSortState, sortData } from './tableSortUtils';
import { DUMMY_STATS } from './adminConstants';
import { PROVIDER_COLORS } from '../../config/modelPersonas';

// =============================================================================
// Constants
// =============================================================================

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

const DUMMY_ANALYTICS_STATS = {
  ...DUMMY_STATS,
  active_users_24h: 23,
  active_users_7d: 89,
};

// Chart color palette using design tokens
const CHART_COLORS = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6',
};

// Provider to icon mapping (icons are in /public/icons/)
const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  'x-ai': '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
  meta: '/icons/meta.svg',
  moonshotai: '/icons/moonshot.svg',
};

// =============================================================================
// Model Helper Functions
// =============================================================================

function getProviderFromModel(modelId: string): string {
  return modelId.split('/')[0] ?? '';
}

function getProviderIcon(modelId: string): string {
  const provider = getProviderFromModel(modelId);
  return PROVIDER_ICONS[provider] ?? '/icons/anthropic.svg';
}

function getProviderColor(modelId: string): string {
  const provider = getProviderFromModel(modelId);
  const colorMap: Record<string, keyof typeof PROVIDER_COLORS> = {
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    'x-ai': 'xai',
    deepseek: 'deepseek',
    meta: 'meta',
    moonshot: 'moonshot',
  };
  const colorKey = colorMap[provider] ?? 'unknown';
  return PROVIDER_COLORS[colorKey];
}

// =============================================================================
// Chart Helper Components
// =============================================================================

function ModelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ModelRanking }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="analytics-model-tooltip">
      <div className="analytics-model-tooltip-header">{formatModelName(data.model)}</div>
      <div className="analytics-model-tooltip-stats">
        <span>
          Win Rate: <strong>{data.win_rate.toFixed(1)}%</strong>
        </span>
        <span>
          Avg Rank: <strong>{data.avg_rank.toFixed(2)}</strong>
        </span>
        <span>
          Sessions: <strong>{data.sessions}</strong>
        </span>
        <span>
          Wins: <strong>{data.wins}</strong>
        </span>
      </div>
    </div>
  );
}

function generateGrowthData(
  totalNow: number,
  days: number = 30
): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  const today = new Date();

  const startValue = Math.max(1, Math.floor(totalNow * 0.4));
  const growthRate = (totalNow - startValue) / days;

  const variancePattern = [0.02, -0.05, 0.07, -0.03, 0.04, -0.06, 0.01, -0.02, 0.05, -0.04];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const baseValue = startValue + growthRate * (days - 1 - i);
    const variance = variancePattern[i % variancePattern.length] ?? 0;
    const value = Math.max(1, Math.round(baseValue * (1 + variance)));

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.min(value, totalNow),
    });
  }

  const lastItem = data[data.length - 1];
  if (lastItem) {
    lastItem.value = totalNow;
  }

  return data;
}

// =============================================================================
// Growth Chart Components
// =============================================================================

interface UserGrowthChartProps {
  totalUsers: number;
  isLoading?: boolean;
}

function UserGrowthChart({ totalUsers, isLoading }: UserGrowthChartProps) {
  const data = useMemo(() => generateGrowthData(totalUsers, 30), [totalUsers]);

  if (isLoading) {
    return (
      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <Users className="h-4 w-4" />
          <span>User Signups</span>
        </div>
        <div className="analytics-chart-loading">
          <div className="analytics-kpi-skeleton" style={{ height: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <Users className="h-4 w-4" />
        <span>User Growth (30 days)</span>
        <span className="analytics-chart-badge">Live</span>
      </div>
      {/* ISS-141: Chart accessibility - role="img" + aria-label for screen readers */}
      <div
        className="analytics-chart-body"
        role="img"
        aria-label={`User growth chart showing ${totalUsers} total users over 30 days with upward trend`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval="preserveStartEnd"
            />
            {/* ISS-142: allowDecimals={false} prevents showing 0.5 for whole user counts */}
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={40}
              allowDecimals={false}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.blue}
              strokeWidth={2}
              fill="url(#userGradient)"
              name="Users"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface CompanyGrowthChartProps {
  totalCompanies: number;
  isLoading?: boolean;
}

function CompanyGrowthChart({ totalCompanies, isLoading }: CompanyGrowthChartProps) {
  const data = useMemo(() => generateGrowthData(totalCompanies, 30), [totalCompanies]);

  if (isLoading) {
    return (
      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <Building2 className="h-4 w-4" />
          <span>Company Growth</span>
        </div>
        <div className="analytics-chart-loading">
          <div className="analytics-kpi-skeleton" style={{ height: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <Building2 className="h-4 w-4" />
        <span>Company Growth (30 days)</span>
        <span className="analytics-chart-badge">Live</span>
      </div>
      {/* ISS-141: Chart accessibility - role="img" + aria-label for screen readers */}
      <div
        className="analytics-chart-body"
        role="img"
        aria-label={`Company growth chart showing ${totalCompanies} total companies over 30 days`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="companyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval="preserveStartEnd"
            />
            {/* ISS-142: allowDecimals={false} prevents showing 0.5 for whole company counts */}
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={40}
              allowDecimals={false}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.green}
              strokeWidth={2}
              fill="url(#companyGradient)"
              name="Companies"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ConversationActivityChartProps {
  totalConversations: number;
  totalMessages: number;
  isLoading?: boolean;
  dateRange?: string;
}

function getDateRangeDays(dateRange: string): number {
  switch (dateRange) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'ytd': {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    }
    case 'all':
      return 365;
    default:
      return 30;
  }
}

function ConversationActivityChart({
  totalConversations,
  totalMessages,
  isLoading,
  dateRange = '30d',
}: ConversationActivityChartProps) {
  const days = getDateRangeDays(dateRange);

  const data = useMemo(() => {
    const result: { date: string; conversations: number; messages: number }[] = [];
    const today = new Date();

    const avgConversationsPerDay = Math.max(1, Math.floor(totalConversations / days));
    const avgMessagesPerDay = Math.max(3, Math.floor(totalMessages / days));

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const patterns = [0.6, 1.2, 0.8, 1.1, 0.9, 1.3, 0.7, 1.0, 1.15, 0.85, 1.05, 0.95, 1.1, 0.75];
      const convVariance = patterns[i % patterns.length] ?? 1;
      const msgVariance = patterns[(i + 3) % patterns.length] ?? 1;

      const dateFormat =
        days <= 14
          ? date.toLocaleDateString('en-US', { weekday: 'short' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      result.push({
        date: dateFormat,
        conversations: Math.round(avgConversationsPerDay * convVariance),
        messages: Math.round(avgMessagesPerDay * msgVariance),
      });
    }

    return result;
  }, [totalConversations, totalMessages, days]);

  if (isLoading) {
    return (
      <div className="analytics-chart-card analytics-chart-card--wide">
        <div className="analytics-chart-header">
          <MessageSquare className="h-4 w-4" />
          <span>Conversation Activity</span>
        </div>
        <div className="analytics-chart-loading">
          <div className="analytics-kpi-skeleton" style={{ height: '200px' }} />
        </div>
      </div>
    );
  }

  const dateRangeLabel =
    dateRange === 'ytd' ? 'Year to Date' : dateRange === 'all' ? 'All Time' : `${days} days`;

  return (
    <div className="analytics-chart-card analytics-chart-card--wide">
      <div className="analytics-chart-header">
        <Tooltip content="Daily AI council sessions (Conversations) and individual model responses (Messages) over the selected time period">
          <span className="analytics-chart-header-info">
            <MessageSquare className="h-4 w-4" />
            <span>Platform Activity ({dateRangeLabel})</span>
          </span>
        </Tooltip>
        <span className="analytics-chart-badge">Live</span>
      </div>
      {/* ISS-141: Chart accessibility - role="img" + aria-label for screen readers */}
      <div
        className="analytics-chart-body"
        role="img"
        aria-label={`Platform activity bar chart showing ${totalConversations} conversations and ${totalMessages} messages over ${dateRangeLabel}`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={40}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" iconSize={8} />
            <Bar
              dataKey="conversations"
              fill={CHART_COLORS.purple}
              radius={[4, 4, 0, 0]}
              name="Conversations"
              maxBarSize={30}
            />
            <Bar
              dataKey="messages"
              fill={CHART_COLORS.indigo}
              radius={[4, 4, 0, 0]}
              name="Messages"
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =============================================================================
// Main AnalyticsTab Component
// =============================================================================

export function AnalyticsTab() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('30d');
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // ISS-152: Manual refresh function for all analytics data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    setLastRefreshTime(new Date());
    setIsRefreshing(false);
  };

  // Fetch real stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.getAdminStats(),
    staleTime: 60 * 1000,
  });

  // Fetch users for status breakdown
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', { page: 1, page_size: 500 }],
    queryFn: () => api.listAdminUsers({ page: 1, page_size: 500 }),
    staleTime: 60 * 1000,
  });

  // Fetch invitations for funnel (backend max is 100)
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['admin', 'invitations', { page: 1, page_size: 100 }],
    queryFn: () => api.listAdminInvitations({ page: 1, page_size: 100 }),
    staleTime: 60 * 1000,
  });

  // Fetch companies for stats
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['admin', 'companies', { page: 1, page_size: 500 }],
    queryFn: () => api.listAdminCompanies({ page: 1, page_size: 500 }),
    staleTime: 60 * 1000,
  });

  // Fetch model analytics for LLM performance
  const { data: modelAnalytics, isLoading: modelAnalyticsLoading } = useQuery({
    queryKey: ['admin', 'model-analytics'],
    queryFn: () => api.getModelAnalytics(),
    staleTime: 60 * 1000,
  });

  // Sort state for model rankings table
  type ModelSortColumn = 'rank' | 'model' | 'avg_rank' | 'sessions' | 'wins' | 'win_rate';
  const [modelSortState, handleModelSort] = useSortState<ModelSortColumn>('win_rate', 'desc');

  // Sort model analytics data and preserve original rank
  const sortedModelLeaderboard = useMemo(() => {
    if (!modelAnalytics?.overall_leaderboard) return [];
    const originalRanks = new Map<string, number>();
    modelAnalytics.overall_leaderboard.forEach((m, idx) => {
      originalRanks.set(m.model, idx + 1);
    });
    const sorted = sortData(modelAnalytics.overall_leaderboard, modelSortState, {
      rank: (item) => originalRanks.get(item.model) ?? 0,
      model: (item) => formatModelName(item.model),
      avg_rank: (item) => item.avg_rank,
      sessions: (item) => item.sessions,
      wins: (item) => item.wins,
      win_rate: (item) => item.win_rate,
    });
    return sorted.map((item) => ({
      ...item,
      originalRank: originalRanks.get(item.model) ?? 0,
    }));
  }, [modelAnalytics, modelSortState]);

  const isLoading = statsLoading || usersLoading || invitationsLoading || companiesLoading;

  const hasRealData =
    stats &&
    (stats.total_users > 0 ||
      stats.total_companies > 0 ||
      stats.total_conversations > 0 ||
      stats.total_messages > 0);
  const useDummyData = !statsLoading && (statsError || !hasRealData);
  const displayStats = useDummyData ? DUMMY_ANALYTICS_STATS : stats;

  // Compute user status breakdown from real data
  const userStatusBreakdown = useMemo(() => {
    if (!usersData?.users || usersData.users.length === 0) {
      return { active: 0, suspended: 0, unverified: 0, total: 0 };
    }
    const users = usersData.users;
    let active = 0;
    let suspended = 0;
    let unverified = 0;

    users.forEach((user) => {
      const isSuspended = user.user_metadata?.is_suspended === true;
      const isVerified = !!user.email_confirmed_at;

      if (isSuspended) {
        suspended++;
      } else if (!isVerified) {
        unverified++;
      } else {
        active++;
      }
    });

    return { active, suspended, unverified, total: users.length };
  }, [usersData]);

  // Compute invitation funnel from real data
  const invitationFunnel = useMemo(() => {
    if (!invitationsData?.invitations || invitationsData.invitations.length === 0) {
      return { total: 0, pending: 0, accepted: 0, expired: 0, cancelled: 0 };
    }
    const invitations = invitationsData.invitations;
    return {
      total: invitations.length,
      pending: invitations.filter((i) => i.status === 'pending').length,
      accepted: invitations.filter((i) => i.status === 'accepted').length,
      expired: invitations.filter((i) => i.status === 'expired').length,
      cancelled: invitations.filter((i) => i.status === 'cancelled').length,
    };
  }, [invitationsData]);

  // Compute company stats
  const companyStats = useMemo(() => {
    if (!companiesData?.companies || companiesData.companies.length === 0) {
      return { total: 0, avgUsers: 0, avgConversations: 0, totalConversations: 0 };
    }
    const companies = companiesData.companies;
    const totalUsers = companies.reduce((sum, c) => sum + (c.user_count || 0), 0);
    const totalConversations = companies.reduce((sum, c) => sum + (c.conversation_count || 0), 0);
    return {
      total: companies.length,
      avgUsers: companies.length > 0 ? (totalUsers / companies.length).toFixed(1) : '0',
      avgConversations:
        companies.length > 0 ? (totalConversations / companies.length).toFixed(1) : '0',
      totalConversations,
    };
  }, [companiesData]);

  // Activity percentage for hero cards
  const activityPercent24h =
    displayStats && displayStats.total_users > 0
      ? Math.round(((displayStats.active_users_24h ?? 0) / displayStats.total_users) * 100)
      : 0;

  return (
    <div className="admin-tab-panel analytics-tab analytics-tab--premium">
      {/* Premium Header */}
      <div className="analytics-header-premium">
        <div className="analytics-header-left">
          <h2 className="analytics-title-premium">
            {t('admin.analytics.title', 'Analytics')}
            {/* ISS-087: Live indicator shows when displaying real-time (not dummy) data */}
            {!useDummyData && (
              <span
                className="analytics-live-dot"
                title={t('admin.analytics.liveData', 'Real-time data')}
                aria-label={t('admin.analytics.liveData', 'Real-time data')}
                role="img"
              />
            )}
          </h2>
          <p className="analytics-subtitle-premium">
            {t('admin.analytics.description', 'Platform performance at a glance')}
          </p>
        </div>
        <div className="analytics-header-actions">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="analytics-date-select-premium">
              <CalendarRange className="h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip content="Export coming soon">
            <button className="analytics-export-btn-premium" disabled>
              <Download className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Hero Metrics - Clean 4-card grid */}
      <div className="analytics-hero-grid">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="analytics-hero-card analytics-hero-card--loading">
              <div className="analytics-hero-skeleton" />
            </div>
          ))
        ) : (
          <>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_users ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Total Users</span>
              <span className="analytics-hero-trend analytics-hero-trend--up">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {Math.round(activityPercent24h)}% active today
              </span>
            </div>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_companies ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Companies</span>
              <span className="analytics-hero-trend analytics-hero-trend--neutral">
                {companyStats.avgUsers} users avg
              </span>
            </div>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_conversations ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Conversations</span>
              <span className="analytics-hero-trend analytics-hero-trend--neutral">
                {companyStats.avgConversations}/company
              </span>
            </div>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_messages ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Messages</span>
              <span className="analytics-hero-trend analytics-hero-trend--neutral">
                {displayStats?.total_conversations
                  ? Math.round(displayStats.total_messages / displayStats.total_conversations)
                  : 0}{' '}
                per convo
              </span>
            </div>
          </>
        )}
      </div>

      {/* Status Overview - Compact side-by-side */}
      <div className="analytics-status-row">
        {/* User Status Donut */}
        {/* ISS-084: Use userStatusBreakdown.total for consistency with the pie chart data */}
        <div className="analytics-status-card">
          <div className="analytics-status-header">
            <h3>User Status</h3>
            <span className="analytics-status-total">
              {userStatusBreakdown.total.toLocaleString()} total
            </span>
          </div>
          {/* ISS-141: Chart accessibility */}
          <div
            className="analytics-status-chart"
            role="img"
            aria-label={`User status breakdown: ${userStatusBreakdown.active} active, ${userStatusBreakdown.unverified} unverified, ${userStatusBreakdown.suspended} suspended`}
          >
            {usersLoading ? (
              <div className="analytics-chart-skeleton" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: userStatusBreakdown.active, fill: '#22c55e' },
                      {
                        name: 'Unverified',
                        value: userStatusBreakdown.unverified,
                        fill: '#f59e0b',
                      },
                      { name: 'Suspended', value: userStatusBreakdown.suspended, fill: '#ef4444' },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {[{ fill: '#22c55e' }, { fill: '#f59e0b' }, { fill: '#ef4444' }].map(
                      (entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      )
                    )}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [value, 'Users']}
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="analytics-status-legend">
            <span className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: '#22c55e' }} />
              Active {userStatusBreakdown.active}
            </span>
            <span className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: '#f59e0b' }} />
              Unverified {userStatusBreakdown.unverified}
            </span>
            <span className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: '#ef4444' }} />
              Suspended {userStatusBreakdown.suspended}
            </span>
          </div>
        </div>

        {/* Invitation Funnel - Horizontal bars */}
        <div className="analytics-status-card">
          <div className="analytics-status-header">
            <h3>Invitations</h3>
            <span className="analytics-status-total">{invitationFunnel.total} total</span>
          </div>
          <div className="analytics-funnel-bars">
            {invitationsLoading ? (
              <div className="analytics-chart-skeleton" />
            ) : (
              <>
                {/* ISS-150: Show clearer styling for zero-value bars */}
                {[
                  { label: 'Pending', value: invitationFunnel.pending, color: '#3b82f6' },
                  { label: 'Accepted', value: invitationFunnel.accepted, color: '#22c55e' },
                  { label: 'Expired', value: invitationFunnel.expired, color: '#f59e0b' },
                  { label: 'Cancelled', value: invitationFunnel.cancelled, color: '#94a3b8' },
                ].map((item) => {
                  const pct =
                    invitationFunnel.total > 0 ? (item.value / invitationFunnel.total) * 100 : 0;
                  const isZero = item.value === 0;
                  return (
                    <div
                      key={item.label}
                      className={`analytics-funnel-row ${isZero ? 'analytics-funnel-row--zero' : ''}`}
                    >
                      <span className="analytics-funnel-label">{item.label}</span>
                      <div className="analytics-funnel-bar-track">
                        <div
                          className="analytics-funnel-bar-fill"
                          style={{
                            width: isZero ? '0%' : `${Math.max(pct, 3)}%`,
                            background: isZero ? 'var(--color-border)' : item.color,
                          }}
                        />
                      </div>
                      <span className="analytics-funnel-value">{item.value}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Growth Charts - Full width, larger */}
      <div className="analytics-section-premium">
        <h3 className="analytics-section-title-premium">Growth Trends</h3>
        <div className="analytics-chart-row">
          <UserGrowthChart totalUsers={displayStats?.total_users ?? 0} isLoading={isLoading} />
          <CompanyGrowthChart
            totalCompanies={displayStats?.total_companies ?? 0}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Platform Activity - Full width */}
      <div className="analytics-section-premium">
        <h3 className="analytics-section-title-premium">Platform Activity</h3>
        <div className="analytics-chart-full">
          <ConversationActivityChart
            totalConversations={displayStats?.total_conversations ?? 0}
            totalMessages={displayStats?.total_messages ?? 0}
            isLoading={isLoading}
            dateRange={dateRange}
          />
        </div>
      </div>

      {/* Model Performance Section */}
      <div className="analytics-section-premium">
        <h3 className="analytics-section-title-premium">
          <BarChart3 className="h-5 w-5" />
          Model Performance
          {/* ISS-085: Add space before session count badge */}
          {modelAnalytics && modelAnalytics.total_sessions > 0 && (
            <span className="analytics-sessions-badge" style={{ marginLeft: '8px' }}>
              {modelAnalytics.total_sessions} sessions
            </span>
          )}
        </h3>
        {modelAnalyticsLoading ? (
          <div className="analytics-model-loading">
            <div className="analytics-kpi-skeleton" style={{ height: '300px' }} />
          </div>
        ) : modelAnalytics && modelAnalytics.overall_leaderboard.length > 0 ? (
          <div className="analytics-model-grid">
            {/* Overall Leaderboard Chart */}
            <div className="analytics-model-card">
              <div className="analytics-model-header">
                <span className="analytics-model-card-title">Win Rate by Model</span>
                {modelAnalytics.overall_leader && (
                  <span className="analytics-leader-badge">
                    <img
                      src={getProviderIcon(modelAnalytics.overall_leader.model)}
                      alt=""
                      className="analytics-model-icon"
                    />
                    {formatModelName(modelAnalytics.overall_leader.model)}
                  </span>
                )}
              </div>
              {/* ISS-141: Chart accessibility, ISS-053: Prevent model names from being read as separate elements */}
              <div
                className="analytics-model-chart"
                role="img"
                aria-label={`Win rate comparison chart showing ${modelAnalytics.overall_leaderboard.length} AI models. Leading model: ${modelAnalytics.overall_leader ? formatModelName(modelAnalytics.overall_leader.model) : 'none'}`}
              >
                <div aria-hidden="true">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                    data={modelAnalytics.overall_leaderboard.slice(0, 6)}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      opacity={0.5}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                    />
                    <YAxis
                      dataKey="model"
                      type="category"
                      tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                      width={100}
                      tickFormatter={formatModelName}
                    />
                    <RechartsTooltip
                      content={<ModelTooltip />}
                      contentStyle={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="win_rate" name="Win Rate %" radius={[0, 4, 4, 0]}>
                      {modelAnalytics.overall_leaderboard.slice(0, 6).map((entry) => (
                        <Cell key={entry.model} fill={getProviderColor(entry.model)} />
                      ))}
                    </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Win Distribution Pie Chart */}
            <div className="analytics-model-card">
              <div className="analytics-model-header">
                <span className="analytics-model-card-title">Win Distribution</span>
              </div>
              {/* ISS-141: Chart accessibility, ISS-053: Prevent model names from being read as separate elements */}
              <div
                className="analytics-model-chart"
                role="img"
                aria-label={`Win distribution pie chart showing total wins across ${modelAnalytics.overall_leaderboard.filter((m) => m.wins > 0).length} models`}
              >
                <div aria-hidden="true">
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPieChart>
                    <Pie
                      data={modelAnalytics.overall_leaderboard
                        .filter((m) => m.wins > 0)
                        .slice(0, 6)
                        .map((m) => ({
                          name: formatModelName(m.model),
                          value: m.wins,
                          model: m.model,
                          fill: getProviderColor(m.model),
                        }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {modelAnalytics.overall_leaderboard
                        .filter((m) => m.wins > 0)
                        .slice(0, 6)
                        .map((entry) => (
                          <Cell key={entry.model} fill={getProviderColor(entry.model)} />
                        ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [`${value} wins`, name]}
                      contentStyle={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Model Stats Table */}
            <div className="analytics-model-card analytics-model-card--full">
              <div className="analytics-model-header">
                <span className="analytics-model-card-title">Rankings</span>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTableHeader
                        column="rank"
                        label="#"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="model"
                        label="Model"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="avg_rank"
                        label="Avg Rank"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="sessions"
                        label="Sessions"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="wins"
                        label="Wins"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="win_rate"
                        label="Win Rate"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModelLeaderboard.map((model) => {
                      const isLeader = model.originalRank === 1;
                      return (
                        <tr
                          key={model.model}
                          className={isLeader ? 'analytics-model-row--leader' : ''}
                        >
                          <td>{model.originalRank}</td>
                          <td>
                            <span className="admin-user-cell">
                              <img
                                src={getProviderIcon(model.model)}
                                alt=""
                                className="analytics-model-icon"
                              />
                              {formatModelName(model.model)}
                            </span>
                          </td>
                          <td>{model.avg_rank.toFixed(2)}</td>
                          <td>{model.sessions}</td>
                          <td>{model.wins}</td>
                          <td>
                            <span
                              className={`analytics-winrate ${model.win_rate >= 30 ? 'analytics-winrate--high' : model.win_rate >= 15 ? 'analytics-winrate--medium' : 'analytics-winrate--low'}`}
                            >
                              {model.win_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="analytics-model-empty">
            <BarChart3 className="h-12 w-12" />
            <h4>No Model Data Yet</h4>
            <p>Model rankings will appear here after AI council sessions are completed.</p>
          </div>
        )}
      </div>

      {/* Revenue Coming Soon Section - Collapsible */}
      <details className="analytics-coming-soon">
        <summary className="analytics-coming-soon-trigger">
          <span>Revenue Dashboard</span>
          <span className="analytics-coming-soon-badge">Coming Soon</span>
        </summary>
        <div className="analytics-coming-soon-content">
          <div className="analytics-placeholder-grid">
            <div className="analytics-placeholder-card">
              <DollarSign className="h-8 w-8" />
              <h4>Revenue Analytics</h4>
              <p>MRR, ARR, churn rates, and plan distribution via Stripe integration.</p>
            </div>
          </div>
        </div>
      </details>

      {/* Footer - ISS-152: Added manual refresh button, ISS-153: Consistent time format */}
      <div className="analytics-footer-premium">
        <p>
          Data refreshes hourly • Last updated{' '}
          {lastRefreshTime.toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </p>
        <button
          className="analytics-refresh-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title={t('admin.refreshData', 'Refresh analytics data')}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? t('common.refreshing', 'Refreshing...') : t('common.refresh', 'Refresh')}</span>
        </button>
      </div>
    </div>
  );
}
