import { useState, useEffect, useRef } from 'react';
import { api } from '../../../api';
import { toast } from '../../ui/sonner';
import type { User } from '@supabase/supabase-js';

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: TeamRole;
  display_name?: string;
  created_at?: string;
  joined_at?: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  target_company_role: TeamRole;
  status: string;
  created_at: string;
  expires_at: string;
  invited_by_email: string | null;
}

export interface TeamUsage {
  queries_used: number;
  queries_limit: number;
  sessions_this_month: number;
  total_sessions: number;
  tokens_this_month_input: number;
  tokens_this_month_output: number;
  total_tokens_input: number;
  total_tokens_output: number;
}

export function useTeam(isOpen: boolean, companyId: string | null, user: User | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [usage, setUsage] = useState<TeamUsage | null>(null);
  const [teamLoading, setTeamLoading] = useState<boolean>(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newRole, setNewRole] = useState<TeamRole>('member');
  const [addError, setAddError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState<boolean>(false);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [invitationActionLoading, setInvitationActionLoading] = useState<string | null>(null);
  // ISS-198/199: Prevent duplicate API calls from StrictMode or tab re-opening
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (isOpen && companyId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadTeamData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadTeamData is stable
  }, [isOpen, companyId]);

  const loadTeamData = async () => {
    if (!companyId) return;
    try {
      setTeamLoading(true);
      setTeamError(null);

      // Load members and invitations in parallel
      const [membersResult, invitationsResult] = await Promise.all([
        api.getCompanyMembers(companyId),
        api.getCompanyInvitations(companyId).catch(() => ({ invitations: [] })),
      ]);

      setMembers(membersResult.members || []);
      setPendingInvitations(invitationsResult.invitations || []);

      // Try to load usage (may fail if not admin)
      try {
        const usageResult = await api.getCompanyUsage(companyId);
        setUsage(usageResult.usage);
      } catch {
        setUsage(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load team';
      setTeamError(message);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newEmail.trim() || !companyId) return;

    try {
      setAddingMember(true);
      setAddError(null);
      const result = await api.addCompanyMember(
        companyId,
        newEmail.trim(),
        newRole === 'owner' ? 'admin' : newRole
      );
      await loadTeamData();
      setNewEmail('');
      setNewRole('member');
      setShowAddForm(false);

      // Check if email was sent successfully
      if (result.email_sent === false) {
        toast.warning('Invitation created but email could not be sent', {
          description: 'Please use "Resend" or contact the user directly.',
          duration: 8000,
        });
      } else {
        toast.success('Invitation sent', {
          description: `Invitation email sent to ${result.email || newEmail.trim()}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member';
      setAddError(message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleChangeRole = async (memberId: string, role: TeamRole): Promise<void> => {
    if (!companyId) return;
    try {
      setMemberActionLoading(memberId);
      await api.updateCompanyMember(companyId, memberId, role === 'owner' ? 'admin' : role);
      await loadTeamData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change role';
      alert(message);
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string): Promise<void> => {
    if (!companyId) return;
    try {
      setMemberActionLoading(memberId);
      await api.removeCompanyMember(companyId, memberId);
      await loadTeamData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setTeamError(message);
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string): Promise<void> => {
    if (!companyId) return;
    try {
      setInvitationActionLoading(invitationId);
      await api.cancelCompanyInvitation(companyId, invitationId);
      await loadTeamData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel invitation';
      alert(message);
    } finally {
      setInvitationActionLoading(null);
    }
  };

  const handleResendInvitation = async (invitationId: string): Promise<void> => {
    if (!companyId) return;
    try {
      setInvitationActionLoading(invitationId);
      const result = await api.resendCompanyInvitation(companyId, invitationId);
      await loadTeamData();

      // Check if email was sent successfully
      if (result.email_sent === false) {
        toast.warning('Invitation updated but email could not be sent', {
          description: 'Please try again or contact the user directly.',
          duration: 8000,
        });
      } else {
        toast.success('Invitation resent', {
          description: `Email sent to ${result.email || 'the invitee'}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend invitation';
      toast.error('Failed to resend invitation', { description: message });
    } finally {
      setInvitationActionLoading(null);
    }
  };

  // Derived state
  const currentMember = members.find((m) => m.user_id === user?.id);
  const currentUserRole = currentMember?.role || 'member';
  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);

  return {
    members,
    pendingInvitations,
    usage,
    teamLoading,
    teamError,
    showAddForm,
    setShowAddForm,
    newEmail,
    setNewEmail,
    newRole,
    setNewRole,
    addError,
    addingMember,
    memberActionLoading,
    invitationActionLoading,
    currentUserRole,
    canManageMembers,
    loadTeamData,
    handleAddMember,
    handleChangeRole,
    handleRemoveMember,
    handleCancelInvitation,
    handleResendInvitation,
  };
}
