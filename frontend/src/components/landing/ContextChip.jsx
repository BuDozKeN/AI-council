/**
 * ContextChip - Displays current context and triggers popover for selection
 *
 * Shows "Using: Smart Auto" or specific context like "Marketing · CMO"
 * Clicking opens ContextPopover for full control.
 */

import { useState } from 'react';
import { ChevronDown, Sparkles, Building2, Users, Briefcase, BookOpen } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MultiDepartmentSelect } from '../ui/MultiDepartmentSelect';
import { MultiRoleSelect } from '../ui/MultiRoleSelect';
import { MultiPlaybookSelect } from '../ui/MultiPlaybookSelect';
import './ContextChip.css';

export function ContextChip({
  displayText = 'Smart Auto',
  isSmartAuto = true,
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
  userPreferences,
  onUpdatePreferences,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Get recent contexts from preferences (mock for now)
  const recentContexts = userPreferences?.pinned_contexts || [];

  // Handle Smart Auto selection
  const handleSmartAuto = () => {
    // Clear all selections - will use last-used from preferences
    onSelectBusiness?.(null);
    onSelectDepartments?.([]);
    onSelectRoles?.([]);
    onSelectProject?.(null);
    onSelectPlaybooks?.([]);
    setIsOpen(false);
  };

  // Handle preset selection
  const handlePresetSelect = (preset) => {
    if (preset.company_id) onSelectBusiness?.(preset.company_id);
    if (preset.department_ids) onSelectDepartments?.(preset.department_ids);
    if (preset.role_ids) onSelectRoles?.(preset.role_ids);
    if (preset.project_id) onSelectProject?.(preset.project_id);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="context-chip-trigger">
          {isSmartAuto ? (
            <Sparkles className="context-chip-icon sparkle" size={14} />
          ) : (
            <Building2 className="context-chip-icon" size={14} />
          )}
          <span className="context-chip-label">Using:</span>
          <span className="context-chip-value">{displayText}</span>
          <ChevronDown className="context-chip-chevron" size={14} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="context-popover" align="end" sideOffset={8}>
        {/* Company selection - always visible */}
        {businesses.length > 0 && (
          <div className="context-section">
            <h4 className="context-section-title">Company</h4>
            <div className="context-companies">
              {businesses.map((biz) => (
                <button
                  key={biz.id}
                  className={`context-company-btn ${selectedBusiness === biz.id ? 'active' : ''}`}
                  onClick={() => onSelectBusiness?.(biz.id)}
                >
                  <Building2 size={16} />
                  <span>{biz.name}</span>
                  {selectedBusiness === biz.id && (
                    <svg className="context-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Department & Role selection - show when company selected */}
        {selectedBusiness && departments.length > 0 && (
          <div className="context-section">
            <h4 className="context-section-title">Focus Area</h4>
            <div className="context-field-multi">
              <MultiDepartmentSelect
                value={selectedDepartments}
                onValueChange={onSelectDepartments}
                departments={departments}
                placeholder="All departments"
                className="context-multi-select"
              />
              {allRoles.length > 0 && (
                <MultiRoleSelect
                  value={selectedRoles}
                  onValueChange={onSelectRoles}
                  roles={allRoles}
                  placeholder="All roles"
                  className="context-multi-select"
                />
              )}
            </div>
          </div>
        )}

        {/* Project & Playbooks - collapsible advanced */}
        {selectedBusiness && (projects.length > 0 || playbooks.length > 0) && (
          <div className="context-section context-advanced">
            <details className="context-advanced-details">
              <summary className="context-advanced-summary">
                <ChevronDown size={14} className="context-advanced-chevron" />
                <span>Project & Playbooks</span>
              </summary>

              <div className="context-advanced-content">
                {/* Project selector */}
                {projects.length > 0 && (
                  <div className="context-field">
                    <label className="context-field-label">
                      <Briefcase size={12} />
                      Project
                    </label>
                    <Select
                      value={selectedProject || '__none__'}
                      onValueChange={(v) => onSelectProject?.(v === '__none__' ? null : v)}
                    >
                      <SelectTrigger className="context-field-select">
                        <SelectValue placeholder="Company-wide" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Company-wide</SelectItem>
                        {projects.map((proj) => (
                          <SelectItem key={proj.id} value={proj.id}>
                            {proj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Playbooks selector */}
                {playbooks.length > 0 && (
                  <div className="context-field">
                    <label className="context-field-label">
                      <BookOpen size={12} />
                      Playbooks
                    </label>
                    <MultiPlaybookSelect
                      value={selectedPlaybooks}
                      onValueChange={onSelectPlaybooks}
                      playbooks={playbooks}
                      placeholder="Select playbooks..."
                      className="context-multi-select"
                    />
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Use this context button */}
        <button
          className="context-apply-btn"
          onClick={() => setIsOpen(false)}
        >
          Use this context
        </button>
      </PopoverContent>
    </Popover>
  );
}

export default ContextChip;
