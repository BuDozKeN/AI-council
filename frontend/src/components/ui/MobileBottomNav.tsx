import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, MessageSquare, Building2, Settings } from 'lucide-react';
import { motion, PanInfo, AnimatePresence } from 'framer-motion';
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

const SPRING_TRANSITION = { type: 'spring' as const, damping: 30, stiffness: 300 };
const INSTANT_TRANSITION = { duration: 0 };

/**
 * MobileBottomNav - Hidden drag-up tray for thumb-friendly navigation
 *
 * Collapsed by default — only a drag handle pill is visible.
 * Swipe up to reveal nav options. Swipe down or tap an item to collapse.
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
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isExpanded) {
        // Dragging up from collapsed — expand if dragged up enough or fast enough
        const shouldExpand = info.offset.y < -40 || info.velocity.y < -400;
        if (shouldExpand) {
          onToggle();
        }
      } else {
        // Dragging down from expanded — collapse if dragged down enough or fast enough
        const shouldCollapse = info.offset.y > 80 || info.velocity.y > 400;
        if (shouldCollapse) {
          onToggle();
        }
      }
    },
    [isExpanded, onToggle]
  );

  const handleNavAction = useCallback(
    (action: () => void) => {
      action();
      if (isExpanded) {
        onToggle();
      }
    },
    [isExpanded, onToggle]
  );

  const transition = reducedMotion ? INSTANT_TRANSITION : SPRING_TRANSITION;

  return (
    <>
      {/* Drag handle — always visible on mobile */}
      <motion.div
        className="mobile-nav-handle-wrapper"
        drag="y"
        dragConstraints={{ top: -10, bottom: 10 }}
        dragElastic={{ top: 0.3, bottom: 0.3 }}
        onDragEnd={handleDragEnd}
        onClick={() => !isExpanded && onToggle()}
        role="button"
        tabIndex={0}
        aria-label={
          isExpanded
            ? t('mobileNav.collapseNav', 'Collapse navigation')
            : t('mobileNav.expandNav', 'Expand navigation')
        }
        aria-expanded={isExpanded}
      >
        <div className="mobile-nav-handle" />
      </motion.div>

      {/* Nav tray — slides up from below */}
      <AnimatePresence>
        {isExpanded && (
          <motion.nav
            className="mobile-bottom-nav"
            aria-label={t('aria.mainNavigation')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={transition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
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
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(MobileBottomNav);
