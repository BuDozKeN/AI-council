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
  Paperclip,
  Target,
  Zap,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from '../ui/BottomSheet';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import { useCouncilStats } from '../../hooks/useCouncilStats';
import type { ReactNode, KeyboardEvent, ClipboardEvent } from 'react';
import type { Department, Role, Playbook, Project, LLMPresetId } from '../../types/business';
import { ResponseStyleSelector } from './ResponseStyleSelector';
import '../ui/Tooltip.css';
import s from './input/ChatInput.module.css';
import c from './input/ChatInputContext.module.css';

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
    <>
      <div className={c.popoverList}>
        {projects.length === 0 ? (
          <div className={c.popoverEmpty}>{t('context.noProjects')}</div>
        ) : (
          sortedProjects.map((proj) => {
            const isSelected = selectedProject === proj.id;
            return (
              <label key={proj.id} className={cn(c.popoverItem, isSelected && c.selected)}>
                <input
                  type="radio"
                  name="project"
                  value={proj.id}
                  checked={isSelected}
                  onChange={() => {
                    // onChange only fires for newly selected (unchecked -> checked)
                    if (!isSelected) onSelectProject?.(proj.id);
                  }}
                  onClick={() => {
                    // onClick fires even when already checked, enabling deselect
                    if (isSelected) onSelectProject?.(null);
                  }}
                  className={c.popoverInput}
                  aria-label={proj.name}
                />
                <div className={cn(c.popoverRadio, isSelected && c.checked)} aria-hidden="true">
                  {isSelected && <Check />}
                </div>
                <span>{proj.name}</span>
              </label>
            );
          })
        )}
      </div>
      <div className={c.contextHelpText}>
        {t('context.projectHelp', 'Selected project will affect response generation')}
      </div>
    </>
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
    <>
      <div className={c.popoverList}>
        {departments.length === 0 ? (
          <div className={c.popoverEmpty}>{t('context.noDepartments')}</div>
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
      <div className={c.contextHelpText}>
        {t('context.departmentHelp', 'Selected departments will be used to generate responses')}
      </div>
    </>
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
    <>
      <div className={c.popoverList}>
        {roles.length === 0 ? (
          <div className={c.popoverEmpty}>{t('context.noRoles')}</div>
        ) : (
          sortedRoles.map((role) => {
            const isSelected = selectedRoles.includes(role.id);
            return (
              <label key={role.id} className={cn(c.popoverItem, isSelected && c.selected)}>
                <input
                  type="checkbox"
                  name="role"
                  value={role.id}
                  checked={isSelected}
                  onChange={() => toggleRole(role.id)}
                  className={c.popoverInput}
                  aria-label={role.name}
                />
                <div className={cn(c.popoverCheckbox, isSelected && c.checked)} aria-hidden="true">
                  {isSelected && <Check />}
                </div>
                <span>{role.name}</span>
              </label>
            );
          })
        )}
      </div>
      <div className={c.contextHelpText}>
        {t('context.roleHelp', 'Selected roles will be used to generate responses')}
      </div>
    </>
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
    <div className={c.popoverList}>
      {playbooks.length === 0 ? (
        <div className={c.popoverEmpty}>{t('context.noPlaybooks')}</div>
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
              <div key={type} className={c.popoverGroup}>
                <button
                  type="button"
                  className={cn(c.popoverGroupHeader, c.clickable, c[type as keyof typeof c])}
                  onClick={() => toggleSection(type)}
                >
                  <ChevronRight
                    size={12}
                    className={cn(c.sectionChevron, isExpanded && c.expanded)}
                  />
                  {config.icon}
                  <span className={c.sectionLabel}>{config.label}</span>
                  <span className={c.sectionCount}>
                    {selectedCount > 0 && <span className={c.selectedCount}>{selectedCount}/</span>}
                    {items.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className={c.popoverGroupItems}>
                    {sortedItems.map((pb) => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <label key={pb.id} className={cn(c.popoverItem, isSelected && c.selected)}>
                          <input
                            type="checkbox"
                            name="playbook"
                            value={pb.id}
                            checked={isSelected}
                            onChange={() => togglePlaybook(pb.id)}
                            className={c.popoverInput}
                            aria-label={pb.title || pb.name}
                          />
                          <div
                            className={cn(c.popoverCheckbox, isSelected && c.checked)}
                            aria-hidden="true"
                          >
                            {isSelected && <Check />}
                          </div>
                          <span>{pb.title || pb.name}</span>
                        </label>
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
  // UXH-031: Now includes Mode Toggle and Response Style for reduced clutter
  const mobileContextMenuContent = (
    <div className={c.mobileContextMenu}>
      {/* UXH-031: Mode Toggle Section */}
      {onChatModeChange && (
        <div className={c.modeToggleSection}>
          <div className={c.modeToggleLabel}>
            <Users size={18} aria-hidden="true" />
            <span>{t('chat.responseMode', 'Response Mode')}</span>
          </div>
          <div
            className={c.modeToggleButtons}
            role="radiogroup"
            aria-label={t('aria.aiModeToggle', 'AI response mode')}
          >
            <button
              type="button"
              className={cn(c.modeToggleBtn, chatMode === 'chat' && c.active)}
              onClick={() => onChatModeChange('chat')}
              disabled={disabled}
              role="radio"
              aria-checked={chatMode === 'chat'}
            >
              1 AI
            </button>
            <button
              type="button"
              className={cn(c.modeToggleBtn, chatMode === 'council' && c.active)}
              onClick={() => onChatModeChange('council')}
              disabled={disabled}
              role="radio"
              aria-checked={chatMode === 'council'}
            >
              {aiCount} {aiCount === 1 ? 'AI' : 'AIs'}
            </button>
          </div>
        </div>
      )}

      {/* UXH-031: Response Style Section */}
      {onSelectPreset && (
        <div className={c.responseStyleSection}>
          <div className={c.responseStyleHeader}>
            <Zap size={18} aria-hidden="true" />
            <span>{t('chat.responseStyle.title', 'Response Style')}</span>
          </div>
          <div
            className={c.responseStyleOptions}
            role="radiogroup"
            aria-label={t('chat.responseStyle.label', 'Response style')}
          >
            {/* UXH-086: Added title tooltips to explain each response style */}
            <button
              type="button"
              className={cn(
                c.responseStyleOption,
                (selectedPreset === 'conservative' ||
                  (!selectedPreset && departmentPreset === 'conservative')) &&
                  c.active
              )}
              onClick={() => onSelectPreset('conservative')}
              disabled={disabled}
              role="radio"
              aria-checked={
                selectedPreset === 'conservative' ||
                (!selectedPreset && departmentPreset === 'conservative')
              }
              title={t(
                'chat.responseStyle.descriptions.conservative',
                'Factual, focused answers - best for data and compliance'
              )}
            >
              <Target size={20} aria-hidden="true" />
              <span>{t('chat.responseStyle.presets.conservative', 'Precise')}</span>
            </button>
            <button
              type="button"
              className={cn(
                c.responseStyleOption,
                (selectedPreset === 'balanced' ||
                  (!selectedPreset && departmentPreset === 'balanced')) &&
                  c.active
              )}
              onClick={() => onSelectPreset('balanced')}
              disabled={disabled}
              role="radio"
              aria-checked={
                selectedPreset === 'balanced' ||
                (!selectedPreset && departmentPreset === 'balanced')
              }
              title={t(
                'chat.responseStyle.descriptions.balanced',
                'Good for most questions - reliable and flexible'
              )}
            >
              <Zap size={20} aria-hidden="true" />
              <span>{t('chat.responseStyle.presets.balanced', 'Balanced')}</span>
            </button>
            <button
              type="button"
              className={cn(
                c.responseStyleOption,
                (selectedPreset === 'creative' ||
                  (!selectedPreset && departmentPreset === 'creative')) &&
                  c.active
              )}
              onClick={() => onSelectPreset('creative')}
              disabled={disabled}
              role="radio"
              aria-checked={
                selectedPreset === 'creative' ||
                (!selectedPreset && departmentPreset === 'creative')
              }
              title={t(
                'chat.responseStyle.descriptions.creative',
                'More original ideas - great for brainstorming'
              )}
            >
              <Sparkles size={20} aria-hidden="true" />
              <span>{t('chat.responseStyle.presets.creative', 'Creative')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Project Section */}
      {hasProjects && (
        <div className={c.contextSection}>
          <button
            type="button"
            className={cn(c.contextSectionHeader, mobileContextSection.project && c.expanded)}
            onClick={() => toggleMobileContextSection('project')}
          >
            <FolderKanban size={16} />
            <span className={c.contextSectionLabel}>
              {selectedProjectName || t('context.project')}
            </span>
            {selectedProject && <span className={c.contextSectionBadge}>1</span>}
            <ChevronRight
              size={14}
              className={cn(c.contextSectionChevron, mobileContextSection.project && c.rotated)}
            />
          </button>
          {mobileContextSection.project && (
            <div className={c.contextSectionContent}>{projectList}</div>
          )}
        </div>
      )}

      {/* Departments Section */}
      {hasDepartments && (
        <div className={c.contextSection}>
          <button
            type="button"
            className={cn(c.contextSectionHeader, mobileContextSection.departments && c.expanded)}
            onClick={() => toggleMobileContextSection('departments')}
          >
            <Building2 size={16} />
            <span className={c.contextSectionLabel}>{t('departments.title')}</span>
            {selectedDepartments.length > 0 && (
              <span className={c.contextSectionBadge}>{selectedDepartments.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(c.contextSectionChevron, mobileContextSection.departments && c.rotated)}
            />
          </button>
          {mobileContextSection.departments && (
            <div className={c.contextSectionContent}>{departmentList}</div>
          )}
        </div>
      )}

      {/* Roles Section */}
      {hasRoles && (
        <div className={c.contextSection}>
          <button
            type="button"
            className={cn(c.contextSectionHeader, mobileContextSection.roles && c.expanded)}
            onClick={() => toggleMobileContextSection('roles')}
          >
            <Users size={16} />
            <span className={c.contextSectionLabel}>{t('roles.title')}</span>
            {selectedRoles.length > 0 && (
              <span className={c.contextSectionBadge}>{selectedRoles.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(c.contextSectionChevron, mobileContextSection.roles && c.rotated)}
            />
          </button>
          {mobileContextSection.roles && <div className={c.contextSectionContent}>{roleList}</div>}
        </div>
      )}

      {/* Playbooks Section */}
      {hasPlaybooks && (
        <div className={c.contextSection}>
          <button
            type="button"
            className={cn(c.contextSectionHeader, mobileContextSection.playbooks && c.expanded)}
            onClick={() => toggleMobileContextSection('playbooks')}
          >
            <BookOpen size={16} />
            <span className={c.contextSectionLabel}>{t('context.playbooks')}</span>
            {selectedPlaybooks.length > 0 && (
              <span className={c.contextSectionBadge}>{selectedPlaybooks.length}</span>
            )}
            <ChevronRight
              size={14}
              className={cn(c.contextSectionChevron, mobileContextSection.playbooks && c.rotated)}
            />
          </button>
          {mobileContextSection.playbooks && (
            <div className={c.contextSectionContent}>{playbookList}</div>
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

      <div className={cn(s.omnibar, isCouncilMode && showContextIcons && s.councilMode)}>
        {/* Top row: Just the textarea */}
        <div className={s.omniTop}>
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            name="message"
            className={s.omniInput}
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
        <div className={s.omniBottom}>
          {/* Left side: Context icons */}
          <div className={s.omniLeft}>
            {showContextIcons && (
              <>
                {/* MOBILE: Single Context button (Perplexity style) */}
                {isMobile && (hasProjects || hasDepartments || hasRoles || hasPlaybooks) && (
                  <>
                    {withTooltip(
                      <button
                        type="button"
                        className={cn(
                          c.mobileContextBtn,
                          totalSelectionCount > 0 && c.hasSelection
                        )}
                        onClick={() => setMobileContextOpen(true)}
                        disabled={disabled}
                        aria-label={
                          totalSelectionCount > 0
                            ? t('context.configure') + ` (${totalSelectionCount} selected)`
                            : t('context.configure')
                        }
                      >
                        <Settings2 size={16} aria-hidden="true" />
                        <span className={c.mobileContextLabel}>{t('context.context')}</span>
                        {totalSelectionCount > 0 && (
                          <span className={c.mobileContextBadge} aria-hidden="true">
                            {totalSelectionCount}
                          </span>
                        )}
                      </button>,
                      t('context.configure')
                    )}
                    <BottomSheet
                      isOpen={mobileContextOpen}
                      onClose={() => setMobileContextOpen(false)}
                      title={t('context.configureContext')}
                      headerAction={
                        hasAnySelections && onResetAll ? (
                          <button
                            type="button"
                            className={c.popoverClear}
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
                  <Tooltip.Provider delayDuration={400}>
                    <Popover.Root open={mobileContextOpen} onOpenChange={handleContextDropdownOpen}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <Popover.Trigger asChild>
                            <button
                              type="button"
                              className={cn(
                                c.contextTrigger,
                                totalSelectionCount > 0 && c.hasSelection
                              )}
                              disabled={disabled}
                              aria-label={
                                totalSelectionCount > 0
                                  ? t('context.configure') + ` (${totalSelectionCount} selected)`
                                  : t('context.configure')
                              }
                            >
                              <span>{t('context.context')}</span>
                              {totalSelectionCount > 0 && (
                                <span className={c.contextTriggerBadge}>{totalSelectionCount}</span>
                              )}
                              <ChevronDown
                                size={14}
                                className={c.contextTriggerChevron}
                                aria-hidden="true"
                              />
                            </button>
                          </Popover.Trigger>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="tooltip-content" sideOffset={8}>
                            {t('context.configure')}
                            <Tooltip.Arrow className="tooltip-arrow" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                      <Popover.Portal>
                        <Popover.Content
                          className={c.contextDropdown}
                          side="bottom"
                          align="start"
                          sideOffset={8}
                          collisionPadding={16}
                        >
                          {/* Two-column layout: categories left, options right */}
                          <div className={c.contextDropdownLayout}>
                            {/* Left: Category menu */}
                            <div className={c.contextDropdownMenu}>
                              {hasProjects && (
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    c.contextMenuItem,
                                    activeContextTab === 'project' && c.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('project')}
                                  onFocus={() => setActiveContextTab('project')}
                                >
                                  <FolderKanban size={16} aria-hidden="true" />
                                  <span>{t('context.project')}</span>
                                  {selectedProject && (
                                    <span className={c.contextMenuBadge} aria-hidden="true">
                                      1
                                    </span>
                                  )}
                                  <ChevronRight
                                    size={14}
                                    className={c.contextMenuArrow}
                                    aria-hidden="true"
                                  />
                                </div>
                              )}
                              {hasDepartments && (
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    c.contextMenuItem,
                                    activeContextTab === 'departments' && c.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('departments')}
                                  onFocus={() => setActiveContextTab('departments')}
                                >
                                  <Building2 size={16} aria-hidden="true" />
                                  <span>{t('departments.title')}</span>
                                  {selectedDepartments.length > 0 && (
                                    <span className={c.contextMenuBadge} aria-hidden="true">
                                      {selectedDepartments.length}
                                    </span>
                                  )}
                                  <ChevronRight
                                    size={14}
                                    className={c.contextMenuArrow}
                                    aria-hidden="true"
                                  />
                                </div>
                              )}
                              {hasRoles && (
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    c.contextMenuItem,
                                    activeContextTab === 'roles' && c.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('roles')}
                                  onFocus={() => setActiveContextTab('roles')}
                                >
                                  <Users size={16} aria-hidden="true" />
                                  <span>{t('roles.title')}</span>
                                  {selectedRoles.length > 0 && (
                                    <span className={c.contextMenuBadge} aria-hidden="true">
                                      {selectedRoles.length}
                                    </span>
                                  )}
                                  <ChevronRight
                                    size={14}
                                    className={c.contextMenuArrow}
                                    aria-hidden="true"
                                  />
                                </div>
                              )}
                              {hasPlaybooks && (
                                <div
                                  role="menuitem"
                                  tabIndex={0}
                                  className={cn(
                                    c.contextMenuItem,
                                    activeContextTab === 'playbooks' && c.active
                                  )}
                                  onMouseEnter={() => setActiveContextTab('playbooks')}
                                  onFocus={() => setActiveContextTab('playbooks')}
                                >
                                  <BookOpen size={16} aria-hidden="true" />
                                  <span>{t('context.playbooks')}</span>
                                  {selectedPlaybooks.length > 0 && (
                                    <span className={c.contextMenuBadge} aria-hidden="true">
                                      {selectedPlaybooks.length}
                                    </span>
                                  )}
                                  <ChevronRight
                                    size={14}
                                    className={c.contextMenuArrow}
                                    aria-hidden="true"
                                  />
                                </div>
                              )}
                              {/* Clear All button at bottom of menu */}
                              {hasAnySelections && onResetAll && (
                                <div className={c.contextMenuDivider} />
                              )}
                              {hasAnySelections && onResetAll && (
                                <button
                                  type="button"
                                  className={c.contextMenuClear}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onResetAll();
                                  }}
                                >
                                  <RotateCcw size={14} aria-hidden="true" />
                                  <span>{t('common.clearAll')}</span>
                                </button>
                              )}
                            </div>

                            {/* Right: Options panel (always visible, content changes on hover) */}
                            <div className={c.contextDropdownPanel}>
                              {activeContextTab === 'project' && projectList}
                              {activeContextTab === 'departments' && departmentList}
                              {activeContextTab === 'roles' && roleList}
                              {activeContextTab === 'playbooks' && playbookList}
                              {!activeContextTab && (
                                <div className={c.contextPanelHint}>
                                  {t('context.hoverToSelect')}
                                </div>
                              )}
                            </div>
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </Tooltip.Provider>
                )}

                {/* Mode toggle - dynamic "1 AI / N AIs" pill based on LLM Hub config */}
                <Tooltip.Provider delayDuration={400}>
                  <div
                    className={s.inlineModeToggle}
                    role="radiogroup"
                    aria-label={t('aria.aiModeToggle', 'AI response mode')}
                  >
                    {/* ISS-154: Screen reader only label for radio group */}
                    <span className="sr-only">
                      {t('chat.aiModeLabel', 'Choose how many AIs respond:')}
                    </span>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          className={cn(
                            s.inlineModeBtn,
                            'no-touch-target',
                            chatMode === 'chat' && s.active
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
                            s.inlineModeBtn,
                            'no-touch-target',
                            chatMode === 'council' && s.active
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
                {/* UXH-031: Hidden on mobile - now available in context bottom sheet */}
                {onSelectPreset && (
                  <div className={s.hideOnMobile}>
                    <ResponseStyleSelector
                      selectedPreset={selectedPreset}
                      departmentPreset={departmentPreset}
                      departmentName={departmentName}
                      onSelectPreset={onSelectPreset}
                      onOpenLLMHub={onOpenLLMHub}
                      disabled={disabled}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right side: Attach + Send buttons */}
          <div className={s.omniRight}>
            {/* Attach image button */}
            {withTooltip(
              <button
                type="button"
                className={cn(s.iconBtn, s.attach, hasImages && s.hasImages)}
                onClick={imageUpload.openFilePicker}
                disabled={isLoading}
                aria-label={t('aria.attachImage', 'Attach image')}
              >
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              </button>,
              t('tooltips.attachImage', 'Attach image (or paste from clipboard)')
            )}

            {/* Send/Stop button */}
            {isLoading
              ? withTooltip(
                  <button
                    type="button"
                    className={cn(s.sendBtn, s.stop)}
                    onClick={onStopGeneration}
                    aria-label={t('aria.stopGeneration', 'Stop generation')}
                  >
                    <span className={s.stopIcon} aria-hidden="true" />
                  </button>,
                  TOOLTIPS.stop
                )
              : withTooltip(
                  <button
                    type="submit"
                    className={cn(s.sendBtn, canSend && s.active)}
                    disabled={!canSend}
                    onClick={onSubmit}
                    aria-label={t('aria.sendMessage', 'Send message')}
                  >
                    <Send className="h-5 w-5" aria-hidden="true" />
                  </button>,
                  TOOLTIPS.send
                )}
          </div>
        </div>
      </div>
    </>
  );
}
