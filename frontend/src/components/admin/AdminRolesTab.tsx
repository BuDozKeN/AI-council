/**
 * AdminRolesTab (AdminsTab) - Admin role management
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Shield, Calendar } from 'lucide-react';
import { api } from '../../api';
import type { AdminUserInfo } from '../../api';
import { SortableTableHeader } from './SortableTableHeader';
import { useSortState, sortData } from './tableSortUtils';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { SkeletonCell, SkeletonBadge } from './adminUtils';
import { formatDate } from './adminConstants';

// =============================================================================
// Skeleton
// =============================================================================

const AdminsTableSkeleton = () => (
  <>
    {Array.from({ length: 3 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell />
        <SkeletonBadge />
        <SkeletonCell short />
      </tr>
    ))}
  </>
);

// =============================================================================
// DUMMY DATA
// =============================================================================

const DUMMY_ADMINS: AdminUserInfo[] = [
  {
    id: 'demo-admin-1',
    email: 'ozpaniard+superadmin@gmail.com',
    role: 'super_admin',
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-admin-2',
    email: 'ozpaniard+admin@gmail.com',
    role: 'admin',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-admin-3',
    email: 'ozpaniard+support@gmail.com',
    role: 'support',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-admin-4',
    email: 'ozpaniard+moderator@gmail.com',
    role: 'moderator',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// =============================================================================
// Component
// =============================================================================

export function AdminRolesTab() {
  const { t } = useTranslation();

  // Sort state for admins table
  type AdminSortColumn = 'email' | 'role' | 'created_at';
  const [adminSortState, setAdminSortState] = useSortState<AdminSortColumn>('created_at', 'desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.listAdminAdmins(),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiAdmins = data?.admins ?? [];
  const useDummyData = error || (apiAdmins.length === 0 && !isLoading);

  // Apply sorting
  const adminSortGetters: Record<AdminSortColumn, (a: AdminUserInfo) => string | number | null> = {
    email: (a) => a.email.toLowerCase(),
    role: (a) => a.role,
    created_at: (a) => new Date(a.created_at).getTime(),
  };

  const unsortedAdmins = useDummyData ? DUMMY_ADMINS : apiAdmins;
  const admins = sortData(unsortedAdmins, adminSortState, adminSortGetters);

  // Keyboard navigation for admins table
  const { tableBodyRef: adminsTableBodyRef, getRowProps: getAdminRowProps } = useTableKeyboardNav({
    rowCount: admins.length,
  });

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.admins.title', 'Admin Roles')}</h2>
          <p className="admin-section-desc">
            {t('admin.admins.description', 'Manage platform administrator access and roles.')}
          </p>
        </div>
      </div>

      {!isLoading && admins.length === 0 ? (
        <div className="admin-table-empty">
          <Shield className="h-8 w-8" />
          <span>{t('admin.admins.noAdmins', 'No admins found')}</span>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table" aria-label={t('admin.admins.title', 'Admin Users List')}>
            <caption className="sr-only">
              {t(
                'admin.admins.tableCaption',
                'List of platform administrators with their roles and grant dates'
              )}
            </caption>
            <thead>
              <tr>
                <SortableTableHeader
                  column="email"
                  label={t('admin.admins.email', 'Email')}
                  sortState={adminSortState}
                  onSort={setAdminSortState}
                />
                <SortableTableHeader
                  column="role"
                  label={t('admin.admins.role', 'Role')}
                  sortState={adminSortState}
                  onSort={setAdminSortState}
                />
                <SortableTableHeader
                  column="created_at"
                  label={t('admin.admins.grantedAt', 'Granted')}
                  sortState={adminSortState}
                  onSort={setAdminSortState}
                  className="admin-roles-date-col"
                />
              </tr>
            </thead>
            <tbody ref={adminsTableBodyRef}>
              {isLoading ? (
                <AdminsTableSkeleton />
              ) : (
                admins.map((admin: AdminUserInfo, rowIndex: number) => (
                  <tr
                    key={admin.id}
                    className={useDummyData ? 'admin-demo-row' : ''}
                    {...getAdminRowProps(rowIndex)}
                    aria-label={`${admin.email}, Role: ${admin.role.replace('_', ' ')}, Granted: ${formatDate(admin.created_at)}`}
                  >
                    <td>
                      <div className="admin-user-cell">
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        <span>{admin.email}</span>
                        {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-role-badge admin-role-badge--${admin.role}`}
                        title={
                          admin.role === 'super_admin'
                            ? t('mycompany.superAdminPermissions')
                            : undefined
                        }
                      >
                        {t(`admin.admins.roles.${admin.role}`, {
                          defaultValue: admin.role.replace('_', ' '),
                        })}
                      </span>
                    </td>
                    <td className="admin-roles-date-col">
                      <div className="admin-date-cell">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        <span>{formatDate(admin.created_at)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
