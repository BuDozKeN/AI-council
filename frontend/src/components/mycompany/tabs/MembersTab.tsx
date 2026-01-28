/**
 * MembersTab - Company members management
 *
 * Shows:
 * - List of company members with their roles (owner, admin, member)
 * - Add member form (by email)
 * - Role management (promote/demote)
 *
 * Per Council recommendation: Simple team management for MVP
 * - Single owner per company
 * - Roles: owner, admin, member
 * - No email sending yet - manual addition only
 */

import { formatDate } from '../../../lib/dateUtils';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import {
  Users,
  Crown,
  Shield,
  User,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Spinner } from '../../ui/Spinner';
import { ScrollableContent } from '../../ui/ScrollableContent';

type MemberRole = 'owner' | 'admin' | 'member';

interface Member {
  id: string;
  user_id: string;
  role: MemberRole;
  joined_at?: string;
  created_at?: string;
}

interface RoleConfigEntry {
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

interface MembersTabProps {
  companyId: string;
  currentUserId: string;
}

// Role hierarchy for display - uses CSS variables for theming
const ROLE_CONFIG: Record<MemberRole, RoleConfigEntry> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    color: 'var(--color-indigo-500)',
    description: 'Full control',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'var(--color-blue-500)',
    description: 'Manage members',
  },
  member: {
    label: 'Member',
    icon: User,
    color: 'var(--color-gray-500)',
    description: 'View & contribute',
  },
};

export function MembersTab({
  companyId,
  currentUserId, // To identify current user and their role
}: MembersTabProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null); // member id being acted on

  // Current user's role (derived from members list)
  const currentMember = members.find((m) => m.user_id === currentUserId);
  const currentRole = currentMember?.role || 'member';
  const canManageMembers = ['owner', 'admin'].includes(currentRole);

  // Load members and usage
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData is stable
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load members
      const membersResult = await api.getCompanyMembers(companyId);
      setMembers(membersResult.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setAdding(true);
      setAddError(null);

      // API only accepts 'admin' | 'member' roles (not 'owner')
      await api.addCompanyMember(companyId, newEmail.trim(), newRole as 'admin' | 'member');

      // Refresh list
      await loadData();

      // Reset form
      setNewEmail('');
      setNewRole('member');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAdding(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      setActionLoading(memberId);
      await api.updateCompanyMember(companyId, memberId, newRole);
      await loadData();
    } catch (err) {
      // Show error inline
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: MemberRole) => {
    if (!confirm(`Are you sure you want to remove this ${memberRole}?`)) return;

    try {
      setActionLoading(memberId);
      await api.removeCompanyMember(companyId, memberId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="mc-loading">
        <Spinner size={24} />
        <span>{t('mycompany.loadingTeam')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mc-error">
        <AlertCircle size={20} />
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={loadData}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mc-members">
      {/* Header with count and add button */}
      <div className="mc-members-header">
        <div className="mc-members-count">
          <Users size={18} />
          <span>{t('settings.memberCount', { count: members.length })}</span>
        </div>
        {canManageMembers && (
          <Button variant="default" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={16} />
            {t('settings.addMember')}
          </Button>
        )}
      </div>

      {/* Add member form */}
      {showAddForm && (
        <form className="mc-add-member-form" onSubmit={handleAddMember}>
          <div className="mc-form-row">
            <input
              id="mc-new-member-email"
              name="member-email"
              type="email"
              placeholder={t('settings.emailAddress')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mc-input"
              autoFocus
            />
            <select
              id="mc-new-member-role"
              name="member-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as MemberRole)}
              className="mc-select"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" variant="default" disabled={adding || !newEmail.trim()}>
              {adding ? <Spinner size={14} /> : 'Add'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
          {addError && (
            <div className="mc-form-error">
              <AlertCircle size={14} />
              {addError}
            </div>
          )}
          <p className="mc-form-hint">
            User must have an existing account. They will automatically see this company.
          </p>
        </form>
      )}

      {/* Members list with scroll-to-top */}
      <ScrollableContent className="mc-members-list-wrapper">
        <div className="mc-members-list">
          {members.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
            const RoleIcon = roleConfig.icon;
            const isCurrentUser = member.user_id === currentUserId;
            const isLoading = actionLoading === member.id;

            // Can this member be modified?
            const canModify = canManageMembers && !isCurrentUser && member.role !== 'owner';
            const canPromote = canModify && currentRole === 'owner' && member.role === 'member';
            const canDemote = canModify && currentRole === 'owner' && member.role === 'admin';
            const canRemove =
              canModify &&
              (currentRole === 'owner' || (currentRole === 'admin' && member.role === 'member'));

            return (
              <div key={member.id} className={`mc-member-row ${isCurrentUser ? 'current' : ''}`}>
                {/* Role badge */}
                <div className="mc-member-role" style={{ color: roleConfig.color }}>
                  <RoleIcon size={18} />
                </div>

                {/* User info */}
                <div className="mc-member-info">
                  <span className="mc-member-name">
                    {/* Email display requires backend user lookup (auth.users view) */}
                    {isCurrentUser ? t('settings.you') : `User ${member.user_id.slice(0, 8)}...`}
                  </span>
                  <span className="mc-member-role-label" style={{ color: roleConfig.color }}>
                    {roleConfig.label}
                  </span>
                </div>

                {/* Joined date */}
                <div className="mc-member-joined">
                  {t('mycompany.joined')} {formatDate(member.joined_at || member.created_at)}
                </div>

                {/* Actions */}
                {isLoading ? (
                  <div className="mc-member-actions">
                    <Spinner size={16} />
                  </div>
                ) : (
                  <div className="mc-member-actions">
                    {canPromote && (
                      <button
                        className="mc-icon-btn promote"
                        onClick={() => handleChangeRole(member.id, 'admin')}
                        title={t('settings.promoteToAdmin')}
                        aria-label={t('settings.promoteToAdmin')}
                      >
                        <ChevronUp size={16} aria-hidden="true" />
                      </button>
                    )}
                    {canDemote && (
                      <button
                        className="mc-icon-btn demote"
                        onClick={() => handleChangeRole(member.id, 'member')}
                        title={t('settings.demoteToMember')}
                        aria-label={t('settings.demoteToMember')}
                      >
                        <ChevronDown size={16} aria-hidden="true" />
                      </button>
                    )}
                    {canRemove && (
                      <button
                        className="mc-icon-btn danger"
                        onClick={() => handleRemoveMember(member.id, member.role)}
                        title={t('settings.removeFromTeam')}
                        aria-label={t('settings.removeFromTeam')}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollableContent>
    </div>
  );
}
