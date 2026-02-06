/**
 * UsersTab - User management tab for AdminPortal
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split to reduce file size.
 * Contains the unified users + invitations view with:
 * - UsersTableSkeleton (loading state)
 * - UnifiedUserRow type and status types
 * - UsersTab (main component with user/invitation management)
 * - DeleteUserModal (soft-delete confirmation with type-to-confirm)
 * - SuspendUserModal (suspend/unsuspend confirmation)
 * - InviteUserModal (new user invitation form)
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Mail,
  Clock,
  UserPlus,
  Calendar,
  Users,
  Loader2,
  MoreVertical,
  Send,
  Eye,
  Trash2,
  Ban,
  UserX,
  UserCheck,
  CheckCircle,
  X,
  XCircle,
  Archive,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api';
import type {
  AdminPlatformUser,
  AdminInvitation,
  AdminDeletedUser,
  CreateInvitationRequest,
} from '../../api';
import { useAuth } from '../../AuthContext';
import { useAdminAccess } from '../../hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ImpersonateUserModal } from './ImpersonateUserModal';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from '../ui/sonner';
import { SortableTableHeader } from './SortableTableHeader';
import { useSortState, sortData } from './tableSortUtils';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { SkeletonCell, SkeletonBadge, SkeletonActions, Pagination } from './adminUtils';
import { formatDate } from './adminConstants';

/**
 * ISS-130: Derive a display name from email when name is missing
 * Converts "john.doe@email.com" → "John Doe"
 */
function getDisplayName(name: string | null, email: string): string {
  if (name) return name;
  // Extract username part before @
  const username = email.split('@')[0] || email;
  // Replace dots, underscores, hyphens with spaces and capitalize each word
  return username
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Users table skeleton rows */
const UsersTableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell short />
        <SkeletonCell />
        <SkeletonCell short />
        <SkeletonCell short />
        <SkeletonBadge />
        <SkeletonActions />
      </tr>
    ))}
  </>
);

// Unified row type for combined user/invitation display
type UnifiedUserStatus = 'active' | 'invited' | 'pending' | 'suspended' | 'expired' | 'cancelled';

interface UnifiedUserRow {
  id: string;
  email: string;
  name: string | null;
  status: UnifiedUserStatus;
  created_at: string;
  // For users
  last_sign_in_at?: string | null;
  // For invitations
  invited_by_email?: string | null;
  expires_at?: string | null;
  // Type discriminator
  type: 'user' | 'invitation';
  // Original data for actions
  originalUser?: AdminPlatformUser;
  originalInvitation?: AdminInvitation;
}

// Status filter options
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'pending', label: 'Pending Verification' },
  { value: 'suspended', label: 'Suspended' },
];

