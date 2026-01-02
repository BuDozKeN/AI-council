/**
 * ChatInput - Omnibar with context icons, textarea, and action buttons
 *
 * All-in-one input row like Perplexity:
 * [🏢 👤 📋 ⚡ | Follow up...                    📎 ↑]
 *
 * Mom Test: Every icon has a clear tooltip explaining what it does
 */

import { useState } from 'react';
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
  FolderKanban,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from '../ui/BottomSheet';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import type { ReactNode, KeyboardEvent, ClipboardEvent } from 'react';
import type { Department, Role, Playbook, Project } from '../../types/business';

// Mom-friendly tooltip descriptions - actionable, clear
const TOOLTIPS = {
  projects: 'Focus the answer on a specific project',
  departments: "Include your team's expertise in the answer",
  roles: 'Add specific expert perspectives (CEO, Analyst, etc.)',
  playbooks: "Apply your company's guides to the answer",
  councilMode: 'Multiple AI experts discuss and give you a combined answer',
  chatMode: 'Quick answer from one AI — faster, simpler',
  send: 'Send your question',
  stop: 'Stop the AI from writing more',
  reset: 'Clear all selections',
};

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
}: ChatInputProps) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  // Track which playbook sections are expanded (accordion within dropdown)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Dynamic placeholder based on mode and state
  const placeholder = !hasMessages
    ? 'Ask the council a question...'
    : chatMode === 'council'
      ? 'Ask a follow-up (council will discuss)...'
      : 'Ask a quick follow-up...';

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

  // Project list content - single select (radio-style)
  const projectList = (
    <div className="context-popover-list">
      {projects.length === 0 ? (
        <div className="context-popover-empty">No projects</div>
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
                  onSelectProject?.(isSelected ? null : proj.id);
                  setProjectOpen(false);
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

  // Department list content - uses shared DepartmentCheckboxItem for consistency with Stage3
  const departmentList = (
    <div className="context-popover-list">
      {departments.length === 0 ? (
        <div className="context-popover-empty">No departments</div>
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
  );

  // Role list content
  const roleList = (
    <div className="context-popover-list">
      {roles.length === 0 ? (
        <div className="context-popover-empty">No roles</div>
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
    framework: { label: 'Frameworks', icon: <ScrollText size={12} /> },
    sop: { label: 'SOPs', icon: <FileText size={12} /> },
    policy: { label: 'Policies', icon: <Shield size={12} /> },
    other: { label: 'Other', icon: <BookOpen size={12} /> },
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
  const playbookList = (
    <div className="context-popover-list">
      {playbooks.length === 0 ? (
        <div className="context-popover-empty">No playbooks</div>
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
  );

  // Wrap button with tooltip for mom-friendly help
  const withTooltip = (button: React.ReactNode, tooltipText: string) => (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="omni-tooltip" sideOffset={8}>
            {tooltipText}
            <Tooltip.Arrow className="omni-tooltip-arrow" />
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
        className={cn('omni-icon-btn', count > 0 && 'has-selection', colorClass)}
        onClick={() => (isMobile ? setOpen(true) : undefined)}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
        {count > 0 && <span className="omni-icon-badge">{count}</span>}
      </button>
    );

    // Header with optional Clear button (matches OmniBar)
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
            Clear
          </button>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <>
          {withTooltip(iconButton, tooltipText)}
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
                  Clear
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
              <Tooltip.Trigger asChild>{iconButton}</Tooltip.Trigger>
            </Popover.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="omni-tooltip" sideOffset={8}>
                {tooltipText}
                <Tooltip.Arrow className="omni-tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        <Popover.Portal>
          <Popover.Content className="context-popover-content" align="start" sideOffset={8}>
            {header}
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  };

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
            id="chat-message-input"
            name="message"
            className="omni-input"
            placeholder={placeholder}
            aria-label="Message input"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
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
                {/* Context icons capsule - groups related icons visually */}
                <div className="context-icons-capsule">
                  {hasProjects &&
                    renderContextIcon(
                      <FolderKanban size={16} />,
                      selectedProjectName || 'Project',
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
                      'Departments',
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
                      'Roles',
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
                      'Playbooks',
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
                      className="omni-reset-all no-touch-target"
                      onClick={onResetAll}
                      disabled={disabled}
                      aria-label="Reset all selections"
                    >
                      <RotateCcw size={12} />
                    </button>,
                    TOOLTIPS.reset
                  )}

                {/* Mode toggle - clear "1 AI / 5 AIs" pill */}
                <div
                  className="omni-inline-mode-toggle"
                  role="radiogroup"
                  aria-label="Response mode"
                >
                  {withTooltip(
                    <button
                      type="button"
                      className={cn(
                        'inline-mode-btn no-touch-target',
                        chatMode === 'chat' && 'active'
                      )}
                      onClick={() => !disabled && onChatModeChange?.('chat')}
                      disabled={disabled}
                      role="radio"
                      aria-checked={chatMode === 'chat'}
                    >
                      1 AI
                    </button>,
                    TOOLTIPS.chatMode
                  )}
                  {withTooltip(
                    <button
                      type="button"
                      className={cn(
                        'inline-mode-btn no-touch-target',
                        chatMode === 'council' && 'active'
                      )}
                      onClick={() => !disabled && onChatModeChange?.('council')}
                      disabled={disabled}
                      role="radio"
                      aria-checked={chatMode === 'council'}
                    >
                      5 AIs
                    </button>,
                    TOOLTIPS.councilMode
                  )}
                </div>
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>,
                  TOOLTIPS.send
                )}
          </div>
        </div>
      </div>
    </>
  );
}
