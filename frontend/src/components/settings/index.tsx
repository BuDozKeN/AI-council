import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AdaptiveModal } from '../ui/AdaptiveModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Skeleton } from '../ui/Skeleton';
import { User, CreditCard, Users, Key, FlaskConical, Cpu, Shield, LogOut } from 'lucide-react';
import { ProfileSection } from './ProfileSection';
import { BillingSection } from './BillingSection';
import { TeamSection } from './TeamSection';
import { ApiKeysSection } from './ApiKeysSection';
import { DeveloperSection } from './DeveloperSection';
import type { TeamRole } from './hooks/useTeam';
import './SettingsLayout.css';
import './SettingsCards.css';
import './SettingsResponsive.css';

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
  /** Callback for sign out - ISS-185: Makes sign out accessible from Settings on mobile */
  onSignOut?: () => void;
  /** Callback for opening Admin Portal - ISS-183: Makes Admin Portal accessible on mobile */
  onOpenAdmin?: () => void;
  /** Whether user is admin - used to show Admin Portal button */
  isAdmin?: boolean;
}

export default function Settings({
  isOpen,
  onClose,
  companyId,
  onMockModeChange,
  initialTab = 'profile',
  onSignOut,
  onOpenAdmin,
  isAdmin = false,
}: SettingsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const prevIsOpenRef = useRef(isOpen);

  // Set page title for accessibility (ISSUE-040)
  usePageTitle(isOpen ? 'Settings' : 'AxCouncil');

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
              id="profile-tab"
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              aria-label={t('settings.profile')}
              aria-selected={activeTab === 'profile'}
              role="tab"
              aria-controls="profile-panel"
            >
              <User size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.profile')}</span>
            </button>
            <button
              id="billing-tab"
              className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
              aria-label={t('settings.billing')}
              aria-selected={activeTab === 'billing'}
              role="tab"
              aria-controls="billing-panel"
            >
              <CreditCard size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.billing')}</span>
            </button>
            {companyId && (
              <button
                id="team-tab"
                className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
                aria-label={t('settings.team')}
                aria-selected={activeTab === 'team'}
                role="tab"
                aria-controls="team-panel"
              >
                <Users size={18} className="tab-icon" aria-hidden="true" />
                <span className="tab-label">{t('settings.team')}</span>
              </button>
            )}
            <button
              id="api-tab"
              className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
              aria-label={t('settings.apiKeys')}
              aria-selected={activeTab === 'api'}
              role="tab"
              aria-controls="api-panel"
            >
              <Key size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.apiKeys')}</span>
            </button>
            <button
              id="developer-tab"
              className={`settings-tab ${activeTab === 'developer' ? 'active' : ''}`}
              onClick={() => setActiveTab('developer')}
              aria-label={t('settings.developer')}
              aria-selected={activeTab === 'developer'}
              role="tab"
              aria-controls="developer-panel"
            >
              <FlaskConical size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.developer')}</span>
            </button>
            <button
              id="ai-config-tab"
              className={`settings-tab ${activeTab === 'ai-config' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai-config')}
              aria-label={t('settings.llmHub', 'LLM Hub')}
              aria-selected={activeTab === 'ai-config'}
              role="tab"
              aria-controls="ai-config-panel"
            >
              <Cpu size={18} className="tab-icon" aria-hidden="true" />
              <span className="tab-label">{t('settings.llmHub', 'LLM Hub')}</span>
            </button>

            {/* ISS-183/185: Action buttons for Admin Portal and Sign Out - accessible on mobile */}
            <div className="settings-sidebar-actions">
              {/* ISS-183: Admin Portal button for admin users */}
              {isAdmin && onOpenAdmin && (
                <button
                  className="settings-action-btn admin-btn"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  aria-label={t('sidebar.adminPortal', 'Admin Portal')}
                >
                  <Shield size={18} className="tab-icon" aria-hidden="true" />
                  <span className="tab-label">{t('sidebar.adminPortal', 'Admin Portal')}</span>
                </button>
              )}

              {/* ISS-185: Sign Out button accessible from Settings on mobile */}
              {onSignOut && (
                <button
                  className="settings-action-btn sign-out-btn"
                  onClick={onSignOut}
                  aria-label={t('sidebar.signOut', 'Sign out')}
                >
                  <LogOut size={18} className="tab-icon" aria-hidden="true" />
                  <span className="tab-label">{t('sidebar.signOut', 'Sign out')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab content */}
          <div className="settings-panel">
            {activeTab === 'profile' && (
              <div
                id="profile-panel"
                className="profile-content"
                role="tabpanel"
                aria-labelledby="profile-tab"
              >
                <ProfileSection user={user} isOpen={isOpen} />
              </div>
            )}

            {activeTab === 'billing' && (
              <div
                id="billing-panel"
                className="billing-content"
                role="tabpanel"
                aria-labelledby="billing-tab"
              >
                <BillingSection isOpen={isOpen} />
              </div>
            )}

            {activeTab === 'team' && companyId && (
              <div
                id="team-panel"
                className="team-content"
                role="tabpanel"
                aria-labelledby="team-tab"
              >
                <TeamSection
                  user={user}
                  isOpen={isOpen}
                  companyId={companyId}
                  onRemoveMember={handleRemoveMemberConfirm}
                />
              </div>
            )}

            {activeTab === 'api' && (
              <div id="api-panel" className="api-content" role="tabpanel" aria-labelledby="api-tab">
                <ApiKeysSection isOpen={isOpen} onDeleteApiKey={handleDeleteApiKeyConfirm} />
              </div>
            )}

            {activeTab === 'developer' && (
              <div
                id="developer-panel"
                className="developer-content"
                role="tabpanel"
                aria-labelledby="developer-tab"
              >
                <DeveloperSection
                  isOpen={isOpen}
                  {...(onMockModeChange ? { onMockModeChange } : {})}
                />
              </div>
            )}

            {activeTab === 'ai-config' && (
              <div
                id="ai-config-panel"
                className="ai-config-content"
                role="tabpanel"
                aria-labelledby="ai-config-tab"
              >
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
