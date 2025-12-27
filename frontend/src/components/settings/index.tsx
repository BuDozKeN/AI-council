import { useState } from 'react';
import { useAuth } from '../../AuthContext';
import { AdaptiveModal } from '../ui/AdaptiveModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { User, CreditCard, Users, Key, FlaskConical } from 'lucide-react';
import { ProfileSection } from './ProfileSection';
import { BillingSection } from './BillingSection';
import { TeamSection } from './TeamSection';
import { ApiKeysSection } from './ApiKeysSection';
import { DeveloperSection } from './DeveloperSection';
import type { TeamRole } from './hooks/useTeam';
import '../Settings.css';

type ConfirmModalVariant = 'danger' | 'warning' | 'info';

interface ConfirmModalState {
  title: string;
  message: string;
  variant: ConfirmModalVariant;
  confirmText: string;
  onConfirm: () => Promise<void>;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  onMockModeChange?: (enabled: boolean) => void;
}

export default function Settings({ isOpen, onClose, companyId, onMockModeChange }: SettingsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Handler for team member removal with confirmation
  const handleRemoveMemberConfirm = (
    memberId: string,
    memberRole: TeamRole,
    handleRemoveMember: (memberId: string) => Promise<void>
  ) => {
    setConfirmModal({
      title: 'Remove Team Member',
      message: `Remove this ${memberRole} from the team?`,
      variant: 'danger',
      confirmText: 'Remove',
      onConfirm: async () => {
        await handleRemoveMember(memberId);
      }
    });
  };

  // Handler for API key deletion with confirmation
  const handleDeleteApiKeyConfirm = (handleDeleteApiKey: () => Promise<void>) => {
    setConfirmModal({
      title: 'Remove API Key',
      message: 'Remove your OpenRouter API key? You will use the system key with usage limits.',
      variant: 'danger',
      confirmText: 'Remove',
      onConfirm: async () => {
        await handleDeleteApiKey();
      }
    });
  };

  return (
    <>
      <AdaptiveModal
        isOpen={isOpen}
        onClose={onClose}
        title="Settings"
        size="xl"
        contentClassName="settings-modal-body"
        showCloseButton={true}
      >
        {/* Content */}
        <div className="settings-content">
          {/* Sidebar tabs */}
          <div className="settings-sidebar">
            <button
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              data-tooltip="Profile"
            >
              <User size={18} className="tab-icon" />
              <span className="tab-label">Profile</span>
            </button>
            <button
              className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
              data-tooltip="Billing"
            >
              <CreditCard size={18} className="tab-icon" />
              <span className="tab-label">Billing</span>
            </button>
            {companyId && (
              <button
                className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
                data-tooltip="Team"
              >
                <Users size={18} className="tab-icon" />
                <span className="tab-label">Team</span>
              </button>
            )}
            <button
              className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
              data-tooltip="API Keys"
            >
              <Key size={18} className="tab-icon" />
              <span className="tab-label">API Keys</span>
            </button>
            <button
              className={`settings-tab ${activeTab === 'developer' ? 'active' : ''}`}
              onClick={() => setActiveTab('developer')}
              data-tooltip="Developer"
            >
              <FlaskConical size={18} className="tab-icon" />
              <span className="tab-label">Developer</span>
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
                <ApiKeysSection
                  isOpen={isOpen}
                  onDeleteApiKey={handleDeleteApiKeyConfirm}
                />
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
          </div>
        </div>
      </AdaptiveModal>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </>
  );
}
