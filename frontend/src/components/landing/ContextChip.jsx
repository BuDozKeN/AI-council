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

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Building2, Users, Briefcase, Check, FileText, ScrollText, Shield } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BottomSheet } from '../ui/BottomSheet';
import { getDeptColor } from '../../lib/colors';
import './ContextChip.css';

// Check if we're on mobile for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

export function ContextChip({
  displayText = 'Smart Auto',
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
  userPreferences,
}) {
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
      setShowMore(true);
    }
  }, [isOpen, selectedProject, selectedPlaybooks.length]);

  // Sort projects alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects].filter(p => p && p.name).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [projects]);

  // Group playbooks by doc_type (framework, sop, policy)
  const groupedPlaybooks = useMemo(() => {
    const groups = { framework: [], sop: [], policy: [] };
    playbooks.forEach(pb => {
      const title = pb?.title || pb?.name;
      if (!pb || !title) return;
      const docType = pb.doc_type || pb.type;
      if (!docType || !groups[docType]) return;
      groups[docType].push({ ...pb, name: title });
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });
    return groups;
  }, [playbooks]);

  // Handle Smart Auto selection
  const handleSmartAuto = () => {
    onSelectBusiness?.(null);
    onSelectDepartments?.([]);
    onSelectRoles?.([]);
    onSelectProject?.(null);
    onSelectPlaybooks?.([]);
    setIsOpen(false);
  };

  // Display text with Smart Auto hint
  const getDisplayWithHint = () => {
    if (isSmartAuto && smartAutoHint) {
      return `Smart Auto · ${smartAutoHint}`;
    }
    return displayText;
  };

  // Toggle department selection
  const toggleDepartment = (deptId) => {
    if (selectedDepartments.includes(deptId)) {
      onSelectDepartments(selectedDepartments.filter(id => id !== deptId));
    } else {
      onSelectDepartments([...selectedDepartments, deptId]);
    }
  };

  // Toggle role selection
  const toggleRole = (roleId) => {
    if (selectedRoles.includes(roleId)) {
      onSelectRoles(selectedRoles.filter(id => id !== roleId));
    } else {
      onSelectRoles([...selectedRoles, roleId]);
    }
  };

  // Toggle playbook selection
  const togglePlaybook = (pbId) => {
    if (selectedPlaybooks.includes(pbId)) {
      onSelectPlaybooks(selectedPlaybooks.filter(id => id !== pbId));
    } else {
      onSelectPlaybooks([...selectedPlaybooks, pbId]);
    }
  };

  // Count of project/playbook selections for badge
  const moreCount = (selectedProject ? 1 : 0) + (selectedPlaybooks?.length || 0);

  // Trigger button
  const triggerButton = (
    <button
      className="context-chip-trigger"
      onClick={isMobile ? () => setIsOpen(true) : undefined}
    >
      {isSmartAuto ? (
        <Sparkles className="context-chip-icon sparkle" size={14} />
      ) : (
        <Building2 className="context-chip-icon" size={14} />
      )}
      <span className="context-chip-label">Using:</span>
      <span className="context-chip-value">{getDisplayWithHint()}</span>
      <ChevronDown className="context-chip-chevron" size={14} />
    </button>
  );

  // Get filtered roles based on selected department (for single-select mode)
  const filteredRoles = useMemo(() => {
    if (selectedDepartments.length === 0) return allRoles;
    return allRoles.filter(role => selectedDepartments.includes(role.department_id));
  }, [allRoles, selectedDepartments]);

  // Desktop content - compact with playbooks behind toggle
  const renderDesktopContent = () => (
    <div className="context-desktop-wrapper">
      {/* Company dropdown - STICKY at top, never scrolls away */}
      {businesses.length > 0 && (
        <div className="context-desktop-header">
          <div className="context-desktop-field">
            <label className="context-desktop-label">Company</label>
            <Select
              value={selectedBusiness || '__none__'}
              onValueChange={(v) => onSelectBusiness?.(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="context-desktop-select">
                <Building2 size={14} className="context-desktop-select-icon" />
                <SelectValue placeholder="Select company" />
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
        </div>
      )}

      {/* Scrollable content area */}
      <div className="context-desktop-content">
      {/* Departments - multi-select chips */}
      {selectedBusiness && departments.length > 0 && (
        <div className="context-desktop-field">
          <label className="context-desktop-label">Departments</label>
          <div className="context-desktop-chips">
            {departments.map((dept) => {
              const isSelected = selectedDepartments.includes(dept.id);
              const colors = getDeptColor(dept.id);
              return (
                <button
                  key={dept.id}
                  className={`context-desktop-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleDepartment(dept.id)}
                  style={{
                    '--chip-bg': isSelected ? colors.bg : undefined,
                    '--chip-border': isSelected ? colors.text : undefined,
                    '--chip-text': isSelected ? colors.text : undefined,
                  }}
                >
                  {dept.name}
                  {isSelected && <Check size={10} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Roles - multi-select chips */}
      {selectedBusiness && filteredRoles.length > 0 && (
        <div className="context-desktop-field">
          <label className="context-desktop-label">Roles</label>
          <div className="context-desktop-chips">
            {filteredRoles.map((role) => {
              const isSelected = selectedRoles.includes(role.id);
              return (
                <button
                  key={role.id}
                  className={`context-desktop-chip role ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleRole(role.id)}
                >
                  {role.name}
                  {isSelected && <Check size={10} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Project dropdown */}
      {selectedBusiness && projects.length > 0 && (
        <div className="context-desktop-field">
          <label className="context-desktop-label">Project</label>
          <Select
            value={selectedProject || '__none__'}
            onValueChange={(v) => onSelectProject?.(v === '__none__' ? null : v)}
          >
            <SelectTrigger className="context-desktop-select">
              <Briefcase size={14} className="context-desktop-select-icon" />
              <SelectValue placeholder="Company-wide" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Company-wide</SelectItem>
              {sortedProjects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Playbooks - behind "See more" toggle */}
      {selectedBusiness && playbooks.length > 0 && (
        <>
          <button
            className={`context-desktop-more-btn ${showMore ? 'expanded' : ''}`}
            onClick={() => setShowMore(!showMore)}
          >
            <span>Playbooks</span>
            {selectedPlaybooks.length > 0 && (
              <span className="context-more-badge">{selectedPlaybooks.length}</span>
            )}
            <ChevronRight size={14} className={`context-desktop-more-chevron ${showMore ? 'rotated' : ''}`} />
          </button>

          {showMore && (
            <div className="context-desktop-playbooks">
              {/* Frameworks */}
              {groupedPlaybooks.framework.length > 0 && (
                <div className="context-desktop-pb-group">
                  <span className="context-desktop-pb-type">
                    <FileText size={10} /> Frameworks
                  </span>
                  <div className="context-desktop-pb-chips">
                    {groupedPlaybooks.framework.map((pb) => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <button
                          key={pb.id}
                          className={`context-desktop-chip playbook framework ${isSelected ? 'selected' : ''}`}
                          onClick={() => togglePlaybook(pb.id)}
                          title={pb.name}
                        >
                          <span className="chip-truncate">{pb.name}</span>
                          {isSelected && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SOPs */}
              {groupedPlaybooks.sop.length > 0 && (
                <div className="context-desktop-pb-group">
                  <span className="context-desktop-pb-type">
                    <ScrollText size={10} /> SOPs
                  </span>
                  <div className="context-desktop-pb-chips">
                    {groupedPlaybooks.sop.map((pb) => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <button
                          key={pb.id}
                          className={`context-desktop-chip playbook sop ${isSelected ? 'selected' : ''}`}
                          onClick={() => togglePlaybook(pb.id)}
                          title={pb.name}
                        >
                          <span className="chip-truncate">{pb.name}</span>
                          {isSelected && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Policies */}
              {groupedPlaybooks.policy.length > 0 && (
                <div className="context-desktop-pb-group">
                  <span className="context-desktop-pb-type">
                    <Shield size={10} /> Policies
                  </span>
                  <div className="context-desktop-pb-chips">
                    {groupedPlaybooks.policy.map((pb) => {
                      const isSelected = selectedPlaybooks.includes(pb.id);
                      return (
                        <button
                          key={pb.id}
                          className={`context-desktop-chip playbook policy ${isSelected ? 'selected' : ''}`}
                          onClick={() => togglePlaybook(pb.id)}
                          title={pb.name}
                        >
                          <span className="chip-truncate">{pb.name}</span>
                          {isSelected && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      </div>{/* End scrollable content */}

      {/* Apply button - fixed footer */}
      <div className="context-desktop-footer">
        <button
          className="context-desktop-apply-btn"
          onClick={() => setIsOpen(false)}
        >
          Use this context
        </button>
      </div>
    </div>
  );

  // Mobile content - chip strips
  const renderMobileContent = () => (
    <div className="context-mobile-content">
      {/* Company selection */}
      {businesses.length > 0 && (
        <div className="context-section-mobile">
          <h4 className="context-section-title-mobile">Company</h4>
          <div className="context-chip-strip">
            {businesses.map((biz) => (
              <button
                key={biz.id}
                className={`context-strip-chip company ${selectedBusiness === biz.id ? 'selected' : ''}`}
                onClick={() => onSelectBusiness?.(biz.id)}
              >
                <Building2 size={16} />
                {biz.name}
                {selectedBusiness === biz.id && <Check size={14} className="strip-chip-check" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Department selection */}
      {selectedBusiness && departments.length > 0 && (
        <div className="context-section-mobile">
          <h4 className="context-section-title-mobile">Departments</h4>
          <div className="context-chip-strip">
            {departments.map((dept) => {
              const isSelected = selectedDepartments.includes(dept.id);
              const colors = getDeptColor(dept.id);
              return (
                <button
                  key={dept.id}
                  className={`context-strip-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleDepartment(dept.id)}
                  style={{
                    '--chip-bg': isSelected ? colors.bg : 'var(--color-bg-secondary)',
                    '--chip-border': isSelected ? colors.text : 'var(--color-border)',
                    '--chip-text': isSelected ? colors.text : 'var(--color-text-secondary)',
                  }}
                >
                  {dept.name}
                  {isSelected && <Check size={14} className="strip-chip-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Role selection */}
      {selectedBusiness && allRoles.length > 0 && (
        <div className="context-section-mobile">
          <h4 className="context-section-title-mobile">Roles</h4>
          <div className="context-chip-strip">
            {allRoles.map((role) => {
              const isSelected = selectedRoles.includes(role.id);
              return (
                <button
                  key={role.id}
                  className={`context-strip-chip role ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleRole(role.id)}
                >
                  <Users size={14} />
                  {role.name}
                  {isSelected && <Check size={14} className="strip-chip-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* See more toggle for Projects & Playbooks */}
      {selectedBusiness && (projects.length > 0 || playbooks.length > 0) && (
        <>
          {/* Toggle button */}
          <button
            className={`context-see-more-btn-mobile ${showMore ? 'expanded' : ''}`}
            onClick={() => setShowMore(!showMore)}
          >
            <span>Projects & Playbooks</span>
            {moreCount > 0 && (
              <span className="context-more-badge">{moreCount}</span>
            )}
            <ChevronRight size={16} className={`context-see-more-chevron ${showMore ? 'rotated' : ''}`} />
          </button>

          {/* Expanded content */}
          {showMore && (
            <div className="context-section-mobile context-more-content">
              {/* Projects */}
              {projects.length > 0 && (
                <>
                  <h4 className="context-section-title-mobile">Project</h4>
                  <div className="context-chip-strip">
                    <button
                      className={`context-strip-chip project ${!selectedProject ? 'selected' : ''}`}
                      onClick={() => onSelectProject?.(null)}
                    >
                      <Briefcase size={14} />
                      Company-wide
                      {!selectedProject && <Check size={14} className="strip-chip-check" />}
                    </button>
                    {sortedProjects.map((proj) => {
                      const isSelected = selectedProject === proj.id;
                      return (
                        <button
                          key={proj.id}
                          className={`context-strip-chip project ${isSelected ? 'selected' : ''}`}
                          onClick={() => onSelectProject?.(proj.id)}
                        >
                          <Briefcase size={14} />
                          <span className="chip-text">{proj.name}</span>
                          {isSelected && <Check size={14} className="strip-chip-check" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Playbooks */}
              {playbooks.length > 0 && (
                <>
                  <h4 className="context-section-title-mobile" style={{ marginTop: 16 }}>Playbooks</h4>
                  {/* Frameworks */}
                  {groupedPlaybooks.framework.length > 0 && (
                    <div className="context-playbook-group">
                      <span className="context-playbook-type-label">
                        <FileText size={12} />
                        Frameworks
                      </span>
                      <div className="context-chip-strip">
                        {groupedPlaybooks.framework.map((pb) => {
                          const isSelected = selectedPlaybooks.includes(pb.id);
                          return (
                            <button
                              key={pb.id}
                              className={`context-strip-chip playbook framework ${isSelected ? 'selected' : ''}`}
                              onClick={() => togglePlaybook(pb.id)}
                            >
                              {pb.name}
                              {isSelected && <Check size={14} className="strip-chip-check" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SOPs */}
                  {groupedPlaybooks.sop.length > 0 && (
                    <div className="context-playbook-group">
                      <span className="context-playbook-type-label">
                        <ScrollText size={12} />
                        SOPs
                      </span>
                      <div className="context-chip-strip">
                        {groupedPlaybooks.sop.map((pb) => {
                          const isSelected = selectedPlaybooks.includes(pb.id);
                          return (
                            <button
                              key={pb.id}
                              className={`context-strip-chip playbook sop ${isSelected ? 'selected' : ''}`}
                              onClick={() => togglePlaybook(pb.id)}
                            >
                              {pb.name}
                              {isSelected && <Check size={14} className="strip-chip-check" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Policies */}
                  {groupedPlaybooks.policy.length > 0 && (
                    <div className="context-playbook-group">
                      <span className="context-playbook-type-label">
                        <Shield size={12} />
                        Policies
                      </span>
                      <div className="context-chip-strip">
                        {groupedPlaybooks.policy.map((pb) => {
                          const isSelected = selectedPlaybooks.includes(pb.id);
                          return (
                            <button
                              key={pb.id}
                              className={`context-strip-chip playbook policy ${isSelected ? 'selected' : ''}`}
                              onClick={() => togglePlaybook(pb.id)}
                            >
                              {pb.name}
                              {isSelected && <Check size={14} className="strip-chip-check" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Use this context button */}
      <button
        className="context-apply-btn-mobile"
        onClick={() => setIsOpen(false)}
      >
        Use this context
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
          title="Select Context"
        >
          {renderMobileContent()}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover with compact dropdowns
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>

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
