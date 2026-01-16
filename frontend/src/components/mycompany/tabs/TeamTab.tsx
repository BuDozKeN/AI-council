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
import { Plus, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
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
        <motion.svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          className="mc-empty-icon-svg"
          style={{ marginBottom: '16px' }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <defs>
            <linearGradient id="teamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-indigo-500)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--color-purple-500)" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Org chart structure */}
          <g>
            {/* Top person (leader) */}
            <circle cx="60" cy="30" r="10" fill="url(#teamGradient)" opacity="0.5" />
            <circle
              cx="60"
              cy="30"
              r="10"
              fill="var(--color-bg-card)"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
            <circle cx="60" cy="30" r="4" fill="var(--color-indigo-500)" opacity="0.4" />

            {/* Connection lines */}
            <line x1="60" y1="40" x2="60" y2="55" stroke="var(--color-border)" strokeWidth="1.5" />
            <line x1="35" y1="55" x2="85" y2="55" stroke="var(--color-border)" strokeWidth="1.5" />
            <line x1="35" y1="55" x2="35" y2="65" stroke="var(--color-border)" strokeWidth="1.5" />
            <line x1="60" y1="55" x2="60" y2="65" stroke="var(--color-border)" strokeWidth="1.5" />
            <line x1="85" y1="55" x2="85" y2="65" stroke="var(--color-border)" strokeWidth="1.5" />

            {/* Team members (bottom row) */}
            <circle cx="35" cy="75" r="8" fill="url(#teamGradient)" opacity="0.4" />
            <circle
              cx="35"
              cy="75"
              r="8"
              fill="var(--color-bg-card)"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
            <circle cx="35" cy="75" r="3" fill="var(--color-indigo-500)" opacity="0.3" />

            <circle cx="60" cy="75" r="8" fill="url(#teamGradient)" opacity="0.4" />
            <circle
              cx="60"
              cy="75"
              r="8"
              fill="var(--color-bg-card)"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
            <circle cx="60" cy="75" r="3" fill="var(--color-indigo-500)" opacity="0.3" />

            <circle cx="85" cy="75" r="8" fill="url(#teamGradient)" opacity="0.4" />
            <circle
              cx="85"
              cy="75"
              r="8"
              fill="var(--color-bg-card)"
              stroke="var(--color-border)"
              strokeWidth="1.5"
            />
            <circle cx="85" cy="75" r="3" fill="var(--color-indigo-500)" opacity="0.3" />

            {/* Department boxes underneath */}
            <rect
              x="25"
              y="88"
              width="20"
              height="8"
              rx="2"
              fill="url(#teamGradient)"
              opacity="0.2"
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <rect
              x="50"
              y="88"
              width="20"
              height="8"
              rx="2"
              fill="url(#teamGradient)"
              opacity="0.2"
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <rect
              x="75"
              y="88"
              width="20"
              height="8"
              rx="2"
              fill="url(#teamGradient)"
              opacity="0.2"
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          </g>
        </motion.svg>

        <p className="mc-empty-title">{t('mycompany.setUpTeam')}</p>
        <p className="mc-empty-hint">{t('mycompany.teamHelp')}</p>

        <Button variant="default" onClick={onAddDepartment} style={{ marginTop: '8px' }}>
          <Plus size={16} />
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
                      <FileText size={14} className="mc-context-icon" />
                      <span>{t('mycompany.aboutDepartment', { name: dept.name })}</span>
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
                          <Plus size={14} />
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
