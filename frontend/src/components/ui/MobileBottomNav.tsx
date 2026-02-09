import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MessageSquare, Building2, Settings, Trophy } from 'lucide-react';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenLeaderboard: () => void;
  onOpenMyCompany: () => void;
  onOpenSettings: () => void;
  activeTab?: 'chat' | 'history' | 'leaderboard' | 'company' | 'settings';
}

/**
 * MobileBottomNav - iOS-style bottom navigation for thumb-friendly access
 *
 * Provides quick access to main app sections on mobile:
 * - New Chat: Start a new council conversation
 * - History: Open sidebar with conversation history
 * - Leaderboard: View AI model rankings
 * - My Company: Open company management
 * - Settings: Open settings modal
 */
function MobileBottomNav({
  onNewChat,
  onOpenHistory,
  onOpenLeaderboard,
  onOpenMyCompany,
  onOpenSettings,
  activeTab = 'chat',
}: MobileBottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav className="mobile-bottom-nav" aria-label={t('aria.mainNavigation')}>
      <button
        className={`mobile-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={onNewChat}
        aria-label={t('chat.newChat')}
        aria-current={activeTab === 'chat' ? 'page' : undefined}
      >
        <Plus className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">{t('mobileNav.new')}</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={onOpenHistory}
        aria-label={t('sidebar.history')}
        aria-current={activeTab === 'history' ? 'page' : undefined}
      >
        <MessageSquare className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">{t('mobileNav.history')}</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
        onClick={onOpenLeaderboard}
        aria-label={t('sidebar.leaderboard')}
        aria-current={activeTab === 'leaderboard' ? 'page' : undefined}
      >
        <Trophy className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">{t('mobileNav.leaderboard')}</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'company' ? 'active' : ''}`}
        onClick={onOpenMyCompany}
        aria-label={t('sidebar.myCompany')}
        aria-current={activeTab === 'company' ? 'page' : undefined}
      >
        <Building2 className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">{t('mobileNav.company')}</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={onOpenSettings}
        aria-label={t('sidebar.settings')}
        aria-current={activeTab === 'settings' ? 'page' : undefined}
      >
        <Settings className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">{t('mobileNav.settings')}</span>
      </button>
    </nav>
  );
}

export default memo(MobileBottomNav);