export function UsersTab() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { adminRole } = useAdminAccess();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [userToDelete, setUserToDelete] = useState<AdminPlatformUser | null>(null);
  const [userToSuspend, setUserToSuspend] = useState<AdminPlatformUser | null>(null);
  const [userToImpersonate, setUserToImpersonate] = useState<AdminPlatformUser | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Sort state for users table
  type UserSortColumn = 'name' | 'email' | 'status' | 'created_at';
  const [userSortState, setUserSortState] = useSortState<UserSortColumn>('created_at', 'desc');

  // Invitation action states
  // Note: cancellingId kept for loading spinner UI but setter unused since we use optimistic updates
  const [cancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingInvitationId, setDeletingInvitationId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    invitationId: string;
    email: string;
  }>({ open: false, invitationId: '', email: '' });

  const pageSize = 20;

  // ISS-137 FIX: Track previous search to detect when search is cleared
  // When search goes from non-empty to empty, force refetch to show all data
  const prevSearchRef = useRef(search);
  useEffect(() => {
    if (prevSearchRef.current && !search) {
      // Search was cleared - force refetch to get full list
      // Using refetchQueries instead of invalidateQueries to ensure immediate refetch
      queryClient.refetchQueries({ queryKey: ['admin', 'users', { search: '' }] });
      queryClient.refetchQueries({ queryKey: ['admin', 'invitations', { search: '' }] });
    }
    prevSearchRef.current = search;
  }, [search, queryClient]);

  // Check if current admin can impersonate
  const canImpersonate = adminRole === 'super_admin' || adminRole === 'admin';

  // Fetch users - DISABLE automatic refetching to preserve optimistic updates
  // Supabase Auth has eventual consistency - auto refetches return stale data and overwrite our updates
  // ISS-137 FIX: Use 5-minute staleTime instead of Infinity to allow proper search clearing
  // Optimistic updates still work because they use setQueryData which updates cache directly
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ['admin', 'users', { search }],
    queryFn: () =>
      api.listAdminUsers({
        page: 1,
        page_size: 100, // Backend max is 100
        ...(search ? { search } : {}),
      }),
    staleTime: 5 * 60 * 1000, // ISS-137: 5 minutes instead of Infinity
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch invitations - same settings
  const {
    data: invitationsData,
    isLoading: invitationsLoading,
    error: invitationsError,
  } = useQuery({
    queryKey: ['admin', 'invitations', { search }],
    queryFn: () =>
      api.listAdminInvitations({
        page: 1,
        page_size: 100, // Backend max is 100
        ...(search ? { search } : {}),
      }),
    staleTime: 5 * 60 * 1000, // ISS-137: 5 minutes instead of Infinity
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch deleted users - ALWAYS enabled to preserve optimistic updates
  // If we use `enabled: showDeletedUsers`, toggling "Show Deleted" triggers a refetch
  // that overwrites our optimistic updates
  const { data: deletedUsersData } = useQuery({
    queryKey: ['admin', 'deleted-users'],
    queryFn: () => api.listDeletedUsers(),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const isLoading = usersLoading || invitationsLoading;

  // Transform users to unified format
  const transformUser = (user: AdminPlatformUser): UnifiedUserRow => {
    const isSuspended = !!user.user_metadata?.is_suspended;
    const isVerified = !!user.email_confirmed_at;

    let status: UnifiedUserStatus = 'pending';
    if (isSuspended) status = 'suspended';
    else if (isVerified) status = 'active';

    return {
      id: user.id,
      email: user.email,
      name:
        (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || null,
      status,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      type: 'user',
      originalUser: user,
    };
  };

  // Transform invitations to unified format
  const transformInvitation = (inv: AdminInvitation): UnifiedUserRow => {
    let status: UnifiedUserStatus = 'invited';
    if (inv.status === 'expired') status = 'expired';
    else if (inv.status === 'cancelled') status = 'cancelled';

    return {
      id: `inv-${inv.id}`,
      email: inv.email,
      name: inv.name,
      status,
      created_at: inv.created_at,
      invited_by_email: inv.invited_by_email,
      expires_at: inv.expires_at,
      type: 'invitation',
      originalInvitation: inv,
    };
  };

  // Combine and filter data
  const unifiedRows = useMemo(() => {
    const users = (usersData?.users ?? []).map(transformUser);
    // Only include pending invitations (not accepted ones, as those become users)
    const invitations = (invitationsData?.invitations ?? [])
      .filter((inv) => inv.status !== 'accepted')
      .map(transformInvitation);

    let combined = [...users, ...invitations];

    // Apply status filter
    if (statusFilter !== 'all') {
      combined = combined.filter((row) => row.status === statusFilter);
    }

    // Apply sorting
    const sortGetters: Record<UserSortColumn, (row: UnifiedUserRow) => string | number | null> = {
      name: (row) => row.name?.toLowerCase() ?? '',
      email: (row) => row.email.toLowerCase(),
      status: (row) => row.status,
      created_at: (row) => new Date(row.created_at).getTime(),
    };

    return sortData(combined, userSortState, sortGetters);
  }, [usersData, invitationsData, statusFilter, userSortState]);

  // Pagination
  const total = unifiedRows.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedRows = unifiedRows.slice((page - 1) * pageSize, page * pageSize);

  // Keyboard navigation for users table
  const { tableBodyRef: usersTableBodyRef, getRowProps: getUserRowProps } = useTableKeyboardNav({
    rowCount: paginatedRows.length,
    onRowAction: (index) => {
      // On Enter, open the actions dropdown for that row
      const row = paginatedRows[index];
      if (row && row.type === 'user' && row.originalUser) {
        // For users, toggle suspend as a quick action
        setUserToSuspend(row.originalUser);
      }
    },
  });

  // Check if user is suspended
  const isUserSuspended = (user: AdminPlatformUser): boolean => {
    return !!user.user_metadata?.is_suspended;
  };

  // Handle suspend/unsuspend with OPTIMISTIC UPDATE for instant UI feedback
  const handleToggleSuspend = async (user: AdminPlatformUser, reason?: string) => {
    if (user.id === currentUser?.id) return;

    const newSuspendedState = !isUserSuspended(user);

    // Store previous data for rollback
    const previousUsersData = queryClient.getQueryData<{
      users: AdminPlatformUser[];
      total: number;
    }>(['admin', 'users', { search }]);

    // OPTIMISTIC UPDATE: Immediately update the cache before API call
    queryClient.setQueryData<{ users: AdminPlatformUser[]; total: number } | undefined>(
      ['admin', 'users', { search }],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.map((u) =>
            u.id === user.id
              ? {
                  ...u,
                  user_metadata: {
                    ...u.user_metadata,
                    is_suspended: newSuspendedState,
                    suspended_at: newSuspendedState ? new Date().toISOString() : null,
                    suspend_reason: reason || null,
                  },
                }
              : u
          ),
        };
      }
    );

    // Close modal immediately - user sees instant feedback
    setUserToSuspend(null);
    toast.success(newSuspendedState ? 'User suspended' : 'User unsuspended');

    // Now do the actual API call in background
    try {
      await api.updateAdminUser(user.id, {
        is_suspended: newSuspendedState,
        ...(reason && { suspend_reason: reason }),
      });
      // Success - DO NOT refetch! Supabase has eventual consistency and returns stale data.
      // Our optimistic update IS the source of truth.
    } catch (err: unknown) {
      // ROLLBACK on error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update user:', err);
      queryClient.setQueryData(['admin', 'users', { search }], previousUsersData);
      toast.error('Failed to update user', {
        description: errorMessage,
      });
    }
  };

  // Handle delete user (soft delete) with OPTIMISTIC UPDATE for instant UI feedback
  const handleDeleteUser = async (user: AdminPlatformUser, reason?: string) => {
    if (user.id === currentUser?.id) return;

    // Store previous data for rollback
    const previousUsersData = queryClient.getQueryData<{
      users: AdminPlatformUser[];
      total: number;
    }>(['admin', 'users', { search }]);
    const previousDeletedUsersData = queryClient.getQueryData<{
      deleted_users: AdminDeletedUser[];
      total: number;
    }>(['admin', 'deleted-users']);

    // OPTIMISTIC UPDATE: Immediately remove user from the active users list
    queryClient.setQueryData<{ users: AdminPlatformUser[]; total: number } | undefined>(
      ['admin', 'users', { search }],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.filter((u) => u.id !== user.id),
          total: old.total - 1,
        };
      }
    );

    // OPTIMISTIC UPDATE: Add user to deleted users list (so they appear in "Show Deleted")
    const restorationDeadline = new Date();
    restorationDeadline.setDate(restorationDeadline.getDate() + 30);
    const deletedUser: AdminDeletedUser = {
      user_id: user.id,
      email: user.email,
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser?.id || null,
      deletion_reason: reason || null,
      restoration_deadline: restorationDeadline.toISOString(),
      can_restore: true,
      days_until_anonymization: 30,
      is_anonymized: false,
    };
    queryClient.setQueryData<{ deleted_users: AdminDeletedUser[]; total: number } | undefined>(
      ['admin', 'deleted-users'],
      (old) => {
        if (!old) {
          // If no previous data, create new structure
          return { deleted_users: [deletedUser], total: 1 };
        }
        return {
          ...old,
          deleted_users: [deletedUser, ...old.deleted_users],
          total: old.total + 1,
        };
      }
    );

    // Close modal immediately - user sees instant feedback
    setUserToDelete(null);
    toast.success(t('admin.users.userDeleted', 'User deleted'), {
      description: t('admin.users.canRestore', 'User can be restored within 30 days'),
    });

    // Now do the actual API call in background
    try {
      await api.deleteAdminUser(user.id, reason ? { reason } : undefined);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err: unknown) {
      // ROLLBACK on error - restore both caches
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete user:', err);
      queryClient.setQueryData(['admin', 'users', { search }], previousUsersData);
      queryClient.setQueryData(['admin', 'deleted-users'], previousDeletedUsersData);
      toast.error(t('admin.users.deleteFailed', 'Failed to delete user'), {
        description: errorMessage,
      });
    }
  };

  // Handle restore deleted user with OPTIMISTIC UPDATE
  const handleRestoreUser = async (userId: string, email: string) => {
    // Store previous data for rollback
    const previousDeletedUsersData = queryClient.getQueryData<{
      deleted_users: AdminDeletedUser[];
      total: number;
    }>(['admin', 'deleted-users']);
    const previousUsersData = queryClient.getQueryData<{
      users: AdminPlatformUser[];
      total: number;
    }>(['admin', 'users', { search }]);

    // Find the deleted user to restore
    const deletedUser = previousDeletedUsersData?.deleted_users.find((u) => u.user_id === userId);

    // OPTIMISTIC UPDATE: Remove from deleted-users list
    queryClient.setQueryData<{ deleted_users: AdminDeletedUser[]; total: number } | undefined>(
      ['admin', 'deleted-users'],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          deleted_users: old.deleted_users.filter((u) => u.user_id !== userId),
          total: Math.max(0, old.total - 1),
        };
      }
    );

    // OPTIMISTIC UPDATE: Add back to users list (approximate user data)
    if (deletedUser && email) {
      const restoredUser: AdminPlatformUser = {
        id: userId,
        email: email,
        created_at: deletedUser.deleted_at, // Use deleted_at as approximation
        last_sign_in_at: null,
        email_confirmed_at: null,
        user_metadata: {},
      };
      queryClient.setQueryData<{ users: AdminPlatformUser[]; total: number } | undefined>(
        ['admin', 'users', { search }],
        (old) => {
          if (!old) return { users: [restoredUser], total: 1 };
          return {
            ...old,
            users: [restoredUser, ...old.users],
            total: old.total + 1,
          };
        }
      );
    }

    // Show success immediately
    toast.success(t('admin.users.userRestored', 'User restored'), {
      description: t('admin.users.userRestoredDesc', '{{email}} can now log in again', { email }),
    });

    // Now do the actual API call in background
    setRestoringId(userId);
    try {
      await api.restoreAdminUser(userId);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err: unknown) {
      // ROLLBACK on error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to restore user:', err);
      queryClient.setQueryData(['admin', 'deleted-users'], previousDeletedUsersData);
      queryClient.setQueryData(['admin', 'users', { search }], previousUsersData);
      toast.error(t('admin.users.restoreFailed', 'Failed to restore user'), {
        description: errorMessage,
      });
    } finally {
      setRestoringId(null);
    }
  };

  // Handle delete invitation with OPTIMISTIC UPDATE for instant UI feedback
  // Invitations are HARD deleted since invited users have no data to preserve
  const handleCancelInvitation = async (invitationId: string, email: string) => {
    if (!invitationId) {
      toast.error('Failed to delete invitation: No invitation selected');
      return;
    }

    // Store previous data for rollback
    const previousInvitationsData = queryClient.getQueryData<{
      invitations: AdminInvitation[];
      total: number;
    }>(['admin', 'invitations', { search }]);

    // OPTIMISTIC UPDATE: Immediately REMOVE the invitation from the list
    // (not just set status - the invitation is hard-deleted on the backend)
    queryClient.setQueryData<
      { invitations: AdminInvitation[]; total: number; page: number; page_size: number } | undefined
    >(['admin', 'invitations', { search }], (old) => {
      if (!old) return old;
      return {
        ...old,
        invitations: old.invitations.filter((inv) => inv.id !== invitationId),
        total: Math.max(0, old.total - 1),
      };
    });

    // Close dialog immediately - user sees instant feedback
    setConfirmDialog({ open: false, invitationId: '', email: '' });
    toast.success('Invitation deleted', {
      description: `The invitation for ${email} has been deleted.`,
    });

    // Now do the actual API call in background
    try {
      await api.cancelAdminInvitation(invitationId);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err) {
      // ROLLBACK on error
      console.error('Failed to delete invitation:', err);
      queryClient.setQueryData(['admin', 'invitations', { search }], previousInvitationsData);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete invitation - changes reverted: ${errorMessage}`);
    }
  };

  // Handle resend invitation (no data change, just sends email)
  const handleResendInvitation = async (invitationId: string, email: string) => {
    setResendingId(invitationId);
    try {
      await api.resendAdminInvitation(invitationId);
      // Success - no need to refetch, data hasn't changed
      toast.success('Invitation resent', {
        description: `A new invitation email has been sent to ${email}.`,
      });
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  // Handle delete invitation (removes cancelled/expired invitations) with OPTIMISTIC UPDATE
  const handleDeleteInvitation = async (invitationId: string, email: string) => {
    // Store previous data for rollback
    const previousInvitationsData = queryClient.getQueryData<{
      invitations: AdminInvitation[];
      total: number;
    }>(['admin', 'invitations', { search }]);

    // OPTIMISTIC UPDATE: Immediately remove invitation from the list
    queryClient.setQueryData<
      { invitations: AdminInvitation[]; total: number; page: number; page_size: number } | undefined
    >(['admin', 'invitations', { search }], (old) => {
      if (!old) return old;
      return {
        ...old,
        invitations: old.invitations.filter((inv) => inv.id !== invitationId),
        total: Math.max(0, old.total - 1),
      };
    });

    // Show success immediately
    toast.success(t('admin.users.invitationDeleted', 'Invitation removed'), {
      description: t(
        'admin.users.invitationDeletedDesc',
        `The invitation for ${email} has been removed.`
      ),
    });

    // Now do the actual API call in background
    setDeletingInvitationId(invitationId);
    try {
      await api.deleteAdminInvitation(invitationId);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err) {
      // ROLLBACK on error
      console.error('Failed to delete invitation:', err);
      queryClient.setQueryData(['admin', 'invitations', { search }], previousInvitationsData);
      toast.error(
        t('admin.users.invitationDeleteFailed', 'Failed to remove invitation - changes reverted')
      );
    } finally {
      setDeletingInvitationId(null);
    }
  };

  // Get status badge
  const getStatusBadge = (row: UnifiedUserRow) => {
    const statusConfig: Record<
      UnifiedUserStatus,
      { class: string; icon: typeof CheckCircle; label: string }
    > = {
      active: { class: 'admin-status-badge--active', icon: CheckCircle, label: 'Active' },
      invited: { class: 'admin-status-badge--pending', icon: Clock, label: 'Invited' },
      pending: { class: 'admin-status-badge--pending', icon: Clock, label: 'Pending' },
      suspended: { class: 'admin-status-badge--suspended', icon: Ban, label: 'Suspended' },
      expired: { class: 'admin-status-badge--expired', icon: XCircle, label: 'Expired' },
      cancelled: { class: 'admin-status-badge--cancelled', icon: X, label: 'Cancelled' },
    };

    const config = statusConfig[row.status];
    const Icon = config.icon;

    // Build tooltip for suspended users
    let tooltip: string | undefined;
    if (row.status === 'suspended' && row.originalUser?.user_metadata) {
      const metadata = row.originalUser.user_metadata;
      const parts: string[] = [];
      if (metadata.suspend_reason) {
        parts.push(`Reason: ${metadata.suspend_reason}`);
      }
      if (metadata.suspended_at && typeof metadata.suspended_at === 'string') {
        parts.push(`Suspended: ${formatDate(metadata.suspended_at)}`);
      }
      if (parts.length > 0) {
        tooltip = parts.join('\n');
      }
    }

    return (
      <span className={`admin-status-badge ${config.class}`} title={tooltip}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  // Render actions based on row type - unified kebab menu
  const renderActions = (row: UnifiedUserRow) => {
    const isCurrentUser = row.type === 'user' && row.originalUser?.id === currentUser?.id;

    // No actions for current user
    if (isCurrentUser) {
      return <span className="admin-muted">-</span>;
    }

    // Check for loading states
    const isLoading =
      row.type === 'invitation' &&
      (resendingId === row.originalInvitation?.id || cancellingId === row.originalInvitation?.id);

    if (isLoading) {
      return (
        <div className="admin-actions-cell">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }

    // For non-pending invitations (cancelled, expired), show archive option only
    if (row.type === 'invitation' && row.originalInvitation?.status !== 'pending') {
      const isDeleting = deletingInvitationId === row.originalInvitation?.id;
      return (
        <div className="admin-actions-cell">
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="admin-icon-btn admin-icon-btn--ghost"
                  title="Actions"
                  aria-label={t('common.actions', 'Actions')}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="danger"
                  onClick={() =>
                    handleDeleteInvitation(
                      row.originalInvitation!.id,
                      row.originalInvitation!.email
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  {t('admin.users.deleteInvitation', 'Delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      );
    }

    return (
      <div className="admin-actions-cell">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="admin-icon-btn admin-icon-btn--ghost"
              title="Actions"
              aria-label={t('common.actions', 'Actions')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.type === 'invitation' ? (
              // Invitation actions
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    setTimeout(() => {
                      handleResendInvitation(
                        row.originalInvitation!.id,
                        row.originalInvitation!.email
                      );
                    }, 0);
                  }}
                >
                  <Send className="h-4 w-4" />
                  {t('admin.users.resendInvite', 'Resend Invitation')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="danger"
                  onSelect={() => {
                    // Use setTimeout to let dropdown close first, then open dialog
                    setTimeout(() => {
                      setConfirmDialog({
                        open: true,
                        invitationId: row.originalInvitation!.id,
                        email: row.originalInvitation!.email,
                      });
                    }, 0);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('admin.users.deleteInvite', 'Delete Invitation')}
                </DropdownMenuItem>
              </>
            ) : (
              // User actions
              <>
                {canImpersonate && !isUserSuspended(row.originalUser!) && (
                  <DropdownMenuItem
                    onSelect={() => {
                      // Use setTimeout to let dropdown close first, then open modal
                      setTimeout(() => setUserToImpersonate(row.originalUser!), 0);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    {t('admin.users.impersonate', 'View as User')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    // Use setTimeout to let dropdown close first, then open modal
                    setTimeout(() => setUserToSuspend(row.originalUser!), 0);
                  }}
                >
                  {isUserSuspended(row.originalUser!) ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      {t('admin.users.unsuspend', 'Unsuspend User')}
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4" />
                      {t('admin.users.suspend', 'Suspend User')}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="danger"
                  onSelect={() => {
                    // Use setTimeout to let dropdown close first, then open modal
                    setTimeout(() => setUserToDelete(row.originalUser!), 0);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('admin.users.delete', 'Delete User')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.users.title', 'User Management')}</h2>
          <p className="admin-section-desc">
            {t('admin.users.description', 'View and manage all users and invitations.')}
          </p>
        </div>
        <button
          className="admin-action-btn admin-action-btn--primary"
          onClick={() => setShowInviteModal(true)}
          title={t('admin.users.inviteUser', 'Invite User')}
        >
          <UserPlus className="h-4 w-4" />
          <span>{t('admin.users.inviteUser', 'Invite User')}</span>
        </button>
      </div>

      {/* Filters toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <div className="admin-search-box">
            <Search className="admin-search-icon h-4 w-4" />
            <input
              type="text"
              placeholder={t('admin.users.searchPlaceholder', 'Search by email...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="admin-search-input"
            />
          </div>
        </div>

        <div className="admin-toolbar-right">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="admin-select-trigger">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show Deleted Users toggle - compact icon button */}
          <button
            className={`admin-icon-btn admin-show-deleted-btn ${showDeletedUsers ? 'admin-icon-btn--warning-active' : 'admin-icon-btn--secondary'}`}
            onClick={() => setShowDeletedUsers(!showDeletedUsers)}
            title={
              showDeletedUsers
                ? t('admin.users.hideDeleted', 'Hide deleted users')
                : t('admin.users.showDeleted', 'Show deleted users')
            }
            aria-label={
              showDeletedUsers
                ? t('admin.users.hideDeleted', 'Hide deleted users')
                : t('admin.users.showDeleted', 'Show deleted users')
            }
          >
            <Archive className="h-4 w-4" />
            {deletedUsersData?.total ? (
              <span className="admin-deleted-badge">{deletedUsersData.total}</span>
            ) : null}
          </button>
        </div>
      </div>

      {invitationsError && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>
            {t(
              'admin.users.invitationsLoadError',
              'Invitations could not be loaded. Showing users only.'
            )}
          </span>
        </div>
      )}
      {usersError && !isLoading && (
        <div className="admin-demo-banner admin-demo-banner--error">
          <AlertCircle className="h-4 w-4" />
          <span>{t('admin.users.usersLoadError', 'Failed to load users.')}</span>
        </div>
      )}

      {!isLoading && paginatedRows.length === 0 ? (
        <div className="admin-table-empty">
          <Users className="h-8 w-8" />
          <span>{t('admin.users.noUsers', 'No users found')}</span>
          {statusFilter !== 'all' || search ? (
            <p className="admin-empty-hint">
              {t('admin.users.tryDifferentFilter', 'Try a different filter or search term.')}
            </p>
          ) : (
            /* ISS-139: Suggest inviting users when list is genuinely empty */
            <button
              className="admin-action-btn admin-action-btn--primary"
              onClick={() => setShowInviteModal(true)}
              style={{ marginTop: 'var(--space-4)' }}
            >
              <UserPlus className="h-4 w-4" />
              <span>{t('admin.users.inviteFirstUser', 'Invite your first user')}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortableTableHeader
                    column="name"
                    label={t('admin.users.name', 'Name')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <SortableTableHeader
                    column="email"
                    label={t('admin.users.email', 'Email')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <SortableTableHeader
                    column="status"
                    label={t('admin.users.status', 'Status')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <th>{t('admin.users.activity', 'Activity')}</th>
                  <SortableTableHeader
                    column="created_at"
                    label={t('admin.users.createdAt', 'Created')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <th>{t('admin.users.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody ref={usersTableBodyRef}>
                {isLoading ? (
                  <UsersTableSkeleton />
                ) : (
                  paginatedRows.map((row, rowIndex) => {
                    const isCurrentUser =
                      row.type === 'user' && row.originalUser?.id === currentUser?.id;

                    return (
                      <tr key={row.id} {...getUserRowProps(rowIndex)}>
                        <td>
                          {/* ISS-130: Show email-derived name when name is missing */}
                          <span>{getDisplayName(row.name, row.email)}</span>
                        </td>
                        <td>
                          {/* ISS-135: title attribute shows full email on hover when truncated */}
                          <div className="admin-user-cell" title={row.email}>
                            <Mail className="h-4 w-4" aria-hidden="true" />
                            <span>{row.email}</span>
                            {isCurrentUser && <span className="admin-you-badge">You</span>}
                          </div>
                        </td>
                        <td>{getStatusBadge(row)}</td>
                        <td>
                          <div className="admin-date-cell">
                            {row.type === 'user' ? (
                              <>
                                <Clock className="h-4 w-4" />
                                <span>
                                  {row.last_sign_in_at
                                    ? `Last sign in ${formatDate(row.last_sign_in_at)}`
                                    : 'Never signed in'}
                                </span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4" />
                                <span>
                                  {row.invited_by_email
                                    ? `Invited by ${row.invited_by_email.split('@')[0]}`
                                    : 'System invite'}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="admin-date-cell">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(row.created_at)}</span>
                          </div>
                        </td>
                        <td>{renderActions(row)}</td>
                      </tr>
                    );
                  })
                )}

                {/* Deleted Users - integrated into same table for alignment */}
                {showDeletedUsers &&
                  deletedUsersData &&
                  deletedUsersData.deleted_users &&
                  deletedUsersData.deleted_users.length > 0 && (
                    <>
                      {/* Separator row */}
                      <tr className="admin-table-separator">
                        <td colSpan={6}>
                          <div className="admin-table-separator-content">
                            <Archive className="h-4 w-4" />
                            <span>
                              {t('admin.users.deletedUsers', 'Deleted Users')} (
                              {deletedUsersData.total ?? 0})
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Deleted user rows */}
                      {deletedUsersData.deleted_users.map((deletedUser: AdminDeletedUser) => {
                        const canRestore = deletedUser.can_restore && !deletedUser.is_anonymized;
                        const isRestoring = restoringId === deletedUser.user_id;
                        // Extract name from email (part before @)
                        const emailStr = deletedUser.email ?? '';
                        const nameFromEmail = emailStr
                          ? (emailStr.split('@')[0] ?? '').replace(/[._]/g, ' ')
                          : null;

                        // Look up who deleted this user
                        let deletedByName = 'Unknown';
                        if (deletedUser.deleted_by) {
                          if (deletedUser.deleted_by === currentUser?.id) {
                            deletedByName = currentUser.email?.split('@')[0] || 'you';
                          } else {
                            const deleter = usersData?.users?.find(
                              (u: AdminPlatformUser) => u.id === deletedUser.deleted_by
                            );
                            if (deleter?.email) {
                              deletedByName = deleter.email.split('@')[0] || 'Unknown';
                            }
                          }
                        }

                        return (
                          <tr
                            key={`deleted-${deletedUser.user_id}`}
                            className={`admin-deleted-row ${deletedUser.is_anonymized ? 'admin-row-muted' : ''}`}
                          >
                            {/* Name */}
                            <td>
                              <span>{nameFromEmail || '-'}</span>
                            </td>
                            {/* Email */}
                            <td>
                              <div className="admin-user-cell">
                                <Mail className="h-4 w-4" />
                                <span>
                                  {deletedUser.email || t('admin.users.anonymized', '[Anonymized]')}
                                </span>
                              </div>
                            </td>
                            {/* Status */}
                            <td>
                              <div className="admin-status-cell">
                                {deletedUser.deletion_reason ? (
                                  <Tooltip
                                    content={
                                      <div className="admin-audit-reason-tooltip">
                                        <strong>
                                          {t('admin.users.deletionReason', 'Reason')}:
                                        </strong>
                                        <p>{deletedUser.deletion_reason}</p>
                                      </div>
                                    }
                                    side="top"
                                  >
                                    <span className="admin-status-badge admin-status-badge--deleted admin-status-badge--has-reason">
                                      {t('admin.users.deleted', 'Deleted')}
                                      <Eye className="h-3 w-3" />
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <span className="admin-status-badge admin-status-badge--deleted">
                                    {t('admin.users.deleted', 'Deleted')}
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Activity - "Deleted by [person]" */}
                            <td>
                              <Tooltip content={formatDate(deletedUser.deleted_at)} side="top">
                                <div className="admin-date-cell" style={{ cursor: 'help' }}>
                                  <Trash2 className="h-4 w-4" />
                                  <span>Deleted by {deletedByName}</span>
                                </div>
                              </Tooltip>
                            </td>
                            {/* Created column - show restoration deadline */}
                            <td>
                              {canRestore ? (
                                <Tooltip
                                  content={t(
                                    'admin.users.restoreDeadlineTooltip',
                                    'After this period, the user will be permanently anonymized and cannot be restored.'
                                  )}
                                  side="top"
                                >
                                  <span
                                    className="admin-deadline-warning"
                                    style={{ cursor: 'help' }}
                                  >
                                    {deletedUser.days_until_anonymization}{' '}
                                    {t('admin.users.daysLeft', 'days left')}
                                  </span>
                                </Tooltip>
                              ) : (
                                <Tooltip
                                  content={
                                    deletedUser.is_anonymized
                                      ? t(
                                          'admin.users.anonymizedTooltip',
                                          'This user has been permanently anonymized. All personal data has been removed.'
                                        )
                                      : t(
                                          'admin.users.expiredTooltip',
                                          'The restoration period has expired.'
                                        )
                                  }
                                  side="top"
                                >
                                  <span className="admin-muted" style={{ cursor: 'help' }}>
                                    {deletedUser.is_anonymized
                                      ? t('admin.users.anonymized', 'Anonymized')
                                      : t('admin.users.expired', 'Expired')}
                                  </span>
                                </Tooltip>
                              )}
                            </td>
                            {/* Actions */}
                            <td>
                              <div className="admin-actions-cell">
                                {canRestore ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="admin-kebab-btn" aria-label="Actions">
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          setTimeout(() => {
                                            handleRestoreUser(
                                              deletedUser.user_id,
                                              deletedUser.email || ''
                                            );
                                          }, 0);
                                        }}
                                        disabled={isRestoring}
                                      >
                                        {isRestoring ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RotateCcw className="h-4 w-4" />
                                        )}
                                        {t('admin.users.restoreUser', 'Restore User')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="admin-muted">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <DeleteUserModal
          user={userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={(reason) => handleDeleteUser(userToDelete, reason)}
        />
      )}

      {/* Suspend User Confirmation Modal */}
      {userToSuspend && (
        <SuspendUserModal
          user={userToSuspend}
          isSuspended={isUserSuspended(userToSuspend)}
          onClose={() => setUserToSuspend(null)}
          onConfirm={(reason) => handleToggleSuspend(userToSuspend, reason)}
        />
      )}

      {/* Impersonate User Modal */}
      {userToImpersonate && (
        <ImpersonateUserModal
          isOpen={!!userToImpersonate}
          onClose={() => setUserToImpersonate(null)}
          targetUser={{
            id: userToImpersonate.id,
            email: userToImpersonate.email,
          }}
        />
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={async () => {
            setShowInviteModal(false);
            // Only reset invitations query - don't touch users/deleted-users to preserve their optimistic updates
            await queryClient.resetQueries({ queryKey: ['admin', 'invitations'] });
            toast.success('Invitation sent', {
              description: 'An invitation email has been sent to the user.',
            });
          }}
        />
      )}

      {/* Delete Invitation Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, invitationId: '', email: '' });
          }
        }}
        title="Delete Invitation"
        description={`Are you sure you want to delete the invitation for ${confirmDialog.email}? This will permanently remove it. To invite them again, you'll need to create a new invitation.`}
        confirmLabel="Delete Invitation"
        cancelLabel="Keep Invitation"
        variant="danger"
        onConfirm={() => handleCancelInvitation(confirmDialog.invitationId, confirmDialog.email)}
        loading={!!cancellingId}
      />
    </div>
  );
}

