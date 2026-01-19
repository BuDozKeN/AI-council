import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../AuthContext';
import { AdaptiveModal } from '../ui/AdaptiveModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Skeleton } from '../ui/Skeleton';
import { User, CreditCard, Users, Key, FlaskConical, Cpu } from 'lucide-react';
import { ProfileSection } from './ProfileSection';
import { BillingSection } from './BillingSection';
import { TeamSection } from './TeamSection';
import { ApiKeysSection } from './ApiKeysSection';
import { DeveloperSection } from './DeveloperSection';
import type { TeamRole } from './hooks/useTeam';
import './SettingsLayout.css';

// Lazy-load LLMHubTab (owner-only, rarely accessed)
const LLMHubTab = lazy(() =>
  import('../mycompany/tabs/LLMHubTab').then((m) => ({ default: m.LLMHubTab }))
);

type ConfirmModalVariant = 'danger' | 'warning' | 'info';

interface ConfirmModalState {
  title: string;
  message: string;
  variant: ConfirmModalVariant;
  confirmText: string;
  onConfirm: () => Promise<void>;
}

type SettingsTab = 'profile' | 'billing' | 'team' | 'api' | 'developer' | 'ai-config';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  onMockModeChange?: (enabled: boolean) => void;
  /** Initial tab to show when opening */
  initialTab?: SettingsTab;
}

export default function Settings({
  isOpen,
  onClose,
  companyId,
  onMockModeChange,
  initialTab = 'profile',
}: SettingsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Sync to initialTab when modal opens
  // This is an intentional sync of external prop to local state - valid pattern
  useEffect(() => {
    // Only sync when modal transitions from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional sync of prop to state on open
      setActiveTab(initialTab);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialTab]);

  // Handler for team member removal with confirmation
  const handleRemoveMemberConfirm = (
    memberId: string,
    memberRole: TeamRole,
    handleRemoveMember: (memberId: string) => Promise<void>
  ) => {
    setConfirmModal({
      title: t('settings.removeTeamMember'),
      message: t('settings.removeTeamMemberConfirm', { role: memberRole }),
      variant: 'danger',
      confirmText: t('settings.remove'),
      onConfirm: async () => {
        await handleRemoveMember(memberId);
      },
    });
  };

  // Handler for API key deletion with confirmation
  const handleDeleteApiKeyConfirm = (handleDeleteApiKey: () => Promise<void>) => {
    setConfirmModal({
      title: t('settings.removeApiKey'),
      message: t('settings.removeApiKeyConfirm'),
      variant: 'danger',
      confirmText: t('settings.remove'),
      onConfirm: async () => {
        await handleDeleteApiKey();
      },
    });
  };

  return (
    <>
      <AdaptiveModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('settings.title')}
        size="xl"
        contentClassName="settings-modal-body"
      >
        {/* Content */}
        <div className="settings-content">
          {/* Sidebar tabs */}
          <div className="settings-sidebar" role="tablist" aria-label={t('settings.title')}>
            <button
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              aria-label={t('settings.profile')}
              aria-selected={activeTab === 'profile'}
              role="tab"
            >
              <User size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.profile')}</span>
            </button>
            <button
              className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
              aria-label={t('settings.billing')}
              aria-selected={activeTab === 'billing'}
              role="tab"
            >
              <CreditCard size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.billing')}</span>
            </button>
            {companyId && (
              <button
                className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
                aria-label={t('settings.team')}
                aria-selected={activeTab === 'team'}
                role="tab"
              >
                <Users size={18} className="tab-icon" aria-hidden="true" />
                <span className="tab-label">{t('settings.team')}</span>
              </button>
            )}
            <button
              className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
              aria-label={t('settings.apiKeys')}
              aria-selected={activeTab === 'api'}
              role="tab"
            >
              <Key size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.apiKeys')}</span>
            </button>
            <button
              className={`settings-tab ${activeTab === 'developer' ? 'active' : ''}`}
              onClick={() => setActiveTab('developer')}
              aria-label={t('settings.developer')}
              aria-selected={activeTab === 'developer'}
              role="tab"
            >
              <FlaskConical size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.developer')}</span>
            </button>
            <button
              className={`settings-tab ${activeTab === 'ai-config' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai-config')}
              aria-label={t('settings.llmHub', 'LLM Hub')}
              aria-selected={activeTab === 'ai-config'}
              role="tab"
            >
              <Cpu size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.llmHub', 'LLM Hub')}</span>
            </button>
          </div>

          {/* Tab content */}
          <div className="settings-panel">
            {activeTab === 'profile' && (
              <div className="profile-content">
                <ProfileSection user={user} isOpen={isOpen} />
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="billing-content">
                <BillingSection isOpen={isOpen} />
              </div>
            )}

            {activeTab === 'team' && companyId && (
              <div className="team-content">
                <TeamSection
                  user={user}
                  isOpen={isOpen}
                  companyId={companyId}
                  onRemoveMember={handleRemoveMemberConfirm}
                />
              </div>
            )}

            {activeTab === 'api' && (
              <div className="api-content">
                <ApiKeysSection isOpen={isOpen} onDeleteApiKey={handleDeleteApiKeyConfirm} />
              </div>
            )}

            {activeTab === 'developer' && (
              <div className="developer-content">
                <DeveloperSection
                  isOpen={isOpen}
                  {...(onMockModeChange ? { onMockModeChange } : {})}
                />
              </div>
            )}

            {activeTab === 'ai-config' && (
              <div className="ai-config-content">
                <Suspense
                  fallback={
                    <div className="settings-skeleton">
                      <Skeleton width="100%" height={120} className="rounded-xl" />
                      <Skeleton width="100%" height={200} className="rounded-xl mt-4" />
                    </div>
                  }
                >
                  <LLMHubTab companyId={companyId || ''} />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </AdaptiveModal>

      {/* Confirmation Modal */}
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
    </>
  );
}
