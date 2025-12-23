import { useState, useEffect } from 'react';
import { api } from '../api';
import { AdaptiveModal } from './ui/AdaptiveModal';
import { Skeleton } from './ui/Skeleton';
import { logger } from '../utils/logger';
import './Leaderboard.css';

export default function Leaderboard({ isOpen, onClose }) {
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('overall');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setError('Failed to load leaderboard');
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

  const getAvailableDepartments = () => {
    if (!leaderboardData) return [];
    // Filter out any department names that look like UUIDs (failed to resolve)
    const isUuidLike = (str) => /^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$/.test(str);
    return Object.keys(leaderboardData.departments || {}).filter(dept => !isUuidLike(dept));
  };

  const currentLeaderboard = getCurrentLeaderboard();
  const departments = getAvailableDepartments();
  const totalSessions = leaderboardData?.overall?.total_sessions || 0;

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Model Leaderboard"
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
                  <th className="rank-col"><Skeleton width={20} height={14} /></th>
                  <th className="model-col"><Skeleton width={50} height={14} /></th>
                  <th className="score-col"><Skeleton width={60} height={14} /></th>
                  <th className="wins-col"><Skeleton width={35} height={14} /></th>
                  <th className="rate-col"><Skeleton width={55} height={14} /></th>
                  <th className="sessions-col"><Skeleton width={55} height={14} /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="rank-col"><Skeleton width={24} height={20} /></td>
                    <td className="model-col"><Skeleton width={120} height={18} /></td>
                    <td className="score-col"><Skeleton width={40} height={18} /></td>
                    <td className="wins-col"><Skeleton width={28} height={18} /></td>
                    <td className="rate-col"><Skeleton width={45} height={18} /></td>
                    <td className="sessions-col"><Skeleton width={28} height={18} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Skeleton legend */}
          <div className="leaderboard-legend">
            <Skeleton width={280} height={14} />
            <Skeleton width={200} height={14} style={{ marginTop: 4 }} />
          </div>
        </div>
      ) : error ? (
        <div className="leaderboard-error">{error}</div>
      ) : totalSessions === 0 ? (
        <div className="leaderboard-empty">
          <p>No ranking data yet.</p>
          <p className="hint">Rankings are recorded after each council session completes.</p>
        </div>
      ) : (
        <>
          <div className="leaderboard-tabs">
            <button
              className={`tab-btn ${selectedDepartment === 'overall' ? 'active' : ''}`}
              onClick={() => setSelectedDepartment('overall')}
            >
              Overall
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                className={`tab-btn ${selectedDepartment === dept ? 'active' : ''}`}
                onClick={() => setSelectedDepartment(dept)}
              >
                {dept.charAt(0).toUpperCase() + dept.slice(1)}
              </button>
            ))}
          </div>

          <div className="leaderboard-stats">
            <span className="stat-item">
              Total Sessions: <strong>{totalSessions}</strong>
            </span>
          </div>

          <div className="leaderboard-table">
            {currentLeaderboard.length === 0 ? (
              <div className="no-data">No data for this department yet</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="rank-col">#</th>
                    <th className="model-col">Model</th>
                    <th className="score-col">Avg Rank</th>
                    <th className="wins-col">Wins</th>
                    <th className="rate-col">Win Rate</th>
                    <th className="sessions-col">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLeaderboard.map((entry, index) => (
                    <tr key={entry.model} className={index === 0 ? 'leader' : ''}>
                      <td className="rank-col">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="model-col">
                        {entry.model.split('/')[1] || entry.model}
                      </td>
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
            <p><strong>Avg Rank:</strong> Lower is better (1 = always ranked first)</p>
            <p><strong>Wins:</strong> Number of times ranked #1</p>
          </div>
        </>
      )}
    </AdaptiveModal>
  );
}