/**
 * ContextChip - Displays current context and triggers popover for selection
 *
 * Shows "Using: Smart Auto" or specific context like "Marketing · CMO"
 * Clicking opens ContextPopover for full control.
 * On mobile: uses BottomSheet for better UX
 *
 * Structure:
 * - Company → Departments → Roles (always visible)
 * - Projects & Playbooks (behind "See more" toggle)
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Sparkles,
  Building2,
  Users,
  Briefcase,
  Check,
  FileText,
  ScrollText,
  Shield,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BottomSheet } from '../ui/BottomSheet';
import { getDeptColor } from '../../lib/colors';
import type {
  Business,
  Department,
  Role,
  Project,
  Playbook,
  UserPreferences,
} from '../../types/business';
import './ContextChip.css';

// Multi-select dropdown component for mobile
interface MultiSelectDropdownProps {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  items: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  getItemStyle?: (id: string, isSelected: boolean) => React.CSSProperties;
}

function MultiSelectDropdown({
  label,
  icon,
  placeholder,
  items,
  selectedIds,
  onToggle,
  getItemStyle,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen && !showTooltip) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;

      // Don't close if clicking on the backdrop (let backdrop handle closing the whole sheet)
      if (target.closest('.bottom-sheet-overlay')) {
        return;
      }

      // Don't close if clicking on the tooltip itself
      if (target.closest('.context-badge-tooltip-portal')) {
        return;
      }

      // Close if clicking outside this dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
        setShowTooltip(false);
      }
    };

    // Use capture phase to handle before other handlers
    // Cast to EventListener type (DOM global) for touchstart compatibility
    const handler = handleClickOutside as (e: Event) => void;
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handler, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [isOpen, showTooltip]);

  // Get selected item names for tooltip
  const selectedNames = selectedIds
    .map((id) => items.find((i) => i.id === id)?.name)
    .filter(Boolean) as string[];

  // Handle badge click to show tooltip
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Calculate position based on badge location
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 8, // 8px below the badge
        left: rect.left + rect.width / 2, // Center horizontally
      });
    }

    setShowTooltip(!showTooltip);
    setIsOpen(false); // Close dropdown if open
  };

  // Tooltip rendered via portal to escape overflow:hidden containers
  const tooltipContent =
    showTooltip &&
    tooltipPosition &&
    selectedNames.length > 0 &&
    createPortal(
      <div
        className="context-badge-tooltip-portal"
        style={{
          position: 'fixed',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translateX(-50%)',
          zIndex: 9999,
        }}
      >
        <div className="context-badge-tooltip-arrow" />
        {selectedNames.map((name, i) => (
          <div key={i} className="context-badge-tooltip-item">
            {name}
          </div>
        ))}
      </div>,
      document.body
    );

  return (
    <div className="context-field-mobile" ref={dropdownRef}>
      <label className="context-field-label-mobile">
        {label}
        {selectedIds.length > 0 && (
          <span className="context-badge-wrapper">
            <button
              ref={badgeRef}
              type="button"
              className="context-field-count"
              onClick={handleBadgeClick}
              aria-label={`${selectedIds.length} selected. Click to see list.`}
            >
              {selectedIds.length}
            </button>
          </span>
        )}
      </label>

      {/* Trigger button - simple "X selected" text */}
      <button
        type="button"
        className={`context-multiselect-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          setShowTooltip(false);
        }}
      >
        {icon}
        <span className="context-select-placeholder">
          {selectedIds.length === 0 ? placeholder : `${selectedIds.length} selected`}
        </span>
        <ChevronDown
          size={16}
          className={`context-multiselect-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <div className="context-multiselect-dropdown">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const style = getItemStyle ? getItemStyle(item.id, isSelected) : {};
            return (
              <button
                key={item.id}
                type="button"
                className={`context-multiselect-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggle(item.id)}
                style={style}
              >
                <span className="context-multiselect-item-text">{item.name}</span>
                {isSelected && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Tooltip via portal - escapes overflow:hidden */}
      {tooltipContent}
    </div>
  );
}

// Check if we're on mobile for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Extended role type that may include department_id from API
interface RoleWithDepartment extends Role {
  department_id?: string | undefined;
}

// Use the base Playbook type which already includes title and doc_type
type PlaybookWithVariants = Playbook;

// Normalized playbook for internal use
interface NormalizedPlaybook {
  id: string;
  name: string;
  type: 'framework' | 'sop' | 'policy';
}

interface ContextChipProps {
  displayText?: string | undefined;
  isSmartAuto?: boolean | undefined;
  smartAutoHint?: string | null | undefined;
  businesses?: Business[] | undefined;
  selectedBusiness: string | null;
  onSelectBusiness: (id: string | null) => void;
  departments?: Department[] | undefined;
  selectedDepartments?: string[] | undefined;
  onSelectDepartments: (ids: string[]) => void;
  allRoles?: RoleWithDepartment[] | undefined;
  selectedRoles?: string[] | undefined;
  onSelectRoles: (ids: string[]) => void;
  projects?: Project[] | undefined;
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  playbooks?: PlaybookWithVariants[] | undefined;
  selectedPlaybooks?: string[] | undefined;
  onSelectPlaybooks: (ids: string[]) => void;
  userPreferences?: UserPreferences | null | undefined;
}

export function ContextChip({
  displayText,
  isSmartAuto = true,
  smartAutoHint = null,
  businesses = [],
  selectedBusiness,
  onSelectBusiness,
  departments = [],
  selectedDepartments = [],
  onSelectDepartments,
  allRoles = [],
  selectedRoles = [],
  onSelectRoles,
  projects = [],
  selectedProject,
  onSelectProject,
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  userPreferences: _userPreferences,
}: ContextChipProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(isMobileDevice());
  const [showMore, setShowMore] = useState(false); // Toggle for Projects & Playbooks

  // Update mobile state on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(isMobileDevice());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-expand "See more" if user has project/playbook selections
  useEffect(() => {
    if (isOpen && (selectedProject || selectedPlaybooks.length > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing UI state with selections
      setShowMore(true);
    }
  }, [isOpen, selectedProject, selectedPlaybooks.length]);

  // Sort projects alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p && p.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [projects]);

  // Group playbooks by doc_type (framework, sop, policy)
  const groupedPlaybooks = useMemo(() => {
    const groups: Record<'framework' | 'sop' | 'policy', NormalizedPlaybook[]> = {
      framework: [],
      sop: [],
      policy: [],
    };
    playbooks.forEach((pb) => {
      const title = pb?.title || pb?.name;
      if (!pb || !title) return;
      const docType = (pb.doc_type || pb.type) as 'framework' | 'sop' | 'policy' | undefined;
      if (!docType || !groups[docType]) return;
      groups[docType].push({ id: pb.id, name: title, type: docType });
    });
    (Object.keys(groups) as Array<keyof typeof groups>).forEach((key) => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });
    return groups;
  }, [playbooks]);

  // Handle Smart Auto selection (used by UI components)

  const handleSmartAuto = () => {
    onSelectBusiness?.(null);
    onSelectDepartments?.([]);
    onSelectRoles?.([]);
    onSelectProject?.(null);
    onSelectPlaybooks?.([]);
    setIsOpen(false);
  };
  void handleSmartAuto; // Acknowledge the function exists for future use

  // Display text with Smart Auto hint
  const actualDisplayText = displayText || t('contextChip.smartAuto');
  const getDisplayWithHint = () => {
    if (isSmartAuto && smartAutoHint) {
      return `${t('contextChip.smartAuto')} · ${smartAutoHint}`;
    }
    return actualDisplayText;
  };

  // Toggle department selection
  const toggleDepartment = (deptId: string) => {
    if (selectedDepartments.includes(deptId)) {
      onSelectDepartments(selectedDepartments.filter((id) => id !== deptId));
    } else {
      onSelectDepartments([...selectedDepartments, deptId]);
    }
  };

  // Toggle role selection
  const toggleRole = (roleId: string) => {
    if (selectedRoles.includes(roleId)) {
      onSelectRoles(selectedRoles.filter((id) => id !== roleId));
    } else {
      onSelectRoles([...selectedRoles, roleId]);
    }
  };

  // Toggle playbook selection
  const togglePlaybook = (pbId: string) => {
    if (selectedPlaybooks.includes(pbId)) {
      onSelectPlaybooks(selectedPlaybooks.filter((id) => id !== pbId));
    } else {
      onSelectPlaybooks([...selectedPlaybooks, pbId]);
    }
  };

  // Trigger button
  const triggerButton = (
    <button className="context-chip-trigger" onClick={isMobile ? () => setIsOpen(true) : undefined}>
      {isSmartAuto ? (
        <Sparkles className="context-chip-icon sparkle" size={14} />
      ) : (
        <Building2 className="context-chip-icon" size={14} />
      )}
      <span className="context-chip-label">{t('contextChip.using')}</span>
      <span className="context-chip-value">{getDisplayWithHint()}</span>
      <ChevronDown className="context-chip-chevron" size={14} />
    </button>
  );

  // Get filtered roles based on selected department (for single-select mode)
  const filteredRoles = useMemo(() => {
    if (selectedDepartments.length === 0) return allRoles;
    return allRoles.filter(
      (role) => role.department_id && selectedDepartments.includes(role.department_id)
    );
  }, [allRoles, selectedDepartments]);

  // Helper to get department tag styles
  const getDeptTagStyle = (deptId: string, isSelected: boolean): React.CSSProperties => {
    if (!isSelected) return {};
    const colors = getDeptColor(deptId);
    return {
      '--tag-bg': colors.bg,
      '--tag-text': colors.text,
    } as React.CSSProperties;
  };

  // Desktop content - same dropdown pattern as mobile for consistency
  const renderDesktopContent = () => (
    <div className="context-desktop-wrapper">
      {/* Company - single select */}
      {businesses.length > 0 && (
        <div className="context-field-mobile">
          <label className="context-field-label-mobile">{t('context.company')}</label>
          <Select
            value={selectedBusiness || '__none__'}
            onValueChange={(v) => onSelectBusiness?.(v === '__none__' ? null : v)}
          >
            <SelectTrigger className="context-multiselect-trigger">
              <Building2 size={16} className="context-select-icon" />
              <SelectValue placeholder={t('contextChip.selectCompany')} />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((biz) => (
                <SelectItem key={biz.id} value={biz.id}>
                  {biz.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Departments - multi-select dropdown */}
      {selectedBusiness && departments.length > 0 && (
        <MultiSelectDropdown
          label={t('departments.title')}
          icon={<Users size={16} className="context-select-icon" />}
          placeholder={t('departments.allDepartments')}
          items={departments}
          selectedIds={selectedDepartments}
          onToggle={toggleDepartment}
          getItemStyle={getDeptTagStyle}
        />
      )}

      {/* Roles - multi-select dropdown */}
      {selectedBusiness && filteredRoles.length > 0 && (
        <MultiSelectDropdown
          label={t('roles.title')}
          icon={<Users size={16} className="context-select-icon" />}
          placeholder={t('roles.allRoles')}
          items={filteredRoles}
          selectedIds={selectedRoles}
          onToggle={toggleRole}
        />
      )}

      {/* Project - single select */}
      {selectedBusiness && projects.length > 0 && (
        <div className="context-field-mobile">
          <label className="context-field-label-mobile">{t('context.project')}</label>
          <Select
            value={selectedProject || '__none__'}
            onValueChange={(v) => onSelectProject?.(v === '__none__' ? null : v)}
          >
            <SelectTrigger className="context-multiselect-trigger">
              <Briefcase size={16} className="context-select-icon" />
              <SelectValue placeholder={t('company.companyWide')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('company.companyWide')}</SelectItem>
              {sortedProjects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Playbooks - behind toggle */}
      {selectedBusiness && playbooks.length > 0 && (
        <>
          <button
            type="button"
            className={`context-see-more-btn-mobile ${showMore ? 'expanded' : ''}`}
            onClick={() => setShowMore(!showMore)}
          >
            <FileText size={16} className="context-select-icon" />
            <span>{t('playbooks.title')}</span>
            {selectedPlaybooks.length > 0 && (
              <span className="context-more-badge">{selectedPlaybooks.length}</span>
            )}
            <ChevronDown
              size={16}
              className={`context-multiselect-chevron ${showMore ? 'rotated' : ''}`}
            />
          </button>

          {showMore && (
            <div className="context-playbooks-expanded">
              {groupedPlaybooks.framework.length > 0 && (
                <MultiSelectDropdown
                  label={t('context.frameworks')}
                  icon={<FileText size={16} className="context-select-icon" />}
                  placeholder={t('contextChip.noneSelected')}
                  items={groupedPlaybooks.framework}
                  selectedIds={selectedPlaybooks.filter((id) =>
                    groupedPlaybooks.framework.some((pb) => pb.id === id)
                  )}
                  onToggle={togglePlaybook}
                />
              )}

              {groupedPlaybooks.sop.length > 0 && (
                <MultiSelectDropdown
                  label={t('context.sops')}
                  icon={<ScrollText size={16} className="context-select-icon" />}
                  placeholder={t('contextChip.noneSelected')}
                  items={groupedPlaybooks.sop}
                  selectedIds={selectedPlaybooks.filter((id) =>
                    groupedPlaybooks.sop.some((pb) => pb.id === id)
                  )}
                  onToggle={togglePlaybook}
                />
              )}

              {groupedPlaybooks.policy.length > 0 && (
                <MultiSelectDropdown
                  label={t('context.policies')}
                  icon={<Shield size={16} className="context-select-icon" />}
                  placeholder={t('contextChip.noneSelected')}
                  items={groupedPlaybooks.policy}
                  selectedIds={selectedPlaybooks.filter((id) =>
                    groupedPlaybooks.policy.some((pb) => pb.id === id)
                  )}
                  onToggle={togglePlaybook}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Apply button */}
      <button className="context-apply-btn-mobile" onClick={() => setIsOpen(false)}>
        {t('contextChip.useThisContext')}
      </button>
    </div>
  );

  // Mobile content - proper multi-select dropdowns
  const renderMobileContent = () => (
    <div className="context-mobile-content">
      {/* Company - single select dropdown */}
      {businesses.length > 0 && (
        <div className="context-field-mobile">
          <label className="context-field-label-mobile">{t('context.company')}</label>
          <Select
            value={selectedBusiness || '__none__'}
            onValueChange={(v) => onSelectBusiness?.(v === '__none__' ? null : v)}
          >
            <SelectTrigger className="context-select-mobile">
              <Building2 size={16} className="context-select-icon" />
              <SelectValue placeholder={t('contextChip.selectCompany')} />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((biz) => (
                <SelectItem key={biz.id} value={biz.id}>
                  {biz.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Departments - multi-select */}
      {selectedBusiness && departments.length > 0 && (
        <MultiSelectDropdown
          label={t('departments.title')}
          icon={<Users size={16} className="context-select-icon" />}
          placeholder={t('departments.allDepartments')}
          items={departments}
          selectedIds={selectedDepartments}
          onToggle={toggleDepartment}
          getItemStyle={getDeptTagStyle}
        />
      )}

      {/* Roles - multi-select */}
      {selectedBusiness && filteredRoles.length > 0 && (
        <MultiSelectDropdown
          label={t('roles.title')}
          icon={<Users size={16} className="context-select-icon" />}
          placeholder={t('roles.allRoles')}
          items={filteredRoles}
          selectedIds={selectedRoles}
          onToggle={toggleRole}
        />
      )}

      {/* Project - single select dropdown */}
      {selectedBusiness && projects.length > 0 && (
        <div className="context-field-mobile">
          <label className="context-field-label-mobile">{t('context.project')}</label>
          <Select
            value={selectedProject || '__none__'}
            onValueChange={(v) => onSelectProject?.(v === '__none__' ? null : v)}
          >
            <SelectTrigger className="context-select-mobile">
              <Briefcase size={16} className="context-select-icon" />
              <SelectValue placeholder={t('company.companyWide')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('company.companyWide')}</SelectItem>
              {sortedProjects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Playbooks - behind toggle to reduce clutter */}
      {selectedBusiness && playbooks.length > 0 && (
        <>
          <button
            type="button"
            className={`context-see-more-btn-mobile ${showMore ? 'expanded' : ''}`}
            onClick={() => setShowMore(!showMore)}
          >
            <FileText size={16} className="context-select-icon" />
            <span>{t('playbooks.title')}</span>
            {selectedPlaybooks.length > 0 && (
              <span className="context-more-badge">{selectedPlaybooks.length}</span>
            )}
            <ChevronDown
              size={16}
              className={`context-multiselect-chevron ${showMore ? 'rotated' : ''}`}
            />
          </button>

          {showMore && (
            <div className="context-playbooks-expanded">
              {groupedPlaybooks.framework.length > 0 && (
                <MultiSelectDropdown
                  label={t('context.frameworks')}
                  icon={<FileText size={16} className="context-select-icon" />}
                  placeholder={t('contextChip.noneSelected')}
                  items={groupedPlaybooks.framework}
                  selectedIds={selectedPlaybooks.filter((id) =>
                    groupedPlaybooks.framework.some((pb) => pb.id === id)
                  )}
                  onToggle={togglePlaybook}
                />
              )}

              {groupedPlaybooks.sop.length > 0 && (
                <MultiSelectDropdown
                  label={t('context.sops')}
                  icon={<ScrollText size={16} className="context-select-icon" />}
                  placeholder={t('contextChip.noneSelected')}
                  items={groupedPlaybooks.sop}
                  selectedIds={selectedPlaybooks.filter((id) =>
                    groupedPlaybooks.sop.some((pb) => pb.id === id)
                  )}
                  onToggle={togglePlaybook}
                />
              )}

              {groupedPlaybooks.policy.length > 0 && (
                <MultiSelectDropdown
                  label={t('context.policies')}
                  icon={<Shield size={16} className="context-select-icon" />}
                  placeholder={t('contextChip.noneSelected')}
                  items={groupedPlaybooks.policy}
                  selectedIds={selectedPlaybooks.filter((id) =>
                    groupedPlaybooks.policy.some((pb) => pb.id === id)
                  )}
                  onToggle={togglePlaybook}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Use this context button */}
      <button className="context-apply-btn-mobile" onClick={() => setIsOpen(false)}>
        {t('contextChip.useThisContext')}
      </button>
    </div>
  );

  // Mobile: use BottomSheet
  if (isMobile) {
    return (
      <>
        {triggerButton}
        <BottomSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={t('contextChip.selectContext')}
        >
          {renderMobileContent()}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover with compact dropdowns
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>

      <PopoverContent
        className="context-popover-desktop"
        align="end"
        sideOffset={8}
        collisionPadding={16}
        side="bottom"
      >
        {renderDesktopContent()}
      </PopoverContent>
    </Popover>
  );
}

export default ContextChip;
