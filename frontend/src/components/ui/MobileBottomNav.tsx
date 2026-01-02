import { memo } from 'react';
import { Plus, MessageSquare, Building2, Settings } from 'lucide-react';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenMyCompany: () => void;
  onOpenSettings: () => void;
  activeTab?: 'chat' | 'history' | 'company' | 'settings';
}

/**
 * MobileBottomNav - iOS-style bottom navigation for thumb-friendly access
 *
 * Provides quick access to main app sections on mobile:
 * - New Chat: Start a new council conversation
 * - History: Open sidebar with conversation history
 * - My Company: Open company management
 * - Settings: Open settings modal
 */
function MobileBottomNav({
  onNewChat,
  onOpenHistory,
  onOpenMyCompany,
  onOpenSettings,
  activeTab = 'chat',
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <button
        className={`mobile-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={onNewChat}
        aria-label="New chat"
        aria-current={activeTab === 'chat' ? 'page' : undefined}
      >
        <Plus className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">New</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={onOpenHistory}
        aria-label="Chat history"
        aria-current={activeTab === 'history' ? 'page' : undefined}
      >
        <MessageSquare className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">History</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'company' ? 'active' : ''}`}
        onClick={onOpenMyCompany}
        aria-label="My Company"
        aria-current={activeTab === 'company' ? 'page' : undefined}
      >
        <Building2 className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">Company</span>
      </button>

      <button
        className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={onOpenSettings}
        aria-label="Settings"
        aria-current={activeTab === 'settings' ? 'page' : undefined}
      >
        <Settings className="mobile-nav-icon" size={24} />
        <span className="mobile-nav-label">Settings</span>
      </button>
    </nav>
  );
}

export default memo(MobileBottomNav);
