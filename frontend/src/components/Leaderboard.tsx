import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
              <div className="no-data">{t('leaderboard.noDeptData')}</div>
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
