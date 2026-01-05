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
import { useTranslation } from 'react-i18next';
import { FlaskConical, Zap, AlertTriangle, CheckCircle, Activity, Ruler } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import { Skeleton } from '../ui/Skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { logger } from '../../utils/logger';
import { getShowTokenUsage, setShowTokenUsage } from './tokenUsageSettings';

// Mock length options with human-readable labels
const MOCK_LENGTH_OPTIONS = [
  { value: 'null', label: 'Use LLM Hub Settings', description: 'Respects your production config' },
  { value: '512', label: 'Short (~1 paragraph)', description: '512 tokens' },
  { value: '1536', label: 'Medium (~1 page)', description: '1536 tokens' },
  { value: '4096', label: 'Long (~2-3 pages)', description: '4096 tokens' },
  { value: '8192', label: 'Very Long (~4+ pages)', description: '8192 tokens' },
] as const;

const log = logger.scope('DeveloperSection');

interface DeveloperSectionProps {
  isOpen: boolean;
  onMockModeChange?: (enabled: boolean) => void;
}

export function DeveloperSection({ isOpen, onMockModeChange }: DeveloperSectionProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [mockLengthOverride, setMockLengthOverride] = useState<number | null>(null);
  const [cachingMode, setCachingMode] = useState<boolean | null>(null);
  const [showTokenUsage, setShowTokenUsageState] = useState<boolean>(getShowTokenUsage());
  const [isTogglingMock, setIsTogglingMock] = useState(false);
  const [isTogglingCaching, setIsTogglingCaching] = useState(false);
  const [isChangingLength, setIsChangingLength] = useState(false);
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
        setMockLengthOverride(mockResult.length_override ?? null);
        setCachingMode(cachingResult.enabled);
      } catch (err) {
        log.error('Failed to fetch developer settings:', err);
        setMockMode(false);
        setMockLengthOverride(null);
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

  const handleChangeMockLength = async (value: string) => {
    if (isChangingLength) return;

    setIsChangingLength(true);
    try {
      const lengthOverride = value === 'null' ? null : parseInt(value, 10);
      const result = await api.setMockLengthOverride(lengthOverride);
      setMockLengthOverride(result.length_override);
    } catch (err) {
      log.error('Failed to change mock length override:', err);
    } finally {
      setIsChangingLength(false);
    }
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
        <span>{t('settings.devWarning')}</span>
      </div>

      {/* Mock Mode Card */}
      <Card className="settings-card">
        <CardHeader>
          <h3>{t('settings.mockMode')}</h3>
          <p>{t('settings.mockModeDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="dev-toggle-row">
            <div className="dev-toggle-info">
              <div className="dev-toggle-icon mock">
                <FlaskConical size={18} />
              </div>
              <div className="dev-toggle-text">
                <span className="dev-toggle-label">{t('settings.enableMockMode')}</span>
                <span className="dev-toggle-desc">
                  {mockMode ? t('settings.mockModeOn') : t('settings.mockModeOff')}
                </span>
              </div>
            </div>
            <div className="dev-toggle-control">
              <span className={`dev-status-badge ${mockMode ? 'active' : 'inactive'}`}>
                {mockMode ? t('settings.mock') : t('settings.production')}
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
              <span>{t('settings.mockModeActive')}</span>
            </div>
          )}

          {/* Mock Length Override - only shown when mock mode is enabled */}
          {mockMode && (
            <div className="dev-toggle-row bordered">
              <div className="dev-toggle-info">
                <div className="dev-toggle-icon mock">
                  <Ruler size={18} />
                </div>
                <div className="dev-toggle-text">
                  <span className="dev-toggle-label">
                    {t('settings.mockLengthOverride', 'Response Length Override')}
                  </span>
                  <span className="dev-toggle-desc">
                    {t(
                      'settings.mockLengthOverrideDesc',
                      'Test different lengths without changing LLM Hub'
                    )}
                  </span>
                </div>
              </div>
              <div className="dev-toggle-control">
                <Select
                  value={mockLengthOverride === null ? 'null' : String(mockLengthOverride)}
                  onValueChange={handleChangeMockLength}
                  disabled={isChangingLength}
                >
                  <SelectTrigger className="min-w-[180px]">
                    <SelectValue placeholder="Select length" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_LENGTH_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {mockMode && mockLengthOverride !== null && (
            <div className="dev-info-box info">
              <Ruler size={14} />
              <span>
                {t(
                  'settings.mockLengthOverrideActive',
                  'Override active: Mock will use {{tokens}} tokens regardless of LLM Hub settings',
                  { tokens: mockLengthOverride }
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompt Caching Card */}
      <Card className="settings-card">
        <CardHeader>
          <h3>{t('settings.promptCaching')}</h3>
          <p>{t('settings.promptCachingDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="dev-toggle-row">
            <div className="dev-toggle-info">
              <div className="dev-toggle-icon caching">
                <Zap size={18} />
              </div>
              <div className="dev-toggle-text">
                <span className="dev-toggle-label">{t('settings.enableCaching')}</span>
                <span className="dev-toggle-desc">
                  {cachingMode ? t('settings.cachingOn') : t('settings.cachingOff')}
                </span>
              </div>
            </div>
            <div className="dev-toggle-control">
              <span className={`dev-status-badge ${cachingMode ? 'active' : 'inactive'}`}>
                {cachingMode ? t('settings.cache') : t('settings.noCache')}
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
          <h3>{t('settings.tokenUsageDisplay')}</h3>
          <p>{t('settings.tokenUsageDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="dev-toggle-row">
            <div className="dev-toggle-info">
              <div className="dev-toggle-icon usage">
                <Activity size={18} />
              </div>
              <div className="dev-toggle-text">
                <span className="dev-toggle-label">{t('settings.showTokenUsage')}</span>
                <span className="dev-toggle-desc">
                  {showTokenUsage ? t('settings.tokenUsageOn') : t('settings.tokenUsageOff')}
                </span>
              </div>
            </div>
            <div className="dev-toggle-control">
              <span className={`dev-status-badge ${showTokenUsage ? 'active' : 'inactive'}`}>
                {showTokenUsage ? t('settings.visible') : t('settings.hidden')}
              </span>
              <Switch checked={showTokenUsage} onCheckedChange={handleToggleTokenUsage} />
            </div>
          </div>

          {showTokenUsage && (
            <div className="dev-info-box info">
              <Activity size={14} />
              <span>{t('settings.tokenUsageInfo')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
