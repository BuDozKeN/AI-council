/**
 * ChatInput - Omnibar with context icons, textarea, and action buttons
 *
 * All-in-one input row like Perplexity:
 * [🏢 👤 📋 ⚡ | Follow up...                    📎 ↑]
 *
 * Mom Test: Every icon has a clear tooltip explaining what it does
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Building2,
  Users,
  BookOpen,
  Check,
  FileText,
  ScrollText,
  Shield,
  ChevronRight,
  ChevronDown,
  FolderKanban,
  RotateCcw,
  Send,
  Settings2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from '../ui/BottomSheet';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import { useCouncilStats } from '../../hooks/useCouncilStats';
import type { ReactNode, KeyboardEvent, ClipboardEvent } from 'react';
import type { Department, Role, Playbook, Project, LLMPresetId } from '../../types/business';
import { ResponseStyleSelector } from './ResponseStyleSelector';
import '../ui/Tooltip.css';
import '../shared/omnibar/popover.css';

// Tooltips are now fetched via i18n - see getTooltips() function below

// Check if we're on mobile/tablet for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface ImageUploadHandlers {
  errorDisplay: ReactNode;
  previews: ReactNode;
  handlePaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  openFilePicker: () => void;
}

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onStopGeneration: () => void;
  hasMessages: boolean;
  hasImages: boolean;
  imageUpload: ImageUploadHandlers;
  // Company context for dynamic stats
  companyId?: string | null;
  // Context props for follow-ups
  chatMode?: 'chat' | 'council';
  onChatModeChange?: (mode: 'chat' | 'council') => void;
  // Projects
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
  onResetAll?: () => void;
  // Response style selector (LLM preset override)
  selectedPreset?: LLMPresetId | null | undefined;
  departmentPreset?: LLMPresetId | undefined;
  departmentName?: string | undefined;
  onSelectPreset?: ((preset: LLMPresetId | null) => void) | undefined;
  onOpenLLMHub?: (() => void) | undefined;
}

export function ChatInput({
  input,
  onInputChange,
  onKeyDown,
  onSubmit,
  isLoading,
  onStopGeneration,
  hasMessages,
  hasImages,
  imageUpload,
  // Company context
  companyId,
  // Context props
  chatMode = 'council',
  onChatModeChange,
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
  departmentName,
  onSelectPreset,
  onOpenLLMHub,
}: ChatInputProps) {
  const { t } = useTranslation();
  const { aiCount } = useCouncilStats(companyId);
  // Track which playbook sections are expanded (accordion within dropdown)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  // Mobile unified context menu (Perplexity style - single button for all context)
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [mobileContextSection, setMobileContextSection] = useState<Record<string, boolean>>({
    project: false,
    departments: false,
    roles: false,
    playbooks: false,
  });
  // Desktop: Two-column hover dropdown - track which category is active
  const [activeContextTab, setActiveContextTab] = useState<string | null>(null);

  // Ref for textarea to scroll into view on focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get translated tooltips
  const TOOLTIPS = {
    projects: t('chat.tooltips.projects'),
    departments: t('chat.tooltips.departments'),
    roles: t('chat.tooltips.roles'),
    playbooks: t('chat.tooltips.playbooks'),
    councilMode: t('chat.tooltips.councilMode'),
    chatMode: t('chat.tooltips.chatMode'),
    send: t('chat.tooltips.send'),
    stop: t('chat.tooltips.stop'),
    reset: t('chat.tooltips.reset'),
  };

  // Dynamic placeholder based on mode and state
  const placeholder = !hasMessages
    ? t('chat.askCouncil')
    : chatMode === 'council'
      ? t('chat.askFollowUp')
      : t('chat.askQuickFollowUp');

  const canSend = input.trim() || hasImages;
  const disabled = isLoading;
  const isMobile = isMobileDevice();
  const isCouncilMode = chatMode === 'council';

  // Show context icons only for follow-ups
  const showContextIcons = hasMessages && onChatModeChange;
  const hasProjects = projects.length > 0 && onSelectProject;
  const hasDepartments = departments.length > 0 && onSelectDepartments;
  const hasRoles = roles.length > 0 && onSelectRoles;
  const hasPlaybooks = playbooks.length > 0 && onSelectPlaybooks;

  // Check if there are any selections (for showing reset button)
  const hasAnySelections =
    !!selectedProject ||
    selectedDepartments.length > 0 ||
    selectedRoles.length > 0 ||
    selectedPlaybooks.length > 0;

  // Total selection count for mobile context button badge
  const totalSelectionCount =
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

  // Get selected project name for display
  const selectedProjectName = selectedProject
    ? projects.find((p) => p.id === selectedProject)?.name
    : null;

  // Toggle helpers
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

  // Auto-select first available context tab when dropdown opens
  const handleContextDropdownOpen = (open: boolean) => {
    setMobileContextOpen(open);
    if (open && !activeContextTab) {
      // Auto-select first available category
      if (hasProjects) setActiveContextTab('project');
      else if (hasDepartments) setActiveContextTab('departments');
      else if (hasRoles) setActiveContextTab('roles');
      else if (hasPlaybooks) setActiveContextTab('playbooks');
    }
    if (!open) {
      setActiveContextTab(null);
    }
  };

  // Project list content - single select (radio-style)
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
    <div className="context-popover-list">
      {projects.length === 0 ? (
        <div className="context-popover-empty">{t('context.noProjects')}</div>
      ) : (
        sortedProjects.map((proj) => {
          const isSelected = selectedProject === proj.id;
          return (
            <button
              key={proj.id}
              className={cn('context-popover-item', isSelected && 'selected')}
              onClick={() => {
                onSelectProject?.(isSelected ? null : proj.id);
              }}
              type="button"
            >
              <div className={cn('context-popover-radio', isSelected && 'checked')}>
                {isSelected && <Check />}
              </div>
              <span>{proj.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Department list content - uses shared DepartmentCheckboxItem for consistency with Stage3
  // Sort selected items to top for better UX
  const sortedDepartments = [...departments].sort((a, b) => {
    const aSelected = selectedDepartments.includes(a.id);
    const bSelected = selectedDepartments.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const departmentList = (
    <div className="context-popover-list">
      {departments.length === 0 ? (
        <div className="context-popover-empty">{t('context.noDepartments')}</div>
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
    <div className="context-popover-list">
      {roles.length === 0 ? (
        <div className="context-popover-empty">{t('context.noRoles')}</div>
      ) : (
        sortedRoles.map((role) => {
          const isSelected = selectedRoles.includes(role.id);
          return (
            <button
              key={role.id}
              className={cn('context-popover-item', isSelected && 'selected')}
              onClick={() => toggleRole(role.id)}
              type="button"
            >
              <div className={cn('context-popover-checkbox', isSelected && 'checked')}>
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

  // Playbook type config with icons and labels
  const playbookTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    framework: { label: t('context.frameworks'), icon: <ScrollText size={12} /> },
    sop: { label: t('context.sops'), icon: <FileText size={12} /> },
    policy: { label: t('context.policies'), icon: <Shield size={12} /> },
    other: { label: t('context.other'), icon: <BookOpen size={12} /> },
  };

  // Order of playbook types to display
  const playbookTypeOrder = ['framework', 'sop', 'policy', 'other'];

  // Toggle section expansion
  const toggleSection = (type: string) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Count selected items per type
  const getSelectedCount = (type: string) => {
    const items = groupedPlaybooks[type] ?? [];
    return items.filter((pb) => selectedPlaybooks.includes(pb.id)).length;
  };

  // Playbook list content - grouped by type with collapsible sections
  // Sort selected items to top within each group for better UX
  const playbookList = (
    <div className="context-popover-list">
      {playbooks.length === 0 ? (
        <div className="context-popover-empty">{t('context.noPlaybooks')}</div>
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
              <div key={type} className="context-popover-group">
                <button
                  type="button"
                  className={cn('context-popover-group-header clickable', type)}
                  onClick={() => toggleSection(type)}
                >
                  <ChevronRight
                    size={12}
                    className={cn('section-chevron', isExpanded && 'expanded')}
                  />
                  {config.icon}
                  <span className="section-label">{config.label}</span>
                  <span className="section-count">
                    {selectedCount > 0 && <span className="selected-count">{selectedCount}/</span>}
                    {items.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className="context-popover-group-items">
                    {sortedItems.map((pb) => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <button
                          key={pb.id}
                          className={cn('context-popover-item', isSelected && 'selected')}
                          onClick={() => togglePlaybook(pb.id)}
                          type="button"
                        >
                          <div className={cn('context-popover-checkbox', isSelected && 'checked')}>
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
    <div className="mobile-context-menu">
      {/* Project Section */}
      {hasProjects && (
        <div className="context-section">
          <button
            type="button"
            className={cn('context-section-header', mobileContextSection.project && 'expanded')}
            onClick={() => toggleMobileContextSection('project')}
          >
            <FolderKanban size={16} />
            <span className="context-section-label">
              {selectedProjectName || t('context.project')}
            </span>
            {selectedProject && <span className="context-section-badge">1</span>}
            <ChevronRight
              size={14}
              className={cn('context-section-chevron', mobileContextSection.project && 'rotated')}
            />
          </button>
          {mobileContextSection.project && (
            <div className="context-section-content">{projectList}</div>
          )}
        </div>
      )}

      {/* Departments Section */}
      {hasDepartments && (
        <div className="context-section">
          <button
            type="button"
            className={cn('context-section-header', mobileContextSection.departments && 'expanded')}
            onClick={() => toggleMobileContextSection('departments')}
          >
            <Building2 size={16} />
            <span className="context-section-label">{t('departments.title')}</span>
            {selectedDepartments.length > 0 && (
              <span className="context-section-badge">{selectedDepartments.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(
                'context-section-chevron',
                mobileContextSection.departments && 'rotated'
              )}
            />
          </button>
          {mobileContextSection.departments && (
            <div className="context-section-content">{departmentList}</div>
          )}
        </div>
      )}

      {/* Roles Section */}
      {hasRoles && (
        <div className="context-section">
          <button
            type="button"
            className={cn('context-section-header', mobileContextSection.roles && 'expanded')}
            onClick={() => toggleMobileContextSection('roles')}
          >
            <Users size={16} />
            <span className="context-section-label">{t('roles.title')}</span>
            {selectedRoles.length > 0 && (
              <span className="context-section-badge">{selectedRoles.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn('context-section-chevron', mobileContextSection.roles && 'rotated')}
            />
          </button>
          {mobileContextSection.roles && <div className="context-section-content">{roleList}</div>}
        </div>
      )}

      {/* Playbooks Section */}
      {hasPlaybooks && (
        <div className="context-section">
          <button
            type="button"
            className={cn('context-section-header', mobileContextSection.playbooks && 'expanded')}
            onClick={() => toggleMobileContextSection('playbooks')}
          >
            <BookOpen size={16} />
            <span className="context-section-label">{t('context.playbooks')}</span>
            {selectedPlaybooks.length > 0 && (
              <span className="context-section-badge">{selectedPlaybooks.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn('context-section-chevron', mobileContextSection.playbooks && 'rotated')}
            />
          </button>
          {mobileContextSection.playbooks && (
            <div className="context-section-content">{playbookList}</div>
          )}
        </div>
      )}
    </div>
  );

  // Wrap button with tooltip for mom-friendly help
  const withTooltip = (button: React.ReactNode, tooltipText: string) => (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" sideOffset={8}>
            {tooltipText}
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );

  return (
    <>
      {/* Image error display */}
      {imageUpload.errorDisplay}

      {/* Image previews */}
      {imageUpload.previews}

      <div className={cn('omnibar', isCouncilMode && showContextIcons && 'council-mode')}>
        {/* Top row: Just the textarea */}
        <div className="omni-top">
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            name="message"
            className="omni-input"
            placeholder={placeholder}
            aria-label={placeholder}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={handleFocus}
            onPaste={imageUpload.handlePaste}
            disabled={isLoading}
            rows={1}
          />
        </div>

        {/* Bottom row: Context icons (left) + Attach/Send (right) - Perplexity style */}
        <div className="omni-bottom">
          {/* Left side: Context icons */}
          <div className="omni-left">
            {showContextIcons && (
              <>
                {/* MOBILE: Single Context button (Perplexity style) */}
                {isMobile && (hasProjects || hasDepartments || hasRoles || hasPlaybooks) && (
                  <>
                    <button
                      type="button"
                      className={cn(
                        'mobile-context-btn',
                        totalSelectionCount > 0 && 'has-selection'
                      )}
                      onClick={() => setMobileContextOpen(true)}
                      disabled={disabled}
                      aria-label={t('context.configure')}
                    >
                      <Settings2 size={16} />
                      <span className="mobile-context-label">{t('context.context')}</span>
                      {totalSelectionCount > 0 && (
                        <span className="mobile-context-badge">{totalSelectionCount}</span>
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
                            className="context-popover-clear"
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

                {/* DESKTOP: Two-column hover dropdown (same as OmniBar) */}
                {!isMobile && (hasProjects || hasDepartments || hasRoles || hasPlaybooks) && (
                  <Popover.Root open={mobileContextOpen} onOpenChange={handleContextDropdownOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'context-trigger',
                          totalSelectionCount > 0 && 'has-selection'
                        )}
                        disabled={disabled}
                      >
                        <span>{t('context.context')}</span>
                        {totalSelectionCount > 0 && (
                          <span className="context-trigger-badge">{totalSelectionCount}</span>
                        )}
                        <ChevronDown size={14} className="context-trigger-chevron" />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="context-dropdown"
                        side="bottom"
                        align="start"
                        sideOffset={8}
                        collisionPadding={16}
                      >
                        {/* Two-column layout: categories left, options right */}
                        <div className="context-dropdown-layout">
                          {/* Left: Category menu */}
                          <div className="context-dropdown-menu">
                            {hasProjects && (
                              <div
                                role="menuitem"
                                tabIndex={0}
                                className={cn(
                                  'context-menu-item',
                                  activeContextTab === 'project' && 'active'
                                )}
                                onMouseEnter={() => setActiveContextTab('project')}
                                onFocus={() => setActiveContextTab('project')}
                              >
                                <FolderKanban size={16} />
                                <span>{t('context.project')}</span>
                                {selectedProject && <span className="context-menu-badge">1</span>}
                                <ChevronRight size={14} className="context-menu-arrow" />
                              </div>
                            )}
                            {hasDepartments && (
                              <div
                                role="menuitem"
                                tabIndex={0}
                                className={cn(
                                  'context-menu-item',
                                  activeContextTab === 'departments' && 'active'
                                )}
                                onMouseEnter={() => setActiveContextTab('departments')}
                                onFocus={() => setActiveContextTab('departments')}
                              >
                                <Building2 size={16} />
                                <span>{t('departments.title')}</span>
                                {selectedDepartments.length > 0 && (
                                  <span className="context-menu-badge">
                                    {selectedDepartments.length}
                                  </span>
                                )}
                                <ChevronRight size={14} className="context-menu-arrow" />
                              </div>
                            )}
                            {hasRoles && (
                              <div
                                role="menuitem"
                                tabIndex={0}
                                className={cn(
                                  'context-menu-item',
                                  activeContextTab === 'roles' && 'active'
                                )}
                                onMouseEnter={() => setActiveContextTab('roles')}
                                onFocus={() => setActiveContextTab('roles')}
                              >
                                <Users size={16} />
                                <span>{t('roles.title')}</span>
                                {selectedRoles.length > 0 && (
                                  <span className="context-menu-badge">{selectedRoles.length}</span>
                                )}
                                <ChevronRight size={14} className="context-menu-arrow" />
                              </div>
                            )}
                            {hasPlaybooks && (
                              <div
                                role="menuitem"
                                tabIndex={0}
                                className={cn(
                                  'context-menu-item',
                                  activeContextTab === 'playbooks' && 'active'
                                )}
                                onMouseEnter={() => setActiveContextTab('playbooks')}
                                onFocus={() => setActiveContextTab('playbooks')}
                              >
                                <BookOpen size={16} />
                                <span>{t('context.playbooks')}</span>
                                {selectedPlaybooks.length > 0 && (
                                  <span className="context-menu-badge">
                                    {selectedPlaybooks.length}
                                  </span>
                                )}
                                <ChevronRight size={14} className="context-menu-arrow" />
                              </div>
                            )}
                            {/* Clear All button at bottom of menu */}
                            {hasAnySelections && onResetAll && (
                              <div className="context-menu-divider" />
                            )}
                            {hasAnySelections && onResetAll && (
                              <button
                                type="button"
                                className="context-menu-clear"
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
                          <div className="context-dropdown-panel">
                            {activeContextTab === 'project' && projectList}
                            {activeContextTab === 'departments' && departmentList}
                            {activeContextTab === 'roles' && roleList}
                            {activeContextTab === 'playbooks' && playbookList}
                            {!activeContextTab && (
                              <div className="context-panel-hint">{t('context.hoverToSelect')}</div>
                            )}
                          </div>
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}

                {/* Mode toggle - dynamic "1 AI / N AIs" pill based on LLM Hub config */}
                <Tooltip.Provider delayDuration={400}>
                  <div
                    className="omni-inline-mode-toggle"
                    role="radiogroup"
                    aria-label="Response mode"
                  >
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'inline-mode-btn no-touch-target',
                            chatMode === 'chat' && 'active'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!disabled) onChatModeChange?.('chat');
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          disabled={disabled}
                          role="radio"
                          aria-checked={chatMode === 'chat'}
                        >
                          1 AI
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" sideOffset={8}>
                          {TOOLTIPS.chatMode}
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'inline-mode-btn no-touch-target',
                            chatMode === 'council' && 'active'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!disabled) onChatModeChange?.('council');
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          disabled={disabled}
                          role="radio"
                          aria-checked={chatMode === 'council'}
                        >
                          {aiCount} {aiCount === 1 ? 'AI' : 'AIs'}
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" sideOffset={8}>
                          {TOOLTIPS.councilMode}
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </div>
                </Tooltip.Provider>

                {/* Response Style Selector - Quick toggle for Precise/Balanced/Creative */}
                {onSelectPreset && (
                  <ResponseStyleSelector
                    selectedPreset={selectedPreset}
                    departmentPreset={departmentPreset}
                    departmentName={departmentName}
                    onSelectPreset={onSelectPreset}
                    onOpenLLMHub={onOpenLLMHub}
                    disabled={disabled}
                  />
                )}
              </>
            )}
          </div>

          {/* Right side: Send button only */}
          <div className="omni-right">
            {isLoading
              ? withTooltip(
                  <button
                    type="button"
                    className="omni-send-btn stop"
                    onClick={onStopGeneration}
                    aria-label="Stop generation"
                  >
                    <span className="stop-icon" />
                  </button>,
                  TOOLTIPS.stop
                )
              : withTooltip(
                  <button
                    type="submit"
                    className={cn('omni-send-btn', canSend && 'active')}
                    disabled={!canSend}
                    onClick={onSubmit}
                    aria-label="Send message"
                  >
                    <Send className="h-5 w-5" />
                  </button>,
                  TOOLTIPS.send
                )}
          </div>
        </div>
      </div>
    </>
  );
}
