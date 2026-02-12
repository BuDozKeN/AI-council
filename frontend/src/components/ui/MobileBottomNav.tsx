import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, PanInfo } from 'framer-motion';
import { Plus, MessageSquare, Building2, Settings } from 'lucide-react';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  onNewChat: () => void;
  onOpenHistory: () => void;
  /** @deprecated Leaderboard removed from mobile nav (UXH-001) */
  onOpenLeaderboard?: () => void;
  onOpenMyCompany: () => void;
  onOpenSettings: () => void;
  activeTab?: 'chat' | 'history' | 'company' | 'settings';
  isExpanded: boolean;
  onToggle: () => void;
}

// Check prefers-reduced-motion at module level for SSR safety
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const springTransition = { type: 'spring' as const, damping: 30, stiffness: 300 };
const instantTransition = { duration: 0 };

/**
 * MobileBottomNav - Hidden drag-up tray for thumb-friendly navigation
 *
 * Nav starts offscreen (translateY(100%)). A small drag handle pill sits
 * at the bottom of the screen. Swiping up reveals the nav as a temporary
 * overlay. Swiping down or tapping a nav item hides it.
 */
function MobileBottomNav({
  onNewChat,
  onOpenHistory,
  onOpenMyCompany,
  onOpenSettings,
  activeTab = 'chat',
  isExpanded,
  onToggle,
}: MobileBottomNavProps) {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement | null>(null);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // Collapse if dragged down enough or with enough velocity
      if (isExpanded && (info.offset.y > 80 || info.velocity.y > 400)) {
        onToggle();
      }
      // Expand if dragged up enough (from collapsed state via handle)
      if (!isExpanded && (info.offset.y < -40 || info.velocity.y < -300)) {
        onToggle();
      }
    },
    [isExpanded, onToggle]
  );

  // Nav action + auto-collapse
  const handleNavAction = useCallback(
    (action: () => void) => {
      action();
      if (isExpanded) {
        onToggle();
      }
    },
    [isExpanded, onToggle]
  );

  const transition = prefersReducedMotion ? instantTransition : springTransition;

  return (
    <>
      {/* Drag handle - always visible at bottom of screen */}
      <div
        className="mobile-nav-handle-wrapper"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isExpanded ? t('mobileNav.hideNavigation', 'Hide navigation') : t('mobileNav.showNavigation', 'Show navigation')}
        aria-expanded={isExpanded}
      >
        <div className="mobile-nav-handle" />
      </div>

      {/* Nav tray - slides up/down */}
      <motion.nav
        ref={navRef}
        className="mobile-bottom-nav"
        aria-label={t('aria.mainNavigation')}
        animate={{ y: isExpanded ? 0 : '100%' }}
        transition={transition}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        dragDirectionLock
      >
        <button
          className={`mobile-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => handleNavAction(onNewChat)}
          aria-label={t('chat.newChat')}
          aria-current={activeTab === 'chat' ? 'page' : undefined}
        >
          <Plus className="mobile-nav-icon" size={24} />
          <span className="mobile-nav-label">{t('mobileNav.new')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleNavAction(onOpenHistory)}
          aria-label={t('sidebar.history')}
          aria-current={activeTab === 'history' ? 'page' : undefined}
        >
          <MessageSquare className="mobile-nav-icon" size={24} />
          <span className="mobile-nav-label">{t('mobileNav.history')}</span>
        </button>

        {/* UXH-001: Leaderboard removed from mobile nav - not relevant for mobile users */}

        <button
          className={`mobile-nav-item ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => handleNavAction(onOpenMyCompany)}
          aria-label={t('sidebar.myCompany')}
          aria-current={activeTab === 'company' ? 'page' : undefined}
        >
          <Building2 className="mobile-nav-icon" size={24} />
          <span className="mobile-nav-label">{t('mobileNav.company')}</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavAction(onOpenSettings)}
          aria-label={t('sidebar.settings')}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
        >
          <Settings className="mobile-nav-icon" size={24} />
          <span className="mobile-nav-label">{t('mobileNav.settings')}</span>
        </button>
      </motion.nav>
    </>
  );
}

export default memo(MobileBottomNav);