// =============================================================================
// Delete User Confirmation Modal
// =============================================================================

interface DeleteUserModalProps {
  user: AdminPlatformUser;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

function DeleteUserModal({ user, onClose, onConfirm }: DeleteUserModalProps) {
  const { t } = useTranslation();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');

  const isConfirmValid = confirmEmail.toLowerCase() === user.email.toLowerCase();

  const handleConfirm = () => {
    if (isConfirmValid) {
      onConfirm(reason || undefined);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="admin-modal admin-modal--warning"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="admin-modal-header">
          <h3 id="delete-modal-title">
            <Trash2 className="h-5 w-5" />
            {t('admin.users.deleteTitle', 'Delete User')}
          </h3>
          <button
            className="admin-modal-close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="admin-modal-body">
          {/* Soft delete explanation */}
          <div className="admin-delete-info">
            <p className="admin-delete-info-title">
              {t('admin.users.softDeleteTitle', 'What happens when you delete a user:')}
            </p>
            <ul className="admin-delete-info-list">
              <li>{t('admin.users.softDelete1', 'User will be banned and unable to log in')}</li>
              <li>{t('admin.users.softDelete2', 'All their data is preserved but hidden')}</li>
              <li>{t('admin.users.softDelete3', 'You can restore this user within 30 days')}</li>
              <li>
                {t('admin.users.softDelete4', 'After 30 days, their data will be anonymized')}
              </li>
            </ul>
          </div>

          <div className="admin-modal-user-info">
            <div className="admin-modal-user-avatar">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="admin-modal-user-email">{user.email}</p>
              <p className="admin-modal-user-meta">
                {t('admin.users.createdOn', 'Created on {{date}}', {
                  date: formatDate(user.created_at),
                })}
              </p>
            </div>
          </div>

          {/* Reason input */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                marginBottom: 'var(--space-2)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('admin.users.deleteReason', 'Reason for deletion (optional)')}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                'admin.users.deleteReasonPlaceholder',
                'e.g., User requested account deletion'
              )}
              className="admin-input"
              style={{ width: '100%' }}
            />
          </div>

          {/* Type-to-confirm */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                marginBottom: 'var(--space-2)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('admin.users.typeToConfirm', 'Type the user email to confirm:')}
              <span
                style={{
                  fontFamily: 'monospace',
                  marginLeft: 'var(--space-2)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {user.email}
              </span>
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
              className="admin-input"
              style={{
                width: '100%',
                borderColor:
                  confirmEmail && !isConfirmValid ? 'var(--color-destructive)' : undefined,
              }}
              autoComplete="off"
            />
            {confirmEmail && !isConfirmValid && (
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-destructive)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {t('admin.users.emailMismatch', 'Email does not match')}
              </p>
            )}
          </div>
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--secondary"
            onClick={onClose}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="admin-action-btn admin-action-btn--warning"
            onClick={handleConfirm}
            disabled={!isConfirmValid}
          >
            <Trash2 className="h-4 w-4" />
            {t('admin.users.confirmDelete', 'Delete User')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Suspend User Confirmation Modal
// =============================================================================

interface SuspendUserModalProps {
  user: AdminPlatformUser;
  isSuspended: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

function SuspendUserModal({ user, isSuspended, onClose, onConfirm }: SuspendUserModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason || undefined);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspend-modal-title"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={`admin-modal ${isSuspended ? 'admin-modal--success' : 'admin-modal--warning'}`}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="admin-modal-header">
          <h3 id="suspend-modal-title">
            {isSuspended ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
            {isSuspended
              ? t('admin.users.unsuspendTitle', 'Unsuspend User')
              : t('admin.users.suspendTitle', 'Suspend User')}
          </h3>
          <button
            className="admin-modal-close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="admin-modal-body">
          <p className="admin-modal-text">
            {isSuspended
              ? t(
                  'admin.users.unsuspendDesc',
                  "This will restore the user's access to the platform."
                )
              : t(
                  'admin.users.suspendDesc',
                  'This will prevent the user from logging in. Their data will be preserved.'
                )}
          </p>

          <div className="admin-modal-user-info">
            <div className="admin-modal-user-avatar">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="admin-modal-user-email">{user.email}</p>
              <p className="admin-modal-user-meta">
                {isSuspended
                  ? t('admin.users.currentlySuspended', 'Currently suspended')
                  : t('admin.users.currentlyActive', 'Currently active')}
              </p>
            </div>
          </div>

          {/* Reason input - only show when suspending */}
          {!isSuspended && (
            <div className="admin-form-group">
              <label htmlFor="suspend-reason">
                {t('admin.users.suspendReason', 'Reason for suspension')}
                <span className="admin-required">*</span>
              </label>
              <input
                id="suspend-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  'admin.users.suspendReasonPlaceholder',
                  'e.g., Violation of terms of service'
                )}
                className="admin-input"
              />
            </div>
          )}

          {/* Reason input for unsuspend - optional */}
          {isSuspended && (
            <div className="admin-form-group">
              <label htmlFor="unsuspend-reason">
                {t('admin.users.unsuspendReason', 'Reason for unsuspension (optional)')}
              </label>
              <input
                id="unsuspend-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  'admin.users.unsuspendReasonPlaceholder',
                  'e.g., Issue resolved, user reinstated'
                )}
                className="admin-input"
              />
            </div>
          )}
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--secondary"
            onClick={onClose}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={`admin-action-btn ${isSuspended ? 'admin-action-btn--success' : 'admin-action-btn--warning'}`}
            onClick={handleConfirm}
            disabled={!isSuspended && !reason.trim()}
          >
            {isSuspended ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            {isSuspended
              ? t('admin.users.confirmUnsuspend', 'Unsuspend User')
              : t('admin.users.confirmSuspend', 'Suspend User')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Invite User Modal
// =============================================================================

interface InviteUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function InviteUserModal({ onClose, onSuccess }: InviteUserModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const request: CreateInvitationRequest = {
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };

      await api.createAdminInvitation(request);
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="document">
        <div className="admin-modal-header">
          <h3 id="invite-modal-title">{t('admin.invitations.inviteTitle', 'Invite New User')}</h3>
          <button
            className="admin-modal-close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-form">
          {error && (
            <div className="admin-modal-error">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="admin-form-group">
            <label htmlFor="invite-email">
              {t('admin.invitations.emailLabel', 'Email Address')}
              <span className="admin-required">*</span>
            </label>
            <input
              id="invite-email"
              type="email"
              required
              placeholder={t('admin.invitations.emailPlaceholder', 'user@example.com')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input"
              autoFocus
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="invite-name">
              {t('admin.invitations.nameLabel', 'Name (optional)')}
            </label>
            <input
              id="invite-name"
              type="text"
              placeholder={t('admin.invitations.namePlaceholder', 'John Doe')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="invite-notes">
              {t('admin.invitations.notesLabel', 'Notes (internal only)')}
            </label>
            <textarea
              id="invite-notes"
              placeholder={t(
                'admin.invitations.notesPlaceholder',
                'Optional notes about this invitation...'
              )}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="admin-textarea"
              rows={3}
            />
          </div>

          <div className="admin-modal-actions">
            <button
              type="button"
              className="admin-action-btn admin-action-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="admin-action-btn admin-action-btn--primary"
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin.invitations.sending', 'Sending...')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('admin.invitations.sendInvite', 'Send Invitation')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
