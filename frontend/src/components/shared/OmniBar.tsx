/**
 * OmniBar - Unified input component for landing hero and in-app chat
 *
 * Provides a consistent, premium input experience across the app.
 * Used in both the landing page hero and the chat interface.
 *
 * Structure (two-row layout like ChatInput):
 * ┌──────────────────────────────────────────────────────┐
 * │ [Textarea input with placeholder...]           ⌘K   │
 * ├──────────────────────────────────────────────────────┤
 * │ [🏢 👤 📋 ⚡]                              [📎] [↑]  │
 * └──────────────────────────────────────────────────────┘
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Send,
  StopCircle,
  Image as ImageIcon,
  Building2,
  Briefcase,
  Users,
  BookOpen,
  FolderKanban,
  Check,
  FileText,
  ScrollText,
  Shield,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { springs, interactionStates } from '../../lib/animations';
import { BottomSheet } from '../ui/BottomSheet';
import { useCouncilStats } from '../../hooks/useCouncilStats';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import { ResponseStyleSelector } from '../chat/ResponseStyleSelector';
import type { Business, Department, Role, Playbook, Project } from '../../types/business';
import '../ui/Tooltip.css';
import s from './omnibar/OmniBar.module.css';

// Check if we're on mobile/tablet for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// =============================================================================
// Type Definitions
// =============================================================================

type ChatMode = 'council' | 'chat';
type OmniBarVariant = 'default' | 'landing' | 'compact';

interface OmniBarProps {
  // Core input state
  value?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string, mode: ChatMode) => void;

  // Loading/streaming state
  isLoading?: boolean;
  onStop?: () => void;

  // Mode configuration
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
  showModeToggle?: boolean;

  // Appearance variants
  variant?: OmniBarVariant;
  placeholder?: string;

  // Image upload support
  hasImages?: boolean | undefined;
  onImageClick?: (() => void) | undefined;
  showImageButton?: boolean | undefined;

  // Keyboard shortcuts
  showShortcutHint?: boolean;

  // Auto-focus
  autoFocus?: boolean;

  // Additional className
  className?: string;

  // Context icons (like ChatInput) - shown in bottom row
  showContextIcons?: boolean;
  // Company selection
  businesses?: Business[];
  selectedBusiness?: string | null;
  onSelectBusiness?: (id: string | null) => void;
  // Project selection
  projects?: Project[];
  selectedProject?: string | null;
  onSelectProject?: (id: string | null) => void;
  // Departments, roles, playbooks
  departments?: Department[];
  selectedDepartments?: string[];
  onSelectDepartments?: (ids: string[]) => void;
  roles?: Role[];
  selectedRoles?: string[];
  onSelectRoles?: (ids: string[]) => void;
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks?: (ids: string[]) => void;
  // Reset all selections
  onResetAll?: (() => void) | undefined;
  // Response style selector (LLM preset)
  selectedPreset?: import('../../types/business').LLMPresetId | null | undefined;
  departmentPreset?: import('../../types/business').LLMPresetId | undefined;
  onSelectPreset?:
    | ((preset: import('../../types/business').LLMPresetId | null) => void)
    | undefined;
  onOpenLLMHub?: (() => void) | undefined;
}

export function OmniBar({
  // Core input state
  value = '',
  onChange,
  onSubmit,

  // Loading/streaming state
  isLoading = false,
  onStop,

  // Mode configuration
  chatMode = 'council',
  onChatModeChange,
  showModeToggle = true,

  // Appearance variants
  variant = 'default',
  placeholder,

  // Image upload support
  hasImages = false,
  onImageClick,
  showImageButton = true,

  // Keyboard shortcuts
  showShortcutHint = true,

  // Auto-focus
  autoFocus = false,

  // Additional className
  className = '',

  // Context icons
  showContextIcons = false,
  businesses = [],
  selectedBusiness = null,
  onSelectBusiness,
  projects = [],
  selectedProject = null,
  onSelectProject,
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  roles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  onResetAll,
  // Response style selector
  selectedPreset = null,
  departmentPreset = 'balanced',
  onSelectPreset,
  onOpenLLMHub,
}: OmniBarProps) {
  const { t } = useTranslation();
  const { aiCount } = useCouncilStats(selectedBusiness);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mom-friendly tooltip descriptions - actionable, clear (translated)
  const TOOLTIPS = {
    // Mode tooltips
    councilMode: t('chat.tooltips.councilMode'),
    chatMode: t('chat.tooltips.chatMode'),
    // Action tooltips
    attach: t('omnibar.attach'),
    send: t('chat.tooltips.send'),
    stop: t('chat.tooltips.stop'),
    reset: t('chat.tooltips.reset'),
    // Context tooltips - explain what each category does for your mum
    context: t('omnibar.tooltips.context', 'Choose company context for better answers'),
    company: t('chat.tooltips.company'),
    projects: t('chat.tooltips.projects'),
    departments: t('chat.tooltips.departments'),
    roles: t('chat.tooltips.roles'),
    playbooks: t('chat.tooltips.playbooks'),
    // Empty state tooltips - when no items available
    noCompany: t('omnibar.tooltips.noCompany', 'No company set up yet'),
    noProjects: t('omnibar.tooltips.noProjects', 'No projects available'),
    noDepartments: t('omnibar.tooltips.noDepartments', 'No departments configured'),
    noRoles: t('omnibar.tooltips.noRoles', 'No roles configured'),
    noPlaybooks: t('omnibar.tooltips.noPlaybooks', 'No playbooks uploaded yet'),
  };

  // Playbook type config with icons and labels (translated)
  const playbookTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    framework: { label: t('context.frameworks'), icon: <ScrollText size={12} /> },
    sop: { label: t('context.sops'), icon: <FileText size={12} /> },
    policy: { label: t('context.policies'), icon: <Shield size={12} /> },
    other: { label: t('context.other'), icon: <BookOpen size={12} /> },
  };

  // Popover states for unified context menu
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  // Mobile unified context menu (Perplexity style - single button for all context)
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [mobileContextSection, setMobileContextSection] = useState<Record<string, boolean>>({
    company: false,
    project: false,
    departments: false,
    roles: false,
    playbooks: false,
  });

  // Track previous open state to detect when panel opens
  const prevMobileContextOpenRef = useRef(mobileContextOpen);

  // Desktop: Active category tab (accordion - only one at a time)
  const [activeContextTab, setActiveContextTab] = useState<string | null>(null);

  // Auto-expand sections and auto-select first category when popover opens
  useEffect(() => {
    const wasOpen = prevMobileContextOpenRef.current;
    prevMobileContextOpenRef.current = mobileContextOpen;

    // Only run on open transition, not on every change
    if (mobileContextOpen && !wasOpen) {
      requestAnimationFrame(() => {
        // Mobile: expand sections with selections
        setMobileContextSection({
          company: !!selectedBusiness,
          project: !!selectedProject,
          departments: selectedDepartments.length > 0,
          roles: selectedRoles.length > 0,
          playbooks: selectedPlaybooks.length > 0,
        });
        // Desktop: auto-select first available category (no hint needed)
        if (businesses.length > 0) setActiveContextTab('company');
        else if (projects.length > 0) setActiveContextTab('project');
        else if (departments.length > 0) setActiveContextTab('departments');
        else if (roles.length > 0) setActiveContextTab('roles');
        else if (playbooks.length > 0) setActiveContextTab('playbooks');
      });
    }
    // Reset on close
    if (!mobileContextOpen && wasOpen) {
      requestAnimationFrame(() => {
        setActiveContextTab(null);
      });
    }
  }, [
    mobileContextOpen,
    selectedBusiness,
    selectedProject,
    selectedDepartments.length,
    selectedRoles.length,
    selectedPlaybooks.length,
    businesses.length,
    projects.length,
    departments.length,
    roles.length,
    playbooks.length,
  ]);

  // Make isMobile reactive to window resize
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  useEffect(() => {
    const handleResize = () => setIsMobile(isMobileDevice());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const disabled = isLoading;
  const isCouncilMode = chatMode === 'council';

  // Check if we have context data to show icons
  const hasBusinesses = businesses.length > 0 && onSelectBusiness;
  const hasProjects = projects.length > 0 && onSelectProject;
  const hasDepartments = departments.length > 0 && onSelectDepartments;
  const hasRoles = roles.length > 0 && onSelectRoles;
  const hasPlaybooks = playbooks.length > 0 && onSelectPlaybooks;
  const hasAnyContextIcons =
    showContextIcons &&
    (hasBusinesses || hasProjects || hasDepartments || hasRoles || hasPlaybooks);

  // Check if there are any selections (for showing reset button)
  const hasAnySelections =
    !!selectedBusiness ||
    !!selectedProject ||
    selectedDepartments.length > 0 ||
    selectedRoles.length > 0 ||
    selectedPlaybooks.length > 0;

  // Total selection count for mobile context button badge
  const totalSelectionCount =
    (selectedBusiness ? 1 : 0) +
    (selectedProject ? 1 : 0) +
    selectedDepartments.length +
    selectedRoles.length +
    selectedPlaybooks.length;

  // Toggle mobile context section
  const toggleMobileContextSection = (section: string) => {
    setMobileContextSection((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Focus on mount if autoFocus
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to focus input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Patch hidden textarea from react-textarea-autosize to silence form field warning
  useEffect(() => {
    const hiddenTextarea = document.querySelector('textarea[aria-hidden="true"][tabindex="-1"]');
    if (hiddenTextarea && !hiddenTextarea.getAttribute('name')) {
      hiddenTextarea.setAttribute('name', 'autosize-measure');
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((value.trim() || hasImages) && !isLoading && onSubmit) {
      onSubmit(value.trim(), chatMode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Scroll input into view when focused on mobile (keyboard covers input otherwise)
  const handleFocus = useCallback(() => {
    if (isMobile) {
      // Small delay to let keyboard start appearing
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [isMobile]);

  // Landing page gets welcoming first-time placeholders, chat view gets follow-up placeholders
  const currentPlaceholder =
    placeholder ||
    (variant === 'landing'
      ? chatMode === 'chat'
        ? t('omnibar.placeholderLandingChat')
        : t('omnibar.placeholderLanding')
      : chatMode === 'chat'
        ? t('omnibar.placeholderChat')
        : t('omnibar.placeholder'));

  const hasContent = value.trim().length > 0 || hasImages;

  // Toggle helpers for context selections
  const toggleDepartment = (id: string) => {
    if (!onSelectDepartments) return;
    const newSelection = selectedDepartments.includes(id)
      ? selectedDepartments.filter((d) => d !== id)
      : [...selectedDepartments, id];
    onSelectDepartments(newSelection);
  };

  const toggleRole = (id: string) => {
    if (!onSelectRoles) return;
    const newSelection = selectedRoles.includes(id)
      ? selectedRoles.filter((r) => r !== id)
      : [...selectedRoles, id];
    onSelectRoles(newSelection);
  };

  const togglePlaybook = (id: string) => {
    if (!onSelectPlaybooks) return;
    const newSelection = selectedPlaybooks.includes(id)
      ? selectedPlaybooks.filter((p) => p !== id)
      : [...selectedPlaybooks, id];
    onSelectPlaybooks(newSelection);
  };

  // Company list content - single select (radio-style)
  const companyList = (
    <div className={s.popoverList}>
      {businesses.length === 0 ? (
        <div className={s.popoverEmpty}>{t('omnibar.noCompanies')}</div>
      ) : (
        businesses.map((biz) => {
          const isSelected = selectedBusiness === biz.id;
          return (
            <button
              key={biz.id}
              className={cn(s.popoverItem, isSelected && s.selected)}
              onClick={() => {
                onSelectBusiness?.(isSelected ? null : biz.id);
              }}
              type="button"
            >
              <div className={cn(s.popoverRadio, isSelected && s.checked)}>
                {isSelected && <Check />}
              </div>
              <span>{biz.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Project list content - single select (radio-style like company)
  // Sort selected project to top for better UX
  const sortedProjects = [...projects]
    .filter((p) => p.status === 'active')
    .sort((a, b) => {
      const aSelected = selectedProject === a.id;
      const bSelected = selectedProject === b.id;
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

  const projectList = (
    <div className={s.popoverList}>
      {projects.length === 0 ? (
        <div className={s.popoverEmpty}>{t('context.noProjects')}</div>
      ) : (
        sortedProjects.map((proj) => {
          const isSelected = selectedProject === proj.id;
          return (
            <button
              key={proj.id}
              className={cn(s.popoverItem, isSelected && s.selected)}
              onClick={() => {
                onSelectProject?.(isSelected ? null : proj.id);
              }}
              type="button"
            >
              <div className={cn(s.popoverRadio, isSelected && s.checked)}>
                {isSelected && <Check />}
              </div>
              <span>{proj.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Department list content - uses shared DepartmentCheckboxItem
  // Sort selected items to top for better UX
  const sortedDepartments = [...departments].sort((a, b) => {
    const aSelected = selectedDepartments.includes(a.id);
    const bSelected = selectedDepartments.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const departmentList = (
    <div className={s.popoverList}>
      {departments.length === 0 ? (
        <div className={s.popoverEmpty}>{t('context.noDepartments')}</div>
      ) : (
        sortedDepartments.map((dept) => (
          <DepartmentCheckboxItem
            key={dept.id}
            department={dept}
            isSelected={selectedDepartments.includes(dept.id)}
            onToggle={toggleDepartment}
            isMobile={isMobile}
          />
        ))
      )}
    </div>
  );

  // Role list content
  // Sort selected items to top for better UX
  const sortedRoles = [...roles].sort((a, b) => {
    const aSelected = selectedRoles.includes(a.id);
    const bSelected = selectedRoles.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const roleList = (
    <div className={s.popoverList}>
      {roles.length === 0 ? (
        <div className={s.popoverEmpty}>{t('context.noRoles')}</div>
      ) : (
        sortedRoles.map((role) => {
          const isSelected = selectedRoles.includes(role.id);
          return (
            <button
              key={role.id}
              className={cn(s.popoverItem, isSelected && s.selected)}
              onClick={() => toggleRole(role.id)}
              type="button"
            >
              <div className={cn(s.popoverCheckbox, isSelected && s.checked)}>
                {isSelected && <Check />}
              </div>
              <span>{role.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Group playbooks by type
  const groupedPlaybooks = playbooks.reduce(
    (acc, pb) => {
      const type = pb.type || pb.doc_type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(pb);
      return acc;
    },
    {} as Record<string, Playbook[]>
  );

  const playbookTypeOrder = ['framework', 'sop', 'policy', 'other'];

  const toggleSection = (type: string) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const getSelectedCount = (type: string) => {
    const items = groupedPlaybooks[type] ?? [];
    return items.filter((pb) => selectedPlaybooks.includes(pb.id)).length;
  };

  // Playbook list content - grouped by type with collapsible sections
  // Sort selected items to top within each group for better UX
  const playbookList = (
    <div className={s.popoverList}>
      {playbooks.length === 0 ? (
        <div className={s.popoverEmpty}>{t('context.noPlaybooks')}</div>
      ) : (
        playbookTypeOrder
          .filter((type) => (groupedPlaybooks[type]?.length ?? 0) > 0)
          .map((type) => {
            const config = playbookTypeConfig[type]!;
            const items = groupedPlaybooks[type] ?? [];
            // Sort selected items to top
            const sortedItems = [...items].sort((a, b) => {
              const aSelected = selectedPlaybooks.includes(a.id);
              const bSelected = selectedPlaybooks.includes(b.id);
              if (aSelected && !bSelected) return -1;
              if (!aSelected && bSelected) return 1;
              return 0;
            });
            const isExpanded = expandedSections[type] ?? false;
            const selectedCount = getSelectedCount(type);
            return (
              <div key={type} className={s.popoverGroup}>
                <button
                  type="button"
                  className={cn(s.popoverGroupHeader, s.clickable, s[type as keyof typeof s])}
                  onClick={() => toggleSection(type)}
                >
                  <ChevronRight
                    size={12}
                    className={cn(s.sectionChevron, isExpanded && s.expanded)}
                  />
                  {config.icon}
                  <span className={s.sectionLabel}>{config.label}</span>
                  <span className={s.sectionCount}>
                    {selectedCount > 0 && <span>{selectedCount}/</span>}
                    {items.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className={s.popoverGroupItems}>
                    {sortedItems.map((pb) => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <button
                          key={pb.id}
                          className={cn(s.popoverItem, isSelected && s.selected)}
                          onClick={() => togglePlaybook(pb.id)}
                          type="button"
                        >
                          <div className={cn(s.popoverCheckbox, isSelected && s.checked)}>
                            {isSelected && <Check />}
                          </div>
                          <span>{pb.title || pb.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );

  // Mobile unified context menu content (Perplexity-inspired)
  // Shows all categories in accordion style within a single bottom sheet
  const mobileContextMenuContent = (
    <div className={s.mobileContextMenu}>
      {/* Company Section */}
      {hasBusinesses && (
        <div className={s.contextSection}>
          <button
            type="button"
            className={cn(s.contextSectionHeader, mobileContextSection.company && s.expanded)}
            onClick={() => toggleMobileContextSection('company')}
          >
            <Briefcase size={16} />
            <span className={s.contextSectionLabel}>{t('context.company')}</span>
            {selectedBusiness && <span className={s.contextSectionBadge}>1</span>}
            <ChevronRight
              size={14}
              className={cn(s.contextSectionChevron, mobileContextSection.company && s.rotated)}
            />
          </button>
          {mobileContextSection.company && (
            <div className={s.contextSectionContent}>{companyList}</div>
          )}
        </div>
      )}

      {/* Project Section */}
      {hasProjects && (
        <div className={s.contextSection}>
          <button
            type="button"
            className={cn(s.contextSectionHeader, mobileContextSection.project && s.expanded)}
            onClick={() => toggleMobileContextSection('project')}
          >
            <FolderKanban size={16} />
            <span className={s.contextSectionLabel}>{t('context.project')}</span>
            {selectedProject && <span className={s.contextSectionBadge}>1</span>}
            <ChevronRight
              size={14}
              className={cn(s.contextSectionChevron, mobileContextSection.project && s.rotated)}
            />
          </button>
          {mobileContextSection.project && (
            <div className={s.contextSectionContent}>{projectList}</div>
          )}
        </div>
      )}

      {/* Departments Section */}
      {hasDepartments && (
        <div className={s.contextSection}>
          <button
            type="button"
            className={cn(s.contextSectionHeader, mobileContextSection.departments && s.expanded)}
            onClick={() => toggleMobileContextSection('departments')}
          >
            <Building2 size={16} />
            <span className={s.contextSectionLabel}>{t('departments.title')}</span>
            {selectedDepartments.length > 0 && (
              <span className={s.contextSectionBadge}>{selectedDepartments.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(s.contextSectionChevron, mobileContextSection.departments && s.rotated)}
            />
          </button>
          {mobileContextSection.departments && (
            <div className={s.contextSectionContent}>{departmentList}</div>
          )}
        </div>
      )}

      {/* Roles Section */}
      {hasRoles && (
        <div className={s.contextSection}>
          <button
            type="button"
            className={cn(s.contextSectionHeader, mobileContextSection.roles && s.expanded)}
            onClick={() => toggleMobileContextSection('roles')}
          >
            <Users size={16} />
            <span className={s.contextSectionLabel}>{t('roles.title')}</span>
            {selectedRoles.length > 0 && (
              <span className={s.contextSectionBadge}>{selectedRoles.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(s.contextSectionChevron, mobileContextSection.roles && s.rotated)}
            />
          </button>
          {mobileContextSection.roles && <div className={s.contextSectionContent}>{roleList}</div>}
        </div>
      )}

      {/* Playbooks Section */}
      {hasPlaybooks && (
        <div className={s.contextSection}>
          <button
            type="button"
            className={cn(s.contextSectionHeader, mobileContextSection.playbooks && s.expanded)}
            onClick={() => toggleMobileContextSection('playbooks')}
          >
            <BookOpen size={16} />
            <span className={s.contextSectionLabel}>{t('context.playbooks')}</span>
            {selectedPlaybooks.length > 0 && (
              <span className={s.contextSectionBadge}>{selectedPlaybooks.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(s.contextSectionChevron, mobileContextSection.playbooks && s.rotated)}
            />
          </button>
          {mobileContextSection.playbooks && (
            <div className={s.contextSectionContent}>{playbookList}</div>
          )}
        </div>
      )}
    </div>
  );

  // Wrap element with tooltip for mom-friendly help
  // side: 'top' | 'right' | 'bottom' | 'left' - where tooltip appears relative to trigger
  // Use 'left' for dropdown menu items so tooltip doesn't block clicking
  const withTooltip = (
    element: React.ReactNode,
    tooltipText: string,
    side: 'top' | 'right' | 'bottom' | 'left' = 'top'
  ) => (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{element}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" side={side} sideOffset={8}>
            {tooltipText}
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );

  const containerClasses = cn(
    s.wrapper,
    variant === 'landing' && s.landing,
    variant === 'compact' && s.compact,
    hasContent && s.hasContent,
    isLoading && s.isLoading,
    hasAnyContextIcons && s.hasContextIcons,
    isCouncilMode && hasAnyContextIcons && s.councilMode,
    className
  );

  return (
    <div className={containerClasses}>
      {/* Mode toggle - only for landing variant when showModeToggle is true */}
      {showModeToggle && variant === 'landing' && onChatModeChange && (
        <div className={s.modeToggle} role="radiogroup" aria-label="Response mode">
          {withTooltip(
            <button
              type="button"
              name="response-mode"
              className={cn(s.modeBtn, chatMode === 'chat' && s.active)}
              onClick={() => onChatModeChange('chat')}
              role="radio"
              aria-checked={chatMode === 'chat'}
            >
              {t('omnibar.oneAI')}
            </button>,
            TOOLTIPS.chatMode
          )}
          {withTooltip(
            <button
              type="button"
              name="response-mode"
              className={cn(s.modeBtn, chatMode === 'council' && s.active)}
              onClick={() => onChatModeChange('council')}
              role="radio"
              aria-checked={chatMode === 'council'}
            >
              {t('omnibar.multiAI', { count: aiCount })}
            </button>,
            TOOLTIPS.councilMode
          )}
        </div>
      )}

      <div className={cn(s.bar, 'noise-overlay')}>
        {/* Top row: Textarea */}
        <div className={s.barTop}>
          <TextareaAutosize
            ref={textareaRef}
            id="omni-bar-input"
            name="omni-query"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={currentPlaceholder}
            className={s.barInput}
            minRows={1}
            maxRows={6}
            disabled={isLoading}
          />

          {/* Keyboard shortcut hint - top right */}
          <AnimatePresence>
            {showShortcutHint && !hasContent && !isLoading && variant === 'landing' && (
              <motion.kbd
                className={s.barKbd}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                ⌘K
              </motion.kbd>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom row: Context icons (left) + Actions (right) */}
        <div className={s.barBottom}>
          {/* Left side: Context button (unified for mobile & desktop) */}
          <div className={s.barLeft}>
            {hasAnyContextIcons && (
              <>
                {/* MOBILE: Context button opens BottomSheet */}
                {isMobile && (
                  <>
                    <button
                      type="button"
                      className={cn(s.mobileContextBtn, totalSelectionCount > 0 && s.hasSelection)}
                      onClick={() => setMobileContextOpen(true)}
                      disabled={disabled}
                      aria-label={t('context.configure')}
                    >
                      <span className={s.mobileContextLabel}>{t('context.context')}</span>
                      {totalSelectionCount > 0 && (
                        <span className={s.mobileContextBadge}>{totalSelectionCount}</span>
                      )}
                    </button>
                    <BottomSheet
                      isOpen={mobileContextOpen}
                      onClose={() => setMobileContextOpen(false)}
                      title={t('context.configureContext')}
                      headerAction={
                        hasAnySelections && onResetAll ? (
                          <button
                            type="button"
                            className={s.popoverClear}
                            onClick={(e) => {
                              e.stopPropagation();
                              onResetAll();
                            }}
                          >
                            {t('common.clearAll')}
                          </button>
                        ) : undefined
                      }
                    >
                      {mobileContextMenuContent}
                    </BottomSheet>
                  </>
                )}

                {/* DESKTOP: Two-column hover dropdown (ChatGPT style) */}
                {!isMobile && (
                  <Popover.Root open={mobileContextOpen} onOpenChange={setMobileContextOpen}>
                    <Tooltip.Provider delayDuration={400}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <Popover.Trigger asChild>
                            <button
                              type="button"
                              className={cn(
                                s.contextTrigger,
                                totalSelectionCount > 0 && s.hasSelection
                              )}
                              disabled={disabled}
                            >
                              <span>{t('context.context')}</span>
                              {totalSelectionCount > 0 && (
                                <span className={s.contextTriggerBadge}>{totalSelectionCount}</span>
                              )}
                              <ChevronDown size={14} className={s.contextTriggerChevron} />
                            </button>
                          </Popover.Trigger>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="tooltip-content" sideOffset={8}>
                            {TOOLTIPS.context}
                            <Tooltip.Arrow className="tooltip-arrow" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                    <Popover.Portal>
                      <Popover.Content
                        className={s.contextDropdown}
                        side="bottom"
                        align="start"
                        sideOffset={8}
                        collisionPadding={16}
                      >
                        {/* Two-column layout: categories left, options right */}
                        <div className={s.contextDropdownLayout}>
                          {/* Left: Category menu */}
                          <div className={s.contextDropdownMenu}>
                            {hasBusinesses &&
                              withTooltip(
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    s.contextMenuItem,
                                    activeContextTab === 'company' && s.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('company')}
                                  onFocus={() => setActiveContextTab('company')}
                                >
                                  <Briefcase size={16} />
                                  <span>{t('context.company')}</span>
                                  {selectedBusiness && (
                                    <span className={s.contextMenuBadge}>1</span>
                                  )}
                                  <ChevronRight size={14} className={s.contextMenuArrow} />
                                </div>,
                                TOOLTIPS.company,
                                'left'
                              )}
                            {hasProjects &&
                              withTooltip(
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    s.contextMenuItem,
                                    activeContextTab === 'project' && s.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('project')}
                                  onFocus={() => setActiveContextTab('project')}
                                >
                                  <FolderKanban size={16} />
                                  <span>{t('context.project')}</span>
                                  {selectedProject && <span className={s.contextMenuBadge}>1</span>}
                                  <ChevronRight size={14} className={s.contextMenuArrow} />
                                </div>,
                                TOOLTIPS.projects,
                                'left'
                              )}
                            {hasDepartments &&
                              withTooltip(
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    s.contextMenuItem,
                                    activeContextTab === 'departments' && s.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('departments')}
                                  onFocus={() => setActiveContextTab('departments')}
                                >
                                  <Building2 size={16} />
                                  <span>{t('departments.title')}</span>
                                  {selectedDepartments.length > 0 && (
                                    <span className={s.contextMenuBadge}>
                                      {selectedDepartments.length}
                                    </span>
                                  )}
                                  <ChevronRight size={14} className={s.contextMenuArrow} />
                                </div>,
                                TOOLTIPS.departments,
                                'left'
                              )}
                            {hasRoles &&
                              withTooltip(
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    s.contextMenuItem,
                                    activeContextTab === 'roles' && s.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('roles')}
                                  onFocus={() => setActiveContextTab('roles')}
                                >
                                  <Users size={16} />
                                  <span>{t('roles.title')}</span>
                                  {selectedRoles.length > 0 && (
                                    <span className={s.contextMenuBadge}>
                                      {selectedRoles.length}
                                    </span>
                                  )}
                                  <ChevronRight size={14} className={s.contextMenuArrow} />
                                </div>,
                                TOOLTIPS.roles,
                                'left'
                              )}
                            {hasPlaybooks &&
                              withTooltip(
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    s.contextMenuItem,
                                    activeContextTab === 'playbooks' && s.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('playbooks')}
                                  onFocus={() => setActiveContextTab('playbooks')}
                                >
                                  <BookOpen size={16} />
                                  <span>{t('context.playbooks')}</span>
                                  {selectedPlaybooks.length > 0 && (
                                    <span className={s.contextMenuBadge}>
                                      {selectedPlaybooks.length}
                                    </span>
                                  )}
                                  <ChevronRight size={14} className={s.contextMenuArrow} />
                                </div>,
                                TOOLTIPS.playbooks,
                                'left'
                              )}
                            {/* Clear All button at bottom of menu */}
                            {hasAnySelections && onResetAll && (
                              <div className={s.contextMenuDivider} />
                            )}
                            {hasAnySelections && onResetAll && (
                              <button
                                type="button"
                                className={s.contextMenuClear}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onResetAll();
                                }}
                              >
                                <RotateCcw size={14} />
                                <span>{t('common.clearAll')}</span>
                              </button>
                            )}
                          </div>

                          {/* Right: Options panel (always visible, content changes on hover) */}
                          <div className={s.contextDropdownPanel}>
                            {/* Panel header with description - helps mum understand */}
                            {activeContextTab && (
                              <div className={s.contextPanelHeader}>
                                <span className={s.contextPanelTitle}>
                                  {activeContextTab === 'company' && t('context.company')}
                                  {activeContextTab === 'project' && t('context.project')}
                                  {activeContextTab === 'departments' && t('departments.title')}
                                  {activeContextTab === 'roles' && t('roles.title')}
                                  {activeContextTab === 'playbooks' && t('context.playbooks')}
                                </span>
                                <span className={s.contextPanelDesc}>
                                  {activeContextTab === 'company' && TOOLTIPS.company}
                                  {activeContextTab === 'project' && TOOLTIPS.projects}
                                  {activeContextTab === 'departments' && TOOLTIPS.departments}
                                  {activeContextTab === 'roles' && TOOLTIPS.roles}
                                  {activeContextTab === 'playbooks' && TOOLTIPS.playbooks}
                                </span>
                              </div>
                            )}
                            {activeContextTab === 'company' && companyList}
                            {activeContextTab === 'project' && projectList}
                            {activeContextTab === 'departments' && departmentList}
                            {activeContextTab === 'roles' && roleList}
                            {activeContextTab === 'playbooks' && playbookList}
                            {!activeContextTab && (
                              <div className={s.contextPanelHint}>{t('context.hoverToSelect')}</div>
                            )}
                          </div>
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}
              </>
            )}
            {/* Inline mode toggle - next to Context for consistency */}
            {onChatModeChange && !showModeToggle && (
              <div
                className={cn(s.inlineModeToggle, 'no-touch-target')}
                role="radiogroup"
                aria-label="Response mode"
              >
                {withTooltip(
                  <button
                    type="button"
                    className={cn(
                      s.inlineModeIndicator,
                      'no-touch-target',
                      chatMode === 'chat' && s.active
                    )}
                    onClick={() => !disabled && onChatModeChange('chat')}
                    disabled={disabled}
                    role="radio"
                    aria-checked={chatMode === 'chat'}
                  >
                    {t('omnibar.oneAI')}
                  </button>,
                  TOOLTIPS.chatMode
                )}
                {withTooltip(
                  <button
                    type="button"
                    className={cn(
                      s.inlineModeIndicator,
                      'no-touch-target',
                      chatMode === 'council' && s.active
                    )}
                    onClick={() => !disabled && onChatModeChange('council')}
                    disabled={disabled}
                    role="radio"
                    aria-checked={chatMode === 'council'}
                  >
                    {t('omnibar.multiAI', { count: aiCount })}
                  </button>,
                  TOOLTIPS.councilMode
                )}
              </div>
            )}
            {/* Response Style Selector - next to mode toggle */}
            {onSelectPreset && (
              <ResponseStyleSelector
                selectedPreset={selectedPreset}
                departmentPreset={departmentPreset}
                onSelectPreset={onSelectPreset}
                onOpenLLMHub={onOpenLLMHub}
                disabled={disabled}
                compact
              />
            )}
          </div>

          {/* Right side: Attach + Send only */}
          <div className={s.barRight}>
            {/* Image attach button */}
            {showImageButton &&
              onImageClick &&
              withTooltip(
                <button
                  type="button"
                  className={cn(s.iconBtn, s.attach)}
                  onClick={onImageClick}
                  disabled={isLoading}
                  aria-label="Attach image"
                >
                  <ImageIcon size={20} />
                </button>,
                TOOLTIPS.attach
              )}

            {/* Submit/Stop button with tooltips */}
            <AnimatePresence mode="wait">
              {isLoading
                ? withTooltip(
                    <motion.button
                      key="stop"
                      type="button"
                      className={cn(s.barSubmit, s.barStop)}
                      onClick={onStop}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={springs.snappy}
                      whileTap={interactionStates.buttonTap}
                    >
                      <StopCircle className="h-5 w-5" />
                    </motion.button>,
                    TOOLTIPS.stop
                  )
                : withTooltip(
                    <motion.button
                      key="submit"
                      type="submit"
                      className={cn(s.barSubmit, hasContent && s.active)}
                      disabled={!hasContent}
                      onClick={handleSubmit}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={springs.snappy}
                      whileHover={interactionStates.buttonHover}
                      whileTap={interactionStates.buttonTap}
                    >
                      <Send className="h-5 w-5" />
                    </motion.button>,
                    TOOLTIPS.send
                  )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OmniBar;
