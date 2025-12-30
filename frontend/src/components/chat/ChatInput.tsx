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
import { Building2, Users, BookOpen, Zap, Check, ImageIcon, FileText, ScrollText, Shield, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from '../ui/BottomSheet';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import type { ReactNode, KeyboardEvent, ClipboardEvent } from 'react';
import type { Department, Role, Playbook } from '../../types/business';

// Mom-friendly tooltip descriptions - actionable, clear
const TOOLTIPS = {
  departments: "Include your team's expertise in the answer",
  roles: "Add specific expert perspectives (CEO, Analyst, etc.)",
  playbooks: "Apply your company's guides to the answer",
  councilMode: "Multiple AI experts discuss and give you a combined answer",
  chatMode: "Quick answer from one AI — faster, simpler",
  attach: "Add a photo or screenshot",
  send: "Send your question",
  stop: "Stop the AI from writing more",
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
  departments?: Department[];
  selectedDepartments?: string[];
  onSelectDepartments?: (ids: string[]) => void;
  roles?: Role[];
  selectedRoles?: string[];
  onSelectRoles?: (ids: string[]) => void;
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks?: (ids: string[]) => void;
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
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  roles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
}: ChatInputProps) {
  const [deptOpen, setDeptOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  // Track which playbook sections are expanded (accordion within dropdown)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Dynamic placeholder based on mode and state
  const placeholder = !hasMessages
    ? "Ask the council a question..."
    : chatMode === 'council'
      ? "Ask a follow-up (council will discuss)..."
      : "Ask a quick follow-up...";

  const canSend = input.trim() || hasImages;
  const disabled = isLoading;
  const isMobile = isMobileDevice();
  const isCouncilMode = chatMode === 'council';

  // Show context icons only for follow-ups
  const showContextIcons = hasMessages && onChatModeChange;
  const hasDepartments = departments.length > 0 && onSelectDepartments;
  const hasRoles = roles.length > 0 && onSelectRoles;
  const hasPlaybooks = playbooks.length > 0 && onSelectPlaybooks;

  // Toggle helpers
  const toggleDepartment = (id: string) => {
    if (!onSelectDepartments) return;
    const newSelection = selectedDepartments.includes(id)
      ? selectedDepartments.filter(d => d !== id)
      : [...selectedDepartments, id];
    onSelectDepartments(newSelection);
  };

  const toggleRole = (id: string) => {
    if (!onSelectRoles) return;
    const newSelection = selectedRoles.includes(id)
      ? selectedRoles.filter(r => r !== id)
      : [...selectedRoles, id];
    onSelectRoles(newSelection);
  };

  const togglePlaybook = (id: string) => {
    if (!onSelectPlaybooks) return;
    const newSelection = selectedPlaybooks.includes(id)
      ? selectedPlaybooks.filter(p => p !== id)
      : [...selectedPlaybooks, id];
    onSelectPlaybooks(newSelection);
  };

  // Department list content - uses shared DepartmentCheckboxItem for consistency with Stage3
  const departmentList = (
    <div className="context-popover-list">
      {departments.length === 0 ? (
        <div className="context-popover-empty">No departments</div>
      ) : (
        departments.map(dept => (
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
        roles.map(role => {
          const isSelected = selectedRoles.includes(role.id);
          return (
            <button
              key={role.id}
              className={cn("context-popover-item", isSelected && "selected")}
              onClick={() => toggleRole(role.id)}
              type="button"
            >
              <div className={cn("context-popover-checkbox", isSelected && "checked")}>
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
  const groupedPlaybooks = playbooks.reduce((acc, pb) => {
    const type = pb.type || pb.doc_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(pb);
    return acc;
  }, {} as Record<string, Playbook[]>);

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
    setExpandedSections(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Count selected items per type
  const getSelectedCount = (type: string) => {
    const items = groupedPlaybooks[type] ?? [];
    return items.filter(pb => selectedPlaybooks.includes(pb.id)).length;
  };

  // Playbook list content - grouped by type with collapsible sections
  const playbookList = (
    <div className="context-popover-list">
      {playbooks.length === 0 ? (
        <div className="context-popover-empty">No playbooks</div>
      ) : (
        playbookTypeOrder
          .filter(type => (groupedPlaybooks[type]?.length ?? 0) > 0)
          .map(type => {
            const config = playbookTypeConfig[type]!;
            const items = groupedPlaybooks[type] ?? [];
            const isExpanded = expandedSections[type] ?? false;
            const selectedCount = getSelectedCount(type);
            return (
              <div key={type} className="context-popover-group">
                <button
                  type="button"
                  className={cn("context-popover-group-header clickable", type)}
                  onClick={() => toggleSection(type)}
                >
                  <ChevronRight
                    size={12}
                    className={cn("section-chevron", isExpanded && "expanded")}
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
                    {items.map(pb => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <button
                          key={pb.id}
                          className={cn("context-popover-item", isSelected && "selected")}
                          onClick={() => togglePlaybook(pb.id)}
                          type="button"
                        >
                          <div className={cn("context-popover-checkbox", isSelected && "checked")}>
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
        <Tooltip.Trigger asChild>
          {button}
        </Tooltip.Trigger>
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
    colorClass?: string
  ) => {
    const iconButton = (
      <button
        type="button"
        className={cn("omni-icon-btn", count > 0 && "has-selection", colorClass)}
        onClick={() => isMobile ? setOpen(true) : undefined}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
        {count > 0 && <span className="omni-icon-badge">{count}</span>}
      </button>
    );

    if (isMobile) {
      return (
        <>
          {withTooltip(iconButton, tooltipText)}
          <BottomSheet
            isOpen={open}
            onClose={() => setOpen(false)}
            title={label}
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
                {iconButton}
              </Tooltip.Trigger>
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
          <Popover.Content
            className="context-popover-content"
            align="start"
            sideOffset={8}
          >
            <div className="context-popover-header">{label}</div>
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

      <div className={cn("omnibar", isCouncilMode && showContextIcons && "council-mode")}>
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
                {hasDepartments && renderContextIcon(
                  <Building2 size={16} />,
                  "Departments",
                  TOOLTIPS.departments,
                  selectedDepartments.length,
                  deptOpen,
                  setDeptOpen,
                  departmentList,
                  "dept"
                )}
                {hasRoles && renderContextIcon(
                  <Users size={16} />,
                  "Roles",
                  TOOLTIPS.roles,
                  selectedRoles.length,
                  roleOpen,
                  setRoleOpen,
                  roleList,
                  "role"
                )}
                {hasPlaybooks && renderContextIcon(
                  <BookOpen size={16} />,
                  "Playbooks",
                  TOOLTIPS.playbooks,
                  selectedPlaybooks.length,
                  playbookOpen,
                  setPlaybookOpen,
                  playbookList,
                  "playbook"
                )}

                {/* Mode toggle */}
                {withTooltip(
                  <button
                    type="button"
                    className={cn("omni-icon-btn mode-toggle", isCouncilMode && "council")}
                    onClick={() => !disabled && onChatModeChange?.(chatMode === 'chat' ? 'council' : 'chat')}
                    disabled={disabled}
                    aria-label={isCouncilMode ? 'Council mode (click for quick chat)' : 'Quick mode (click for council)'}
                  >
                    <Zap size={16} />
                  </button>,
                  isCouncilMode ? TOOLTIPS.councilMode : TOOLTIPS.chatMode
                )}
              </>
            )}
          </div>

          {/* Right side: Attach + Send */}
          <div className="omni-right">
            {withTooltip(
              <button
                type="button"
                className="omni-icon-btn attach"
                onClick={imageUpload.openFilePicker}
                disabled={isLoading}
                aria-label="Attach image"
              >
                <ImageIcon size={18} />
              </button>,
              TOOLTIPS.attach
            )}

            {isLoading ? (
              withTooltip(
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
            ) : (
              withTooltip(
                <button
                  type="submit"
                  className={cn("omni-send-btn", canSend && "active")}
                  disabled={!canSend}
                  onClick={onSubmit}
                  aria-label="Send message"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="19" x2="12" y2="5"/>
                    <polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>,
                TOOLTIPS.send
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
