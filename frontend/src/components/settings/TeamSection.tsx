import { useTranslation } from 'react-i18next';
import {
  Crown,
  Shield,
  UserIcon,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Mail,
  Clock,
  RefreshCw,
  X,
  LucideIcon,
} from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useTeam, type TeamRole } from './hooks/useTeam';
import type { User } from '@supabase/supabase-js';
import './TeamSection.css';

interface TeamSectionProps {
  user: User | null;
  isOpen: boolean;
  companyId: string;
  onRemoveMember: (
    memberId: string,
    role: TeamRole,
    handler: (memberId: string) => Promise<void>
  ) => void;
}

// Role configuration for display - uses CSS variables for theming
// Labels are translated at render time using the roleKey
interface RoleConfigStatic {
  roleKey: 'owner' | 'admin' | 'member';
  icon: LucideIcon;
  color: string;
  descKey: 'fullControl' | 'manageMembers' | 'viewContribute';
}

const ROLE_CONFIG: Record<TeamRole, RoleConfigStatic> = {
  owner: {
    roleKey: 'owner',
    icon: Crown,
    color: 'var(--color-indigo-500)',
    descKey: 'fullControl',
  },
  admin: {
    roleKey: 'admin',
    icon: Shield,
    color: 'var(--color-blue-500)',
    descKey: 'manageMembers',
  },
  member: {
    roleKey: 'member',
    icon: UserIcon,
    color: 'var(--color-gray-500)',
    descKey: 'viewContribute',
  },
};

