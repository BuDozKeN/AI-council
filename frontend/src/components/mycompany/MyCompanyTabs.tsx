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

// Tab configuration
const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    Icon: BarChart3,
    tooltip: 'Company summary: see your stats, description, and company context at a glance',
  },
  {
    id: 'team',
    label: 'Team',
    Icon: Users,
    tooltip: 'Your departments and roles: manage the structure of your organization',
  },
  {
    id: 'projects',
    label: 'Projects',
    Icon: FolderKanban,
    tooltip: 'Organize your work: group related council sessions and track progress',
  },
  {
    id: 'playbooks',
    label: 'Playbooks',
    Icon: BookOpen,
    tooltip: 'Your knowledge library: SOPs, frameworks, and policies the AI council uses',
  },
  {
    id: 'decisions',
    label: 'Decisions',
    Icon: Lightbulb,
    tooltip: 'Saved council outputs: review, archive, or promote decisions to playbooks',
  },
  {
    id: 'activity',
    label: 'Activity',
    Icon: ClipboardList,
    tooltip: 'Recent changes: see what happened across your company',
  },
  {
    id: 'usage',
    label: 'Usage',
    Icon: Gauge,
    tooltip: 'LLM usage analytics: monitor costs, tokens, and council activity',
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
          title={tab.tooltip}
        >
          <tab.Icon size={16} className="mc-tab-icon" />
          <span className="mc-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export { TABS };
