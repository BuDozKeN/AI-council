/**
 * TeamTab - Departments and roles management
 *
 * Shows:
 * - List of departments with expandable role sections
 * - Department context preview
 * - Role list with click to view/edit
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useTranslation } from 'react-i18next';
import { Users, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { getDeptColor } from '../../../lib/colors';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { makeClickable } from '../../../utils/a11y';
import type { Department, Role } from '../../../types/business';

interface ExtendedDepartment extends Department {
  context_md?: string;
}

interface ExtendedRole extends Role {
  title?: string;
  departmentName?: string;
  departmentId?: string;
}

interface TeamTabProps {
  departments?: ExtendedDepartment[];
  totalRoles?: number;
  expandedDept?: string | null;
  onExpandDept?: (deptId: string | null) => void;
  onAddDepartment?: () => void;
  onAddRole?: (deptId: string) => void;
  onViewDepartment?: (dept: ExtendedDepartment) => void;
  onViewRole?: (role: ExtendedRole) => void;
}

export function TeamTab({
  departments = [],
  totalRoles = 0,
  expandedDept,
  onExpandDept,
  onAddDepartment,
  onAddRole,
  onViewDepartment,
  onViewRole,
}: TeamTabProps) {
  const { t } = useTranslation();

  if (departments.length === 0) {
    return (
      <div className="mc-empty">
        <Users size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">{t('mycompany.setUpTeam')}</p>
        <p className="mc-empty-hint">{t('mycompany.teamHelp')}</p>
        <Button variant="default" onClick={onAddDepartment}>
          {t('mycompany.newDepartment')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mc-team">
      <div className="mc-team-header">
        <span>
          {t('mycompany.departmentsRoles', { depts: departments.length, roles: totalRoles })}
        </span>
        <Button variant="default" size="sm" onClick={onAddDepartment}>
          {t('mycompany.newDepartment')}
        </Button>
      </div>

      <ScrollableContent className="mc-team-list">
        <div className="mc-elegant-list">
          {departments.map((dept: ExtendedDepartment) => {
            const deptColors = getDeptColor(dept.id);
            const isExpanded = expandedDept === dept.id;

            return (
              <div key={dept.id} className="mc-dept-container">
                <div
                  className={`mc-elegant-row mc-dept-row ${isExpanded ? 'expanded' : ''}`}
                  {...(onExpandDept ? makeClickable(() => onExpandDept(isExpanded ? null : dept.id)) : {})}
                >
                  {/* Department color indicator */}
                  <div className="mc-dept-indicator" style={{ background: deptColors.text }} />

                  {/* Main content */}
                  <div className="mc-elegant-content">
                    <span className="mc-elegant-title">{dept.name}</span>
                    <span className="mc-elegant-meta">
                      {dept.roles?.length || 0} {t('mycompany.roles')}
                    </span>
                  </div>

                  {/* Expand icon */}
                  <div className="mc-elegant-actions">
                    <span className={`mc-expand-chevron ${isExpanded ? 'expanded' : ''}`}>›</span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mc-dept-expanded-content">
                    {/* Department context button */}
                    <button
                      className="mc-context-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDepartment && onViewDepartment(dept);
                      }}
                    >
                      <span className="mc-context-icon">📄</span>
                      <span>{t('mycompany.viewContext')}</span>
                      {dept.context_md && (
                        <span className="mc-context-size">
                          {Math.round(dept.context_md.length / 1000)}k
                        </span>
                      )}
                    </button>

                    {/* Roles list */}
                    <div className="mc-roles-section">
                      <div className="mc-roles-header">
                        <span className="mc-roles-label">{t('mycompany.rolesLabel')}</span>
                        <button
                          className="mc-text-btn add"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddRole && onAddRole(dept.id);
                          }}
                        >
                          {t('mycompany.newRole')}
                        </button>
                      </div>

                      {dept.roles && dept.roles.length > 0 ? (
                        <div className="mc-roles-list">
                          {dept.roles.map((role: Role) => (
                            <div
                              key={role.id}
                              className="mc-role-row"
                              {...makeClickable((e) => {
                                e.stopPropagation();
                                onViewRole &&
                                  onViewRole({
                                    ...role,
                                    departmentName: dept.name,
                                    departmentId: dept.id,
                                  });
                              })}
                            >
                              <span className="mc-role-name">{role.name}</span>
                              {role.title && <span className="mc-role-title">{role.title}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mc-no-roles">{t('mycompany.addRolesToDept')}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollableContent>

      {/* FAB - Mobile only (visible via CSS) */}
      <button
        className="mc-fab"
        onClick={onAddDepartment}
        aria-label={t('mycompany.createNewDepartment')}
      >
        <Plus />
      </button>
    </div>
  );
}
