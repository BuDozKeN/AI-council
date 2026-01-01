/**
 * DeveloperSection - Developer/Testing settings for internal use
 *
 * This section is hidden from regular users and only visible
 * when devMode is enabled in localStorage.
 *
 * Features:
 * - Mock mode toggle (uses simulated responses, no API costs)
 * - Prompt caching toggle
 * - Show token usage toggle (displays per-stage token counts)
 */

import { useState, useEffect } from 'react';
import { FlaskConical, Zap, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import { Skeleton } from '../ui/Skeleton';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { logger } from '../../utils/logger';
import { getShowTokenUsage, setShowTokenUsage } from './tokenUsageSettings';

const log = logger.scope('DeveloperSection');

interface DeveloperSectionProps {
  isOpen: boolean;
  onMockModeChange?: (enabled: boolean) => void;
}

export function DeveloperSection({ isOpen, onMockModeChange }: DeveloperSectionProps) {
  const { isAuthenticated } = useAuth();
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [cachingMode, setCachingMode] = useState<boolean | null>(null);
  const [showTokenUsage, setShowTokenUsageState] = useState<boolean>(getShowTokenUsage());
  const [isTogglingMock, setIsTogglingMock] = useState(false);
  const [isTogglingCaching, setIsTogglingCaching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch mock mode and caching mode status when section opens
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    const fetchStatus = async () => {
      setLoading(true);
      try {
        const [mockResult, cachingResult] = await Promise.all([
          api.getMockMode(),
          api.getCachingMode(),
        ]);
        setMockMode(mockResult.enabled);
        setCachingMode(cachingResult.enabled);
      } catch (err) {
        log.error('Failed to fetch developer settings:', err);
        setMockMode(false);
        setCachingMode(false);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [isOpen, isAuthenticated]);

  const handleToggleMock = async () => {
    if (isTogglingMock || mockMode === null) return;

    setIsTogglingMock(true);
    try {
      const result = await api.setMockMode(!mockMode);
      setMockMode(result.enabled);
      onMockModeChange?.(result.enabled);
    } catch (err) {
      log.error('Failed to toggle mock mode:', err);
    } finally {
      setIsTogglingMock(false);
    }
  };

  const handleToggleCaching = async () => {
    if (isTogglingCaching || cachingMode === null) return;

    setIsTogglingCaching(true);
    try {
      const result = await api.setCachingMode(!cachingMode);
      setCachingMode(result.enabled);
    } catch (err) {
      log.error('Failed to toggle caching mode:', err);
    } finally {
      setIsTogglingCaching(false);
    }
  };

  const handleToggleTokenUsage = () => {
    const newValue = !showTokenUsage;
    setShowTokenUsageState(newValue);
    setShowTokenUsage(newValue);
  };

  if (loading) {
    return (
      <Card className="settings-card">
        <CardHeader>
          <Skeleton width={180} height={20} />
          <Skeleton width={280} height={14} className="mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton height={60} className="mb-4" />
          <Skeleton height={60} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="developer-section">
      {/* Warning banner */}
      <div className="dev-warning-banner">
        <AlertTriangle size={16} />
        <span>Developer settings are for testing only. Changes affect your session.</span>
      </div>

      {/* Mock Mode Card */}
      <Card className="settings-card">
        <CardHeader>
          <h3>Mock Mode</h3>
          <p>Use simulated AI responses instead of real API calls</p>
        </CardHeader>
        <CardContent>
          <div className="dev-toggle-row">
            <div className="dev-toggle-info">
              <div className="dev-toggle-icon mock">
                <FlaskConical size={18} />
              </div>
              <div className="dev-toggle-text">
                <span className="dev-toggle-label">Enable Mock Mode</span>
                <span className="dev-toggle-desc">
                  {mockMode
                    ? 'Using simulated responses — no API costs'
                    : 'Using real API calls — credits will be consumed'}
                </span>
              </div>
            </div>
            <div className="dev-toggle-control">
              <span className={`dev-status-badge ${mockMode ? 'active' : 'inactive'}`}>
                {mockMode ? 'Mock' : 'Production'}
              </span>
              <Switch
                checked={mockMode ?? false}
                onCheckedChange={handleToggleMock}
                disabled={isTogglingMock}
              />
            </div>
          </div>

          {mockMode && (
            <div className="dev-info-box success">
              <CheckCircle size={14} />
              <span>Mock mode active. No tokens will be consumed during this session.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompt Caching Card */}
      <Card className="settings-card">
        <CardHeader>
          <h3>Prompt Caching</h3>
          <p>Cache prompts to reduce costs (Claude, GPT & DeepSeek)</p>
        </CardHeader>
        <CardContent>
          <div className="dev-toggle-row">
            <div className="dev-toggle-info">
              <div className="dev-toggle-icon caching">
                <Zap size={18} />
              </div>
              <div className="dev-toggle-text">
                <span className="dev-toggle-label">Enable Prompt Caching</span>
                <span className="dev-toggle-desc">
                  {cachingMode
                    ? 'Caching ON — reduces costs by caching context'
                    : 'Caching OFF — standard API calls'}
                </span>
              </div>
            </div>
            <div className="dev-toggle-control">
              <span className={`dev-status-badge ${cachingMode ? 'active' : 'inactive'}`}>
                {cachingMode ? 'Cache' : 'No Cache'}
              </span>
              <Switch
                checked={cachingMode ?? false}
                onCheckedChange={handleToggleCaching}
                disabled={isTogglingCaching}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Usage Display Card */}
      <Card className="settings-card">
        <CardHeader>
          <h3>Token Usage Display</h3>
          <p>Show detailed token counts per stage during council sessions</p>
        </CardHeader>
        <CardContent>
          <div className="dev-toggle-row">
            <div className="dev-toggle-info">
              <div className="dev-toggle-icon usage">
                <Activity size={18} />
              </div>
              <div className="dev-toggle-text">
                <span className="dev-toggle-label">Show Token Usage</span>
                <span className="dev-toggle-desc">
                  {showTokenUsage
                    ? 'Showing tokens, cost estimates, and cache hits per stage'
                    : 'Token usage hidden from UI'}
                </span>
              </div>
            </div>
            <div className="dev-toggle-control">
              <span className={`dev-status-badge ${showTokenUsage ? 'active' : 'inactive'}`}>
                {showTokenUsage ? 'Visible' : 'Hidden'}
              </span>
              <Switch
                checked={showTokenUsage}
                onCheckedChange={handleToggleTokenUsage}
              />
            </div>
          </div>

          {showTokenUsage && (
            <div className="dev-info-box info">
              <Activity size={14} />
              <span>Token usage will be displayed below each council stage.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
