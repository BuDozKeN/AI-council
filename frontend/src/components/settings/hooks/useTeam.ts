import { useState, useEffect } from 'react';
import { api } from '../../../api';
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
  const [usage, setUsage] = useState<TeamUsage | null>(null);
  const [teamLoading, setTeamLoading] = useState<boolean>(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newRole, setNewRole] = useState<TeamRole>('member');
  const [addError, setAddError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState<boolean>(false);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && companyId) {
      loadTeamData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadTeamData is stable
  }, [isOpen, companyId]);

  const loadTeamData = async () => {
    if (!companyId) return;
    try {
      setTeamLoading(true);
      setTeamError(null);

      const membersResult = await api.getCompanyMembers(companyId);
      setMembers(membersResult.members || []);

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
      await api.addCompanyMember(
        companyId,
        newEmail.trim(),
        newRole === 'owner' ? 'admin' : newRole
      );
      await loadTeamData();
      setNewEmail('');
      setNewRole('member');
      setShowAddForm(false);
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

  // Derived state
  const currentMember = members.find((m) => m.user_id === user?.id);
  const currentUserRole = currentMember?.role || 'member';
  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);

  return {
    members,
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
    currentUserRole,
    canManageMembers,
    loadTeamData,
    handleAddMember,
    handleChangeRole,
    handleRemoveMember,
  };
}
