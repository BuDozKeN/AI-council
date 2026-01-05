import { useTranslation } from 'react-i18next';
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
 */
export function MyCompanyTabs({ activeTab, onTabChange }: MyCompanyTabsProps) {
  const { t } = useTranslation();

  return (
    <nav className="mc-tabs">
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
  );
}

export { TABS };
