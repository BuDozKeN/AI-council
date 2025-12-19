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
        {/* Smart Auto option */}
        <div className="context-section">
          <button
            className={`context-option smart-auto ${isSmartAuto ? 'active' : ''}`}
            onClick={handleSmartAuto}
          >
            <div className="context-option-radio">
              {isSmartAuto && <div className="context-option-radio-dot" />}
            </div>
            <div className="context-option-content">
              <div className="context-option-label">
                <Sparkles size={14} />
                <span>Smart Auto</span>
              </div>
              <p className="context-option-desc">
                Routes based on your last activity
              </p>
              {isSmartAuto && userPreferences?.last_company_id && (
                <p className="context-option-current">
                  Currently: {businesses.find(b => b.id === userPreferences.last_company_id)?.name || 'Company'}
                </p>
              )}
            </div>
          </button>
        </div>

        {/* Recent & Pinned presets */}
        {recentContexts.length > 0 && (
          <div className="context-section">
            <h4 className="context-section-title">Recent & Pinned</h4>
            <div className="context-presets">
              {recentContexts.slice(0, 3).map((preset, index) => (
                <button
                  key={index}
                  className="context-preset"
                  onClick={() => handlePresetSelect(preset)}
                >
                  <Briefcase size={14} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced context selection */}
        <div className="context-section context-advanced">
          <details className="context-advanced-details">
            <summary className="context-advanced-summary">
              <ChevronDown size={14} className="context-advanced-chevron" />
              <span>Advanced context</span>
            </summary>

            <div className="context-advanced-content">
              {/* Company selector */}
              {businesses.length > 0 && (
                <div className="context-field">
                  <label className="context-field-label">
                    <Building2 size={12} />
                    Company
                  </label>
                  <Select
                    value={selectedBusiness || '__none__'}
                    onValueChange={(v) => onSelectBusiness?.(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger className="context-field-select">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No company</SelectItem>
                      {businesses.map((biz) => (
                        <SelectItem key={biz.id} value={biz.id}>
                          {biz.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Department & Role multi-select */}
              {selectedBusiness && departments.length > 0 && (
                <div className="context-field">
                  <label className="context-field-label">
                    <Users size={12} />
                    Departments & Roles
                  </label>
                  <div className="context-field-multi">
                    <MultiDepartmentSelect
                      value={selectedDepartments}
                      onValueChange={onSelectDepartments}
                      departments={departments}
                      placeholder="Departments..."
                      className="context-multi-select"
                    />
                    {allRoles.length > 0 && (
                      <MultiRoleSelect
                        value={selectedRoles}
                        onValueChange={onSelectRoles}
                        roles={allRoles}
                        placeholder="Roles..."
                        className="context-multi-select"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Project selector */}
              {selectedBusiness && projects.length > 0 && (
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
              {selectedBusiness && playbooks.length > 0 && (
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