const TeamSkeleton = () => (
  <>
    {/* Team Members Card Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton width={120} height={16} />
            <Skeleton width={70} height={13} className="mt-1" />
          </div>
          <Skeleton width={44} height={44} className="rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="members-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="member-row-compact">
              <Skeleton variant="circular" width={16} height={16} />
              <Skeleton width={60} height={14} />
              <Skeleton width={50} height={18} className="rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </>
);

export function TeamSection({ user, isOpen, companyId, onRemoveMember }: TeamSectionProps) {
  const { t } = useTranslation();
  const {
    members,
    pendingInvitations,
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
  } = useTeam(isOpen, companyId, user);

  // Format relative date for invitation expiry
  const formatRelativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  if (teamLoading) {
    return <TeamSkeleton />;
  }

  if (teamError) {
    return (
      <Card className="settings-card">
        <CardContent className="flex items-center justify-center p-6 gap-3 text-red-500">
          <AlertCircle size={20} />
          <span>{teamError}</span>
          <Button variant="outline" onClick={loadTeamData}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Team Members Card */}
      <Card className="settings-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('settings.teamMembers')}</CardTitle>
              <CardDescription>
                {t('settings.memberCount', { count: members.length })}
              </CardDescription>
            </div>
            {canManageMembers && (
              <Button
                variant="default"
                onClick={() => setShowAddForm(!showAddForm)}
                className="add-member-btn"
              >
                <Plus size={16} />
                <span className="add-member-text">{t('settings.addMember')}</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Add member form */}
          {showAddForm && (
            <form onSubmit={handleAddMember} className="add-member-form">
              <div className="form-row">
                <label htmlFor="new-member-email" className="sr-only">
                  {t('settings.emailAddress')}
                </label>
                <input
                  id="new-member-email"
                  name="member-email"
                  type="email"
                  placeholder={t('settings.emailAddress')}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="form-input"
                  autoFocus
                  aria-label={t('settings.emailAddress')}
                  required
                />
                <Select
                  value={newRole}
                  onValueChange={(value: string) => setNewRole(value as TeamRole)}
                >
                  <SelectTrigger className="form-select" aria-label={t('settings.selectRole', 'Role')}>
                    <SelectValue placeholder={t('settings.selectRole', 'Role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t('settings.member')}</SelectItem>
                    <SelectItem value="admin">{t('settings.admin')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" variant="default" disabled={addingMember || !newEmail.trim()}>
                  {addingMember ? <Spinner size={14} /> : t('common.add')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
              {addError && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  {addError}
                </div>
              )}
              <p className="form-hint">An invitation email will be sent.</p>
            </form>
          )}

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="pending-invitations-section">
              <h4 className="section-subtitle">
                Pending Invitations
                <span className="count-badge">{pendingInvitations.length}</span>
              </h4>
              <ul className="invitations-list" aria-label="Pending invitations">
                {pendingInvitations.map((invitation) => {
                  const roleConfig =
                    ROLE_CONFIG[invitation.target_company_role] || ROLE_CONFIG.member;
                  const isLoading = invitationActionLoading === invitation.id;

                  return (
                    <li key={invitation.id} className="invitation-row" aria-label={`${invitation.email}, ${t(`settings.${roleConfig.roleKey}`)}`}>
                      <div className="invitation-icon">
                        <Mail size={16} />
                      </div>
                      <span className="invitation-email">{invitation.email}</span>
                      <span className="member-role-badge" style={{ color: roleConfig.color }}>
                        {t(`settings.${roleConfig.roleKey}`)}
                      </span>
                      <span className="invitation-status">
                        <Clock size={12} />
                        {formatRelativeDate(invitation.expires_at)}
                      </span>
                      {isLoading ? (
                        <Spinner size={14} />
                      ) : (
                        <div className="invitation-actions">
                          <button
                            className="icon-btn"
                            onClick={() => handleResendInvitation(invitation.id)}
                            title="Resend invitation"
                            aria-label={`Resend invitation to ${invitation.email}`}
                          >
                            <RefreshCw size={14} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            title="Cancel invitation"
                            aria-label={`Cancel invitation to ${invitation.email}`}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Members list */}
          <ul className="members-list" aria-label="Team members">
            {members.map((member) => {
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
              const RoleIcon = roleConfig.icon;
              const isCurrentUser = member.user_id === user?.id;
              const isLoading = memberActionLoading === member.id;

              const canModify = canManageMembers && !isCurrentUser && member.role !== 'owner';
              const canPromote =
                canModify && currentUserRole === 'owner' && member.role === 'member';
              const canDemote = canModify && currentUserRole === 'owner' && member.role === 'admin';
              const canRemove =
                canModify &&
                (currentUserRole === 'owner' ||
                  (currentUserRole === 'admin' && member.role === 'member'));

              return (
                <li
                  key={member.id}
                  className={`member-row-compact ${isCurrentUser ? 'current' : ''}`}
                  aria-label={`${isCurrentUser ? t('settings.you') : `User ${member.user_id.slice(0, 8)}`}, ${t(`settings.${roleConfig.roleKey}`)}`}
                >
                  <div className="member-role-icon" style={{ color: roleConfig.color }}>
                    <RoleIcon size={16} />
                  </div>
                  <span className="member-name">
                    {isCurrentUser ? t('settings.you') : `User ${member.user_id.slice(0, 8)}...`}
                  </span>
                  <span className="member-role-badge" style={{ color: roleConfig.color }}>
                    {t(`settings.${roleConfig.roleKey}`)}
                  </span>
                  {isLoading ? (
                    <Spinner size={14} />
                  ) : (
                    <div className="member-actions">
                      {canPromote && (
                        <button
                          className="icon-btn promote"
                          onClick={() => handleChangeRole(member.id, 'admin')}
                          title={t('settings.promoteToAdmin')}
                          aria-label={t('settings.promoteToAdmin')}
                        >
                          <ChevronUp size={14} aria-hidden="true" />
                        </button>
                      )}
                      {canDemote && (
                        <button
                          className="icon-btn demote"
                          onClick={() => handleChangeRole(member.id, 'member')}
                          title={t('settings.demoteToMember')}
                          aria-label={t('settings.demoteToMember')}
                        >
                          <ChevronDown size={14} aria-hidden="true" />
                        </button>
                      )}
                      {canRemove && (
                        <button
                          className="icon-btn danger"
                          onClick={() => onRemoveMember(member.id, member.role, handleRemoveMember)}
                          title={t('settings.removeFromTeam')}
                          aria-label={t('settings.removeFromTeam')}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
