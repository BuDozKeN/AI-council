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

import { useState, useRef, useEffect } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { springs, interactionStates } from '../../lib/animations';
import { BottomSheet } from '../ui/BottomSheet';
import { useCouncilStats } from '../../hooks/useCouncilStats';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import { ResponseStyleSelector } from '../chat/ResponseStyleSelector';
import { toast } from '../ui/sonner';
import type { Business, Department, Role, Playbook, Project } from '../../types/business';
import '../ui/Tooltip.css';
import './OmniBar.css';

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
    company: t('chat.tooltips.company'),
    projects: t('chat.tooltips.projects'),
    departments: t('chat.tooltips.departments'),
    roles: t('chat.tooltips.roles'),
    playbooks: t('chat.tooltips.playbooks'),
    councilMode: t('chat.tooltips.councilMode'),
    chatMode: t('chat.tooltips.chatMode'),
    attach: t('omnibar.attach'),
    send: t('chat.tooltips.send'),
    stop: t('chat.tooltips.stop'),
    reset: t('chat.tooltips.reset'),
  };

  // Playbook type config with icons and labels (translated)
  const playbookTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    framework: { label: t('context.frameworks'), icon: <ScrollText size={12} /> },
    sop: { label: t('context.sops'), icon: <FileText size={12} /> },
    policy: { label: t('context.policies'), icon: <Shield size={12} /> },
    other: { label: t('context.other'), icon: <BookOpen size={12} /> },
  };

  // Popover states for context icons
  const [companyOpen, setCompanyOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const isMobile = isMobileDevice();
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

  // Get selected company name for display
  const selectedCompanyName = selectedBusiness
    ? businesses.find((b) => b.id === selectedBusiness)?.name
    : null;

  // Get selected project name for display
  const selectedProjectName = selectedProject
    ? projects.find((p) => p.id === selectedProject)?.name
    : null;

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

  const currentPlaceholder =
    placeholder || (chatMode === 'chat' ? t('omnibar.placeholderChat') : t('omnibar.placeholder'));

  const hasContent = value.trim().length > 0 || hasImages;

  // Toggle helpers for context selections
  const toggleDepartment = (id: string) => {
    if (!onSelectDepartments) return;
    const isAdding = !selectedDepartments.includes(id);
    const dept = departments.find((d) => d.id === id);
    const newSelection = isAdding
      ? [...selectedDepartments, id]
      : selectedDepartments.filter((d) => d !== id);
    onSelectDepartments(newSelection);

    // Show feedback toast
    if (dept) {
      toast.success(isAdding ? t('context.departmentAdded', { name: dept.name }) : t('context.departmentRemoved', { name: dept.name }));
    }
  };

  const toggleRole = (id: string) => {
    if (!onSelectRoles) return;
    const isAdding = !selectedRoles.includes(id);
    const role = roles.find((r) => r.id === id);
    const newSelection = isAdding
      ? [...selectedRoles, id]
      : selectedRoles.filter((r) => r !== id);
    onSelectRoles(newSelection);

    // Show feedback toast
    if (role) {
      toast.success(isAdding ? t('context.roleAdded', { name: role.name }) : t('context.roleRemoved', { name: role.name }));
    }
  };

  const togglePlaybook = (id: string) => {
    if (!onSelectPlaybooks) return;
    const isAdding = !selectedPlaybooks.includes(id);
    const playbook = playbooks.find((p) => p.id === id);
    const newSelection = isAdding
      ? [...selectedPlaybooks, id]
      : selectedPlaybooks.filter((p) => p !== id);
    onSelectPlaybooks(newSelection);

    // Show feedback toast
    if (playbook) {
      toast.success(isAdding ? t('context.playbookAdded', { name: playbook.name }) : t('context.playbookRemoved', { name: playbook.name }));
    }
  };

  // Company list content - single select (radio-style)
  const companyList = (
    <div className="context-popover-list">
      {businesses.length === 0 ? (
        <div className="context-popover-empty">{t('omnibar.noCompanies')}</div>
      ) : (
        businesses.map((biz) => {
          const isSelected = selectedBusiness === biz.id;
          return (
            <button
              key={biz.id}
              className={cn('context-popover-item', isSelected && 'selected')}
              onClick={() => {
                const isAdding = !isSelected;
                onSelectBusiness?.(isAdding ? biz.id : null);
                setCompanyOpen(false);
                // Show feedback toast
                toast.success(isAdding ? t('context.companySelected', { name: biz.name }) : t('context.companyCleared'));
              }}
              type="button"
            >
              <div className={cn('context-popover-radio', isSelected && 'checked')}>
                {isSelected && <Check size={10} />}
              </div>
              <span>{biz.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Project list content - single select (radio-style like company)
  const projectList = (
    <div className="context-popover-list">
      {projects.length === 0 ? (
        <div className="context-popover-empty">{t('context.noProjects')}</div>
      ) : (
        projects
          .filter((p) => p.status === 'active')
          .map((proj) => {
            const isSelected = selectedProject === proj.id;
            return (
              <button
                key={proj.id}
                className={cn('context-popover-item', isSelected && 'selected')}
                onClick={() => {
                  const isAdding = !isSelected;
                  onSelectProject?.(isAdding ? proj.id : null);
                  setProjectOpen(false);
                  // Show feedback toast
                  toast.success(isAdding ? t('context.projectSelected', { name: proj.name }) : t('context.projectCleared'));
                }}
                type="button"
              >
                <div className={cn('context-popover-radio', isSelected && 'checked')}>
                  {isSelected && <Check size={10} />}
                </div>
                <span>{proj.name}</span>
              </button>
            );
          })
      )}
    </div>
  );

  // Department list content - uses shared DepartmentCheckboxItem
  const departmentList = (
    <>
      <div className="context-popover-list">
        {departments.length === 0 ? (
          <div className="context-popover-empty">{t('context.noDepartments')}</div>
        ) : (
          departments.map((dept) => (
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
      {departments.length > 0 && (
        <div className="context-popover-help">
          {t('context.multiSelectHelp')}
        </div>
      )}
    </>
  );

  // Role list content
  const roleList = (
    <>
      <div className="context-popover-list">
        {roles.length === 0 ? (
          <div className="context-popover-empty">{t('context.noRoles')}</div>
        ) : (
          roles.map((role) => {
            const isSelected = selectedRoles.includes(role.id);
            return (
              <button
                key={role.id}
                className={cn('context-popover-item', isSelected && 'selected')}
                onClick={() => toggleRole(role.id)}
                type="button"
              >
                <div className={cn('context-popover-checkbox', isSelected && 'checked')}>
                  {isSelected && <Check size={12} />}
                </div>
                <span>{role.name}</span>
              </button>
            );
          })
        )}
      </div>
      {roles.length > 0 && (
        <div className="context-popover-help">
          {t('context.multiRoleHelp')}
        </div>
      )}
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

  const playbookTypeOrder = ['framework', 'sop', 'policy', 'other'];

  const toggleSection = (type: string) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const getSelectedCount = (type: string) => {
    const items = groupedPlaybooks[type] ?? [];
    return items.filter((pb) => selectedPlaybooks.includes(pb.id)).length;
  };

  // Playbook list content - grouped by type with collapsible sections
  const playbookList = (
    <>
      <div className="context-popover-list">
        {playbooks.length === 0 ? (
          <div className="context-popover-empty">{t('context.noPlaybooks')}</div>
        ) : (
          playbookTypeOrder
            .filter((type) => (groupedPlaybooks[type]?.length ?? 0) > 0)
            .map((type) => {
              const config = playbookTypeConfig[type]!;
              const items = groupedPlaybooks[type] ?? [];
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
                      {items.map((pb) => {
                        const isSelected = selectedPlaybooks.includes(pb.id);
                        return (
                          <button
                            key={pb.id}
                            className={cn('context-popover-item', isSelected && 'selected')}
                            onClick={() => togglePlaybook(pb.id)}
                            type="button"
                          >
                            <div className={cn('context-popover-checkbox', isSelected && 'checked')}>
                              {isSelected && <Check size={12} />}
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
      {playbooks.length > 0 && (
        <div className="context-popover-help">
          {t('context.multiPlaybookHelp')}
        </div>
      )}
    </>
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

  // Render context icon with popover
  const renderContextIcon = (
    icon: React.ReactNode,
    label: string,
    tooltipText: string,
    count: number,
    open: boolean,
    setOpen: (open: boolean) => void,
    content: React.ReactNode,
    colorClass?: string,
    onClear?: () => void
  ) => {
    const iconButton = (
      <button
        type="button"
        className={cn('omni-icon-btn no-touch-target', count > 0 && 'has-selection', colorClass)}
        onClick={() => (isMobile ? setOpen(true) : undefined)}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
        {count > 0 && <span className="omni-icon-badge">{count}</span>}
      </button>
    );

    // Wrap button with label for better UX
    const iconWithLabel = (
      <div className="omni-icon-with-label">
        {iconButton}
        <span className="omni-icon-label">{label}</span>
      </div>
    );

    // Header with optional Clear button
    const header = (
      <div className="context-popover-header">
        <span>{label}</span>
        {count > 0 && onClear && (
          <button
            type="button"
            className="context-popover-clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            {t('common.clear')}
          </button>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <>
          {iconWithLabel}
          <BottomSheet
            isOpen={open}
            onClose={() => setOpen(false)}
            title={label}
            headerAction={
              count > 0 && onClear ? (
                <button
                  type="button"
                  className="context-popover-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                >
                  {t('common.clear')}
                </button>
              ) : undefined
            }
          >
            {content}
          </BottomSheet>
        </>
      );
    }

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Provider delayDuration={400}>
          <Tooltip.Root>
            <Popover.Trigger asChild>
              <Tooltip.Trigger asChild>
                <div>{iconWithLabel}</div>
              </Tooltip.Trigger>
            </Popover.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" sideOffset={8}>
                {tooltipText}
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        <Popover.Portal>
          <Popover.Content
            className="context-popover-content"
            side="top"
            align="start"
            sideOffset={8}
            onInteractOutside={(e) => {
              // Don't close if clicking the theme toggle
              const target = e.target as HTMLElement;
              if (target.closest('.theme-toggle-container')) {
                e.preventDefault();
              }
            }}
          >
            {header}
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  };

  const containerClasses = cn(
    'omni-bar-wrapper',
    variant === 'landing' && 'omni-bar-landing',
    variant === 'compact' && 'omni-bar-compact',
    hasContent && 'has-content',
    isLoading && 'is-loading',
    hasAnyContextIcons && 'has-context-icons',
    isCouncilMode && hasAnyContextIcons && 'council-mode',
    className
  );

  return (
    <div className={containerClasses}>
      {/* Mode toggle - only for landing variant when showModeToggle is true */}
      {showModeToggle && variant === 'landing' && onChatModeChange && (
        <div className="omni-mode-toggle" role="radiogroup" aria-label="Response mode">
          <button
            type="button"
            name="response-mode"
            className={`omni-mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
            onClick={() => onChatModeChange('chat')}
            role="radio"
            aria-checked={chatMode === 'chat'}
          >
            {t('omnibar.oneAI')}
          </button>
          <button
            type="button"
            name="response-mode"
            className={`omni-mode-btn ${chatMode === 'council' ? 'active' : ''}`}
            onClick={() => onChatModeChange('council')}
            role="radio"
            aria-checked={chatMode === 'council'}
          >
            {t('omnibar.multiAI', { count: aiCount })}
          </button>
        </div>
      )}

      <div className="omni-bar noise-overlay">
        {/* Top row: Textarea */}
        <div className="omni-bar-top">
          <TextareaAutosize
            ref={textareaRef}
            id="omni-bar-input"
            name="omni-query"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentPlaceholder}
            className="omni-bar-input"
            minRows={1}
            maxRows={6}
            disabled={isLoading}
          />

          {/* Keyboard shortcut hint - top right */}
          <AnimatePresence>
            {showShortcutHint && !hasContent && !isLoading && variant === 'landing' && (
              <motion.kbd
                className="omni-bar-kbd"
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
        <div className="omni-bar-bottom">
          {/* Left side: Context icons */}
          <div className="omni-bar-left">
            {hasAnyContextIcons && (
              <>
                {/* Context icons capsule - groups related icons visually */}
                <div className="context-icons-capsule">
                  {hasBusinesses &&
                    renderContextIcon(
                      <Briefcase size={16} />,
                      selectedCompanyName || t('context.company'),
                      TOOLTIPS.company,
                      selectedBusiness ? 1 : 0,
                      companyOpen,
                      setCompanyOpen,
                      companyList,
                      'company',
                      () => onSelectBusiness?.(null)
                    )}
                  {hasProjects &&
                    renderContextIcon(
                      <FolderKanban size={16} />,
                      selectedProjectName || t('context.project'),
                      TOOLTIPS.projects,
                      selectedProject ? 1 : 0,
                      projectOpen,
                      setProjectOpen,
                      projectList,
                      'project',
                      () => onSelectProject?.(null)
                    )}
                  {hasDepartments &&
                    renderContextIcon(
                      <Building2 size={16} />,
                      t('departments.title'),
                      TOOLTIPS.departments,
                      selectedDepartments.length,
                      deptOpen,
                      setDeptOpen,
                      departmentList,
                      'dept',
                      () => onSelectDepartments?.([])
                    )}
                  {hasRoles &&
                    renderContextIcon(
                      <Users size={16} />,
                      t('roles.title'),
                      TOOLTIPS.roles,
                      selectedRoles.length,
                      roleOpen,
                      setRoleOpen,
                      roleList,
                      'role',
                      () => onSelectRoles?.([])
                    )}
                  {hasPlaybooks &&
                    renderContextIcon(
                      <BookOpen size={16} />,
                      t('context.playbooks'),
                      TOOLTIPS.playbooks,
                      selectedPlaybooks.length,
                      playbookOpen,
                      setPlaybookOpen,
                      playbookList,
                      'playbook',
                      () => onSelectPlaybooks?.([])
                    )}
                </div>

                {/* Reset All button - outside capsule, smaller */}
                {hasAnySelections &&
                  onResetAll &&
                  withTooltip(
                    <button
                      type="button"
                      className="omni-reset-all"
                      onClick={onResetAll}
                      disabled={disabled}
                      aria-label="Reset all selections"
                    >
                      <RotateCcw size={12} />
                    </button>,
                    TOOLTIPS.reset
                  )}

                {/* Inline mode toggle - compact pill that toggles on any click */}
                {onChatModeChange && !showModeToggle && (
                  <button
                    type="button"
                    className="omni-inline-mode-toggle no-touch-target"
                    onClick={() => {
                      if (!disabled) {
                        // Toggle between modes
                        onChatModeChange(chatMode === 'chat' ? 'council' : 'chat');
                      }
                    }}
                    disabled={disabled}
                    aria-label={`Response mode: ${chatMode === 'chat' ? t('omnibar.oneAI') : t('omnibar.multiAI', { count: aiCount })}. Click to toggle.`}
                  >
                    <span
                      className={cn(
                        'inline-mode-btn no-touch-target',
                        chatMode === 'chat' && 'active'
                      )}
                      aria-hidden="true"
                    >
                      {t('omnibar.oneAI')}
                    </span>
                    <span
                      className={cn(
                        'inline-mode-btn no-touch-target',
                        chatMode === 'council' && 'active'
                      )}
                      aria-hidden="true"
                    >
                      {t('omnibar.multiAI', { count: aiCount })}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right side: Response Style + Attach + Send */}
          <div className="omni-bar-right">
            {/* Response Style Selector - compact icon (right side like Perplexity) */}
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

            {/* Image attach button */}
            {showImageButton &&
              onImageClick &&
              withTooltip(
                <button
                  type="button"
                  className="omni-icon-btn attach"
                  onClick={onImageClick}
                  disabled={isLoading}
                  aria-label="Attach image"
                >
                  <ImageIcon size={18} />
                </button>,
                TOOLTIPS.attach
              )}

            {/* Submit/Stop button */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.button
                  key="stop"
                  type="button"
                  className="omni-bar-submit omni-bar-stop"
                  onClick={onStop}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={springs.snappy}
                  whileTap={interactionStates.buttonTap}
                >
                  <StopCircle className="h-5 w-5" />
                </motion.button>
              ) : (
                <motion.button
                  key="submit"
                  type="submit"
                  className={cn('omni-bar-submit', hasContent && 'active')}
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
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OmniBar;
