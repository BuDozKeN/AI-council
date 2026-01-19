import { useTranslation } from 'react-i18next';
import { useRef, useEffect, useCallback, useState } from 'react';
import {
  BarChart3,
  Users,
  FolderKanban,
  BookOpen,
  Lightbulb,
  ClipboardList,
  Gauge,
} from 'lucide-react';
import { hapticLight } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../types/i18n';

// Tab configuration - labels and tooltips are translation keys
interface TabConfig {
  id: string;
  labelKey: TranslationKey;
  Icon: LucideIcon;
  tooltipKey: TranslationKey;
}

const TABS: TabConfig[] = [
  {
    id: 'overview',
    labelKey: 'company.overview',
    Icon: BarChart3,
    tooltipKey: 'mycompany.tabs.overviewTooltip',
  },
  {
    id: 'team',
    labelKey: 'company.team',
    Icon: Users,
    tooltipKey: 'mycompany.tabs.teamTooltip',
  },
  {
    id: 'projects',
    labelKey: 'company.projects',
    Icon: FolderKanban,
    tooltipKey: 'mycompany.tabs.projectsTooltip',
  },
  {
    id: 'playbooks',
    labelKey: 'company.playbooks',
    Icon: BookOpen,
    tooltipKey: 'mycompany.tabs.playbooksTooltip',
  },
  {
    id: 'decisions',
    labelKey: 'company.decisions',
    Icon: Lightbulb,
    tooltipKey: 'mycompany.tabs.decisionsTooltip',
  },
  {
    id: 'activity',
    labelKey: 'company.activity',
    Icon: ClipboardList,
    tooltipKey: 'mycompany.tabs.activityTooltip',
  },
  {
    id: 'usage',
    labelKey: 'company.usage',
    Icon: Gauge,
    tooltipKey: 'mycompany.tabs.usageTooltip',
  },
];

interface MyCompanyTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

/**
 * MyCompanyTabs - Tab navigation bar
 * Includes scroll indicator that fades when scrolled to end
 */
export function MyCompanyTabs({ activeTab, onTabChange }: MyCompanyTabsProps) {
  const { t } = useTranslation();
  const tabsRef = useRef<HTMLElement>(null);
  const [isScrolledEnd, setIsScrolledEnd] = useState(false);

  // Check if scrolled to end (within 10px tolerance)
  const checkScrollEnd = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;

    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    setIsScrolledEnd(isAtEnd);
  }, []);

  // Add scroll listener and check on mount/resize
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    // Initial check
    checkScrollEnd();

    // Listen for scroll
    el.addEventListener('scroll', checkScrollEnd, { passive: true });

    // Check on resize (viewport changes)
    window.addEventListener('resize', checkScrollEnd);

    return () => {
      el.removeEventListener('scroll', checkScrollEnd);
      window.removeEventListener('resize', checkScrollEnd);
    };
  }, [checkScrollEnd]);

  return (
    <div className="mc-tabs-wrapper">
      <nav
        ref={tabsRef}
        className={cn('mc-tabs', isScrolledEnd && 'scrolled-end')}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`mc-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              hapticLight();
              onTabChange(tab.id);
            }}
            title={t(tab.tooltipKey)}
          >
            <tab.Icon size={16} className="mc-tab-icon" />
            <span className="mc-tab-label">{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>
      {/* Scroll fade indicator - shows when more tabs are hidden */}
      <div
        className={cn('mc-tabs-fade', isScrolledEnd && 'hidden')}
        aria-hidden="true"
      />
    </div>
  );
}

export { TABS };
