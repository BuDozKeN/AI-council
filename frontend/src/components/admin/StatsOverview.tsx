/**
 * StatsOverview - Dashboard stats cards shown on operational tabs
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Users, Building2, MessageSquare, BarChart3, AlertCircle } from 'lucide-react';
import { getIntlLocale } from '../../i18n';
import { api } from '../../api';
import { DUMMY_STATS } from './adminConstants';

export function StatsOverview() {
  const { t } = useTranslation();

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.getAdminStats(),
    staleTime: 60 * 1000, // 1 minute
  });

  if (isLoading) {
    return (
      <div className="admin-stats-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="admin-stat-card admin-stat-card--loading">
            <div className="admin-stat-skeleton" />
          </div>
        ))}
      </div>
    );
  }

  // DUMMY DATA LOGIC - Use dummy stats if API fails or returns zeros
  const hasRealData =
    stats &&
    (stats.total_users > 0 ||
      stats.total_companies > 0 ||
      stats.total_conversations > 0 ||
      stats.total_messages > 0);
  const useDummyData = error || !hasRealData;
  const displayStats = useDummyData ? DUMMY_STATS : stats;

  const statCards = [
    {
      label: t('admin.stats.totalUsers', 'Total Users'),
      value: displayStats?.total_users ?? 0,
      icon: Users,
      color: 'blue',
    },
    {
      label: t('admin.stats.totalCompanies', 'Total Companies'),
      value: displayStats?.total_companies ?? 0,
      icon: Building2,
      color: 'green',
    },
    {
      label: t('admin.stats.totalConversations', 'Conversations'),
      value: displayStats?.total_conversations ?? 0,
      icon: MessageSquare,
      color: 'purple',
    },
    {
      label: t('admin.stats.totalMessages', 'Messages'),
      value: displayStats?.total_messages ?? 0,
      icon: BarChart3,
      color: 'orange',
    },
  ];

  return (
    <div className="admin-stats-section">
      {/* DUMMY DATA INDICATOR - Show demo badge when using sample data */}
      {useDummyData && (
        <div className="admin-stats-demo-indicator">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{t('admin.stats.demoMode', 'Sample data')}</span>
        </div>
      )}
      <div className="admin-stats-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`admin-stat-card admin-stat-card--${stat.color} ${useDummyData ? 'admin-stat-card--demo' : ''}`}
            >
              <div className="admin-stat-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div className="admin-stat-content">
                <span className="admin-stat-value">
                  {stat.value.toLocaleString(getIntlLocale())}
                  {useDummyData && (
                    <span className="admin-demo-badge-inline">{t('admin.demo', 'DEMO')}</span>
                  )}
                </span>
                <span className="admin-stat-label">{stat.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
