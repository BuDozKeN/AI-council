import { useTranslation } from 'react-i18next';
import { Plus, MessageSquare, Building2, Settings, Trophy } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import './NavigationSheet.css';

interface NavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenLeaderboard: () => void;
  onOpenMyCompany: () => void;
  onOpenSettings: () => void;
}

/**
 * NavigationSheet - Bottom sheet with main navigation options
 * Triggered by swipe-up gesture from bottom edge on mobile
 */
export function NavigationSheet({
  isOpen,
  onClose,
  onNewChat,
  onOpenHistory,
  onOpenLeaderboard,
  onOpenMyCompany,
  onOpenSettings,
}: NavigationSheetProps) {
  const { t } = useTranslation();

  const handleNavAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('navigation.title', 'Navigation')}>
      <div className="navigation-sheet-content">
        <button
          type="button"
          className="navigation-sheet-item"
          onClick={() => handleNavAction(onNewChat)}
        >
          <Plus className="navigation-sheet-icon" size={24} />
          <span className="navigation-sheet-label">{t('chat.newChat')}</span>
        </button>

        <button
          type="button"
          className="navigation-sheet-item"
          onClick={() => handleNavAction(onOpenHistory)}
        >
          <MessageSquare className="navigation-sheet-icon" size={24} />
          <span className="navigation-sheet-label">{t('sidebar.history')}</span>
        </button>

        <button
          type="button"
          className="navigation-sheet-item"
          onClick={() => handleNavAction(onOpenLeaderboard)}
        >
          <Trophy className="navigation-sheet-icon" size={24} />
          <span className="navigation-sheet-label">{t('sidebar.leaderboard')}</span>
        </button>

        <button
          type="button"
          className="navigation-sheet-item"
          onClick={() => handleNavAction(onOpenMyCompany)}
        >
          <Building2 className="navigation-sheet-icon" size={24} />
          <span className="navigation-sheet-label">{t('sidebar.myCompany')}</span>
        </button>

        <button
          type="button"
          className="navigation-sheet-item"
          onClick={() => handleNavAction(onOpenSettings)}
        >
          <Settings className="navigation-sheet-icon" size={24} />
          <span className="navigation-sheet-label">{t('sidebar.settings')}</span>
        </button>
      </div>
    </BottomSheet>
  );
}
