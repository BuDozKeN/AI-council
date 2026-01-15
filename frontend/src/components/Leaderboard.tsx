import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api } from '../api';
import { AdaptiveModal } from './ui/AdaptiveModal';
import { Button } from './ui/button';
import { Skeleton } from './ui/Skeleton';
import { logger } from '../utils/logger';
import './Leaderboard.css';

interface LeaderboardEntry {
  model: string;
  avg_rank: number;
  wins: number;
  win_rate: number;
  sessions: number;
}

interface DepartmentData {
  leaderboard: LeaderboardEntry[];
}

interface LeaderboardData {
  overall?: {
    leaderboard: LeaderboardEntry[];
    total_sessions: number;
  };
  departments?: Record<string, DepartmentData>;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const { t } = useTranslation();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('overall');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getLeaderboardSummary();
      setLeaderboardData(data);
    } catch (err) {
      setError(t('leaderboard.loadError'));
      logger.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLeaderboard = () => {
    if (!leaderboardData) return [];
    if (selectedDepartment === 'overall') {
      return leaderboardData.overall?.leaderboard || [];
    }
    return leaderboardData.departments?.[selectedDepartment]?.leaderboard || [];
  };

  const getAvailableDepartments = (): string[] => {
    if (!leaderboardData) return [];
    // Filter out any department names that look like UUIDs (failed to resolve)
    const isUuidLike = (str: string): boolean =>
      /^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$/.test(str);
    return Object.keys(leaderboardData.departments ?? {}).filter((dept) => !isUuidLike(dept));
  };

  const currentLeaderboard = getCurrentLeaderboard();
  const departments = getAvailableDepartments();
  const totalSessions = leaderboardData?.overall?.total_sessions || 0;

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('leaderboard.title')}
      size="lg"
      headerClassName="app-modal-header-gradient"
      bodyMinHeight="520px"
      showCloseButton={true}
    >
      {isLoading ? (
        <div className="leaderboard-skeleton">
          {/* Skeleton tabs */}
          <div className="leaderboard-tabs">
            <Skeleton width={70} height={32} className="skeleton-badge" />
            <Skeleton width={85} height={32} className="skeleton-badge" />
            <Skeleton width={80} height={32} className="skeleton-badge" />
          </div>

          {/* Skeleton stats */}
          <div className="leaderboard-stats">
            <Skeleton width={140} height={16} />
          </div>

          {/* Skeleton table */}
          <div className="leaderboard-table">
            <table>
              <thead>
                <tr>
                  <th className="rank-col">
                    <Skeleton width={20} height={14} />
                  </th>
                  <th className="model-col">
                    <Skeleton width={50} height={14} />
                  </th>
                  <th className="score-col">
                    <Skeleton width={60} height={14} />
                  </th>
                  <th className="wins-col">
                    <Skeleton width={35} height={14} />
                  </th>
                  <th className="rate-col">
                    <Skeleton width={55} height={14} />
                  </th>
                  <th className="sessions-col">
                    <Skeleton width={55} height={14} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="rank-col">
                      <Skeleton width={24} height={20} />
                    </td>
                    <td className="model-col">
                      <Skeleton width={120} height={18} />
                    </td>
                    <td className="score-col">
                      <Skeleton width={40} height={18} />
                    </td>
                    <td className="wins-col">
                      <Skeleton width={28} height={18} />
                    </td>
                    <td className="rate-col">
                      <Skeleton width={45} height={18} />
                    </td>
                    <td className="sessions-col">
                      <Skeleton width={28} height={18} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Skeleton legend */}
          <div className="leaderboard-legend">
            <Skeleton width={280} height={14} />
            <Skeleton width={200} height={14} className="mt-1" />
          </div>
        </div>
      ) : error ? (
        <div className="leaderboard-error">{error}</div>
      ) : totalSessions === 0 ? (
        <div className="leaderboard-empty">
          <p>{t('leaderboard.noData')}</p>
          <p className="hint">{t('leaderboard.noDataHint')}</p>
        </div>
      ) : (
        <>
          <div className="leaderboard-tabs">
            <Button
              variant={selectedDepartment === 'overall' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedDepartment('overall')}
            >
              {t('leaderboard.overall')}
            </Button>
            {departments.map((dept) => (
              <Button
                key={dept}
                variant={selectedDepartment === dept ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedDepartment(dept)}
              >
                {dept.charAt(0).toUpperCase() + dept.slice(1)}
              </Button>
            ))}
          </div>

          <div className="leaderboard-stats">
            <span className="stat-item">
              {t('leaderboard.totalSessions')}: <strong>{totalSessions}</strong>
            </span>
          </div>

          <div className="leaderboard-table">
            {currentLeaderboard.length === 0 ? (
              <div className="mc-empty" style={{ padding: '60px 24px' }}>
                <motion.svg
                  width="120"
                  height="120"
                  viewBox="0 0 120 120"
                  fill="none"
                  className="mc-empty-icon-svg"
                  style={{ marginBottom: '16px' }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <defs>
                    <linearGradient id="leaderboardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-indigo-500)" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="var(--color-purple-500)" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>

                  {/* Podium - 3 levels */}
                  {/* 2nd place (left) */}
                  <rect
                    x="20"
                    y="55"
                    width="25"
                    height="30"
                    rx="2"
                    fill="url(#leaderboardGradient)"
                    opacity="0.3"
                  />
                  <rect
                    x="20"
                    y="55"
                    width="25"
                    height="30"
                    rx="2"
                    fill="var(--color-bg-card)"
                    stroke="var(--color-border)"
                    strokeWidth="1.5"
                  />
                  <text
                    x="32.5"
                    y="73"
                    textAnchor="middle"
                    fill="var(--color-text-secondary)"
                    fontSize="16"
                    fontWeight="600"
                  >
                    2
                  </text>

                  {/* 1st place (center, tallest) */}
                  <rect
                    x="47.5"
                    y="40"
                    width="25"
                    height="45"
                    rx="2"
                    fill="url(#leaderboardGradient)"
                    opacity="0.5"
                  />
                  <rect
                    x="47.5"
                    y="40"
                    width="25"
                    height="45"
                    rx="2"
                    fill="var(--color-bg-card)"
                    stroke="var(--color-border)"
                    strokeWidth="1.5"
                  />
                  <text
                    x="60"
                    y="65"
                    textAnchor="middle"
                    fill="var(--color-text-secondary)"
                    fontSize="16"
                    fontWeight="600"
                  >
                    1
                  </text>
                  {/* Crown on first place */}
                  <path
                    d="M 55 32 L 57 28 L 60 30 L 63 28 L 65 32 L 60 35 Z"
                    fill="var(--color-indigo-500)"
                    opacity="0.6"
                  />

                  {/* 3rd place (right) */}
                  <rect
                    x="75"
                    y="65"
                    width="25"
                    height="20"
                    rx="2"
                    fill="url(#leaderboardGradient)"
                    opacity="0.2"
                  />
                  <rect
                    x="75"
                    y="65"
                    width="25"
                    height="20"
                    rx="2"
                    fill="var(--color-bg-card)"
                    stroke="var(--color-border)"
                    strokeWidth="1.5"
                  />
                  <text
                    x="87.5"
                    y="78"
                    textAnchor="middle"
                    fill="var(--color-text-secondary)"
                    fontSize="16"
                    fontWeight="600"
                  >
                    3
                  </text>

                  {/* Base line */}
                  <line
                    x1="15"
                    y1="85"
                    x2="105"
                    y2="85"
                    stroke="var(--color-border)"
                    strokeWidth="2"
                  />

                  {/* Decorative stars */}
                  <path
                    d="M 30 25 L 32 27 L 34 25 L 32 23 Z"
                    fill="var(--color-indigo-400)"
                    opacity="0.4"
                  />
                  <path
                    d="M 90 30 L 92 32 L 94 30 L 92 28 Z"
                    fill="var(--color-purple-400)"
                    opacity="0.4"
                  />
                  <circle cx="25" cy="40" r="2" fill="var(--color-indigo-300)" opacity="0.3" />
                  <circle cx="95" cy="50" r="2" fill="var(--color-purple-300)" opacity="0.3" />
                </motion.svg>

                <p
                  className="mc-empty-title"
                  style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                  }}
                >
                  {t('leaderboard.noDeptData')}
                </p>
                <p
                  className="mc-empty-hint"
                  style={{
                    color: 'var(--color-text-tertiary)',
                    margin: '6px 0 0',
                    fontSize: '0.875rem',
                  }}
                >
                  Rankings appear after council sessions are completed
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="rank-col">#</th>
                    <th className="model-col">{t('leaderboard.model')}</th>
                    <th className="score-col">{t('leaderboard.avgRank')}</th>
                    <th className="wins-col">{t('leaderboard.wins')}</th>
                    <th className="rate-col">{t('leaderboard.winRate')}</th>
                    <th className="sessions-col">{t('leaderboard.sessionsCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLeaderboard.map((entry: LeaderboardEntry, index: number) => (
                    <tr key={entry.model} className={index === 0 ? 'leader' : ''}>
                      <td className="rank-col">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="model-col">{entry.model.split('/')[1] || entry.model}</td>
                      <td className="score-col">{entry.avg_rank.toFixed(2)}</td>
                      <td className="wins-col">{entry.wins}</td>
                      <td className="rate-col">{entry.win_rate}%</td>
                      <td className="sessions-col">{entry.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="leaderboard-legend">
            <p>
              <strong>{t('leaderboard.avgRank')}:</strong> {t('leaderboard.avgRankHint')}
            </p>
            <p>
              <strong>{t('leaderboard.wins')}:</strong> {t('leaderboard.winsHint')}
            </p>
          </div>
        </>
      )}
    </AdaptiveModal>
  );
}
