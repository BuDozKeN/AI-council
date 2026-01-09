/**
 * CommandPalette - Cmd+K quick actions menu
 *
 * Premium feature: Quick access to all app actions via keyboard shortcut.
 * Inspired by Linear, Notion, Vercel command palettes.
 *
 * Features:
 * - Fuzzy search across all actions
 * - Grouped by category (Navigation, Create, Search, Settings)
 * - Keyboard navigation (arrow keys, enter)
 * - Recent actions shown first
 * - Contextual actions based on current view
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Command } from 'cmdk';
import { createPortal } from 'react-dom';
import type { Conversation } from '../../types/conversation';
import type { Department, Project, Playbook } from '../../types/business';
import './CommandPalette.css';

// SSR-safe mount detection (same pattern as ThemeToggle)
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

// Icons as simple SVG components for bundle efficiency
const Icons = {
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Building: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  Trophy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  MessageSquare: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Moon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  ),
  Sun: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  Folder: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  ),
  FileText: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  BookOpen: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Zap: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
    </svg>
  ),
  Brain: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  Star: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2" />
    </svg>
  ),
  Archive: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
};

export interface CommandPaletteProps {
  // State
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;

  // Navigation actions
  onOpenSettings: () => void;
  onOpenMyCompany: () => void;
  onOpenLeaderboard: () => void;
  onOpenLLMHub: () => void;

  // Conversation actions
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  conversations: Conversation[];
  currentConversationId: string | null;

  // Project actions
  projects: Project[];
  onSelectProject: (id: string | null) => void;
  selectedProject: string | null;

  // Department actions
  departments: Department[];

  // Playbook actions
  playbooks: Playbook[];

  // Theme
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;

  // Optional: search knowledge base
  onSearchKnowledge?: (query: string) => void;
}

type ActionCategory = 'navigation' | 'create' | 'conversations' | 'projects' | 'settings' | 'theme';

interface CommandAction {
  id: string;
  label: string;
  description?: string | undefined;
  icon: React.ReactNode;
  category: ActionCategory;
  keywords?: string[];
  onSelect: () => void;
  shortcut?: string;
}

export function CommandPalette({
  isOpen,
  onOpenChange,
  onOpenSettings,
  onOpenMyCompany,
  onOpenLeaderboard,
  onOpenLLMHub,
  onNewConversation,
  onSelectConversation,
  conversations,
  currentConversationId,
  projects,
  onSelectProject,
  selectedProject,
  departments,
  playbooks,
  theme,
  onThemeChange,
}: CommandPaletteProps) {
  const mounted = useIsMounted();

  // Build actions list
  const actions = useMemo<CommandAction[]>(() => {
    const list: CommandAction[] = [];

    // === NAVIGATION ===
    list.push({
      id: 'nav-settings',
      label: 'Open Settings',
      description: 'Profile, billing, team, API keys',
      icon: <Icons.Settings />,
      category: 'navigation',
      keywords: ['preferences', 'account', 'profile'],
      onSelect: () => { onOpenSettings(); onOpenChange(false); },
      shortcut: '⌘,',
    });

    list.push({
      id: 'nav-mycompany',
      label: 'Open My Company',
      description: 'Departments, roles, playbooks, decisions',
      icon: <Icons.Building />,
      category: 'navigation',
      keywords: ['company', 'organization', 'business', 'knowledge'],
      onSelect: () => { onOpenMyCompany(); onOpenChange(false); },
    });

    list.push({
      id: 'nav-leaderboard',
      label: 'Open Leaderboard',
      description: 'Model performance rankings',
      icon: <Icons.Trophy />,
      category: 'navigation',
      keywords: ['rankings', 'models', 'performance', 'stats'],
      onSelect: () => { onOpenLeaderboard(); onOpenChange(false); },
    });

    list.push({
      id: 'nav-llmhub',
      label: 'Open LLM Hub',
      description: 'Configure AI models and presets',
      icon: <Icons.Brain />,
      category: 'navigation',
      keywords: ['ai', 'models', 'config', 'gpt', 'claude', 'gemini'],
      onSelect: () => { onOpenLLMHub(); onOpenChange(false); },
    });

    // === CREATE ===
    list.push({
      id: 'create-conversation',
      label: 'New Council Session',
      description: 'Start a new AI council deliberation',
      icon: <Icons.Plus />,
      category: 'create',
      keywords: ['new', 'chat', 'conversation', 'ask', 'question'],
      onSelect: () => { onNewConversation(); onOpenChange(false); },
      shortcut: '⌘N',
    });

    // === CONVERSATIONS (Recent 5) ===
    const recentConversations = conversations
      .filter(c => !c.isTemp && c.id !== currentConversationId)
      .slice(0, 5);

    recentConversations.forEach(conv => {
      list.push({
        id: `conv-${conv.id}`,
        label: conv.title || 'Untitled Conversation',
        description: conv.created_at ? new Date(conv.created_at).toLocaleDateString() : undefined,
        icon: <Icons.MessageSquare />,
        category: 'conversations',
        keywords: ['chat', 'history', 'conversation'],
        onSelect: () => { onSelectConversation(conv.id); onOpenChange(false); },
      });
    });

    // === PROJECTS ===
    projects.slice(0, 5).forEach(project => {
      list.push({
        id: `project-${project.id}`,
        label: `Switch to: ${project.name}`,
        description: project.description || 'Project',
        icon: <Icons.Folder />,
        category: 'projects',
        keywords: ['project', 'initiative', 'switch'],
        onSelect: () => { onSelectProject(project.id); onOpenChange(false); },
      });
    });

    if (selectedProject) {
      list.push({
        id: 'project-clear',
        label: 'Clear Project Selection',
        description: 'Remove project context from conversations',
        icon: <Icons.Folder />,
        category: 'projects',
        keywords: ['clear', 'remove', 'project'],
        onSelect: () => { onSelectProject(null); onOpenChange(false); },
      });
    }

    // === THEME ===
    list.push({
      id: 'theme-light',
      label: 'Switch to Light Mode',
      icon: <Icons.Sun />,
      category: 'theme',
      keywords: ['theme', 'light', 'bright', 'day'],
      onSelect: () => { onThemeChange('light'); onOpenChange(false); },
    });

    list.push({
      id: 'theme-dark',
      label: 'Switch to Dark Mode',
      icon: <Icons.Moon />,
      category: 'theme',
      keywords: ['theme', 'dark', 'night'],
      onSelect: () => { onThemeChange('dark'); onOpenChange(false); },
    });

    list.push({
      id: 'theme-system',
      label: 'Use System Theme',
      description: 'Match your OS preference',
      icon: theme === 'dark' ? <Icons.Moon /> : <Icons.Sun />,
      category: 'theme',
      keywords: ['theme', 'system', 'auto', 'os'],
      onSelect: () => { onThemeChange('system'); onOpenChange(false); },
    });

    return list;
  }, [
    onOpenSettings,
    onOpenMyCompany,
    onOpenLeaderboard,
    onOpenLLMHub,
    onNewConversation,
    onSelectConversation,
    conversations,
    currentConversationId,
    projects,
    onSelectProject,
    selectedProject,
    departments,
    playbooks,
    theme,
    onThemeChange,
    onOpenChange,
  ]);

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<ActionCategory, CommandAction[]> = {
      navigation: [],
      create: [],
      conversations: [],
      projects: [],
      settings: [],
      theme: [],
    };

    actions.forEach(action => {
      groups[action.category].push(action);
    });

    return groups;
  }, [actions]);

  const categoryLabels: Record<ActionCategory, string> = {
    navigation: 'Navigation',
    create: 'Create',
    conversations: 'Recent Conversations',
    projects: 'Projects',
    settings: 'Settings',
    theme: 'Theme',
  };

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange]);

  if (!mounted || !isOpen) return null;

  const content = (
    <div className="command-palette-overlay" onClick={() => onOpenChange(false)}>
      <div className="command-palette-container" onClick={e => e.stopPropagation()}>
        <Command
          className="command-palette"
          shouldFilter={true}
          loop={true}
        >
          <div className="command-palette-header">
            <Icons.Search />
            <Command.Input
              className="command-palette-input"
              placeholder="Type a command or search..."
              autoFocus
            />
            <kbd className="command-palette-kbd">ESC</kbd>
          </div>

          <Command.List className="command-palette-list">
            <Command.Empty className="command-palette-empty">
              No results found.
            </Command.Empty>

            {/* Render groups that have items */}
            {(Object.keys(groupedActions) as ActionCategory[]).map(category => {
              const items = groupedActions[category];
              if (items.length === 0) return null;

              return (
                <Command.Group
                  key={category}
                  heading={categoryLabels[category]}
                  className="command-palette-group"
                >
                  {items.map(action => (
                    <Command.Item
                      key={action.id}
                      value={`${action.label} ${action.keywords?.join(' ') || ''}`}
                      onSelect={action.onSelect}
                      className="command-palette-item"
                    >
                      <span className="command-palette-item-icon">
                        {action.icon}
                      </span>
                      <div className="command-palette-item-content">
                        <span className="command-palette-item-label">
                          {action.label}
                        </span>
                        {action.description && (
                          <span className="command-palette-item-description">
                            {action.description}
                          </span>
                        )}
                      </div>
                      {action.shortcut && (
                        <kbd className="command-palette-item-shortcut">
                          {action.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          <div className="command-palette-footer">
            <span className="command-palette-footer-hint">
              <kbd>↑</kbd> <kbd>↓</kbd> to navigate
            </span>
            <span className="command-palette-footer-hint">
              <kbd>↵</kbd> to select
            </span>
            <span className="command-palette-footer-hint">
              <kbd>esc</kbd> to close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default CommandPalette;
