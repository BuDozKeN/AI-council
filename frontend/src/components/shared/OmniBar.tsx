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
  Zap,
  Check,
  FileText,
  ScrollText,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { springs, interactionStates } from '../../lib/animations';
import { BottomSheet } from '../ui/BottomSheet';
import { DepartmentCheckboxItem } from '../ui/DepartmentCheckboxItem';
import type { Business, Department, Role, Playbook } from '../../types/business';
import './OmniBar.css';

// Rotating placeholder examples for empty state
const PLACEHOLDER_EXAMPLES = [
  "How should I price my SaaS product?",
  "Draft a response to this customer complaint...",
  "What's the best approach to entering a new market?",
  "Review this contract for potential risks...",
  "Help me plan a product launch strategy",
  "How do I handle a difficult employee situation?",
];

// Mom-friendly tooltip descriptions - actionable, clear
const TOOLTIPS = {
  company: "Choose which company's context to use",
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
  hasImages?: boolean;
  onImageClick?: () => void;
  showImageButton?: boolean;

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
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  roles = [],
  selectedRoles = [],
  onSelectRoles,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
}: OmniBarProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Popover states for context icons
  const [companyOpen, setCompanyOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const isMobile = isMobileDevice();
  const disabled = isLoading;
  const isCouncilMode = chatMode === 'council';

  // Check if we have context data to show icons
  const hasBusinesses = businesses.length > 0 && onSelectBusiness;
  const hasDepartments = departments.length > 0 && onSelectDepartments;
  const hasRoles = roles.length > 0 && onSelectRoles;
  const hasPlaybooks = playbooks.length > 0 && onSelectPlaybooks;
  const hasAnyContextIcons = showContextIcons && (hasBusinesses || hasDepartments || hasRoles || hasPlaybooks);

  // Get selected company name for display
  const selectedCompanyName = selectedBusiness
    ? businesses.find(b => b.id === selectedBusiness)?.name
    : null;

  // Rotate placeholder text
  useEffect(() => {
    if (variant !== 'landing' || value.trim()) return;

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [variant, value]);

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

  const currentPlaceholder = placeholder ||
    (variant === 'landing' ? PLACEHOLDER_EXAMPLES[placeholderIndex] :
     chatMode === 'chat' ? "Quick follow-up..." : "Ask the council...");

  const hasContent = value.trim().length > 0 || hasImages;

  // Toggle helpers for context selections
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

  // Company list content - single select (radio-style)
  const companyList = (
    <div className="context-popover-list">
      {businesses.length === 0 ? (
        <div className="context-popover-empty">No companies</div>
      ) : (
        businesses.map(biz => {
          const isSelected = selectedBusiness === biz.id;
          return (
            <button
              key={biz.id}
              className={cn("context-popover-item", isSelected && "selected")}
              onClick={() => {
                onSelectBusiness?.(isSelected ? null : biz.id);
                setCompanyOpen(false);
              }}
              type="button"
            >
              <div className={cn("context-popover-radio", isSelected && "checked")}>
                {isSelected && <Check size={10} />}
              </div>
              <span>{biz.name}</span>
            </button>
          );
        })
      )}
    </div>
  );

  // Department list content - uses shared DepartmentCheckboxItem
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

  const playbookTypeOrder = ['framework', 'sop', 'policy', 'other'];

  const toggleSection = (type: string) => {
    setExpandedSections(prev => ({ ...prev, [type]: !prev[type] }));
  };

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

  const containerClasses = cn(
    "omni-bar-wrapper",
    variant === 'landing' && "omni-bar-landing",
    variant === 'compact' && "omni-bar-compact",
    hasContent && "has-content",
    isLoading && "is-loading",
    hasAnyContextIcons && "has-context-icons",
    isCouncilMode && hasAnyContextIcons && "council-mode",
    className
  );

  return (
    <div className={containerClasses}>
      {/* Mode toggle - only for landing variant when showModeToggle is true */}
      {showModeToggle && variant === 'landing' && onChatModeChange && (
        <div className="omni-mode-toggle">
          <button
            type="button"
            className={`omni-mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
            onClick={() => onChatModeChange('chat')}
          >
            Quick
          </button>
          <button
            type="button"
            className={`omni-mode-btn ${chatMode === 'council' ? 'active' : ''}`}
            onClick={() => onChatModeChange('council')}
          >
            Full Council
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
                {hasBusinesses && renderContextIcon(
                  <Briefcase size={16} />,
                  selectedCompanyName || "Company",
                  TOOLTIPS.company,
                  selectedBusiness ? 1 : 0,
                  companyOpen,
                  setCompanyOpen,
                  companyList,
                  "company"
                )}
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

                {/* Mode toggle icon */}
                {onChatModeChange && withTooltip(
                  <button
                    type="button"
                    className={cn("omni-icon-btn mode-toggle", isCouncilMode && "council")}
                    onClick={() => !disabled && onChatModeChange(chatMode === 'chat' ? 'council' : 'chat')}
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
          <div className="omni-bar-right">
            {/* Image attach button */}
            {showImageButton && onImageClick && withTooltip(
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
                  className={cn("omni-bar-submit", hasContent && "active")}
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
