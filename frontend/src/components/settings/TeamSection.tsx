import { Crown, Shield, UserIcon, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle, LucideIcon } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useTeam, type TeamRole } from './hooks/useTeam';
import type { User } from '@supabase/supabase-js';

interface RoleConfigEntry {
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

interface TeamSectionProps {
  user: User | null;
  isOpen: boolean;
  companyId: string;
  onRemoveMember: (memberId: string, role: TeamRole, handler: (memberId: string) => Promise<void>) => void;
}

// Role configuration for display - uses CSS variables for theming
const ROLE_CONFIG: Record<TeamRole, RoleConfigEntry> = {
  owner: { label: 'Owner', icon: Crown, color: 'var(--color-indigo-500)', description: 'Full control' },
  admin: { label: 'Admin', icon: Shield, color: 'var(--color-blue-500)', description: 'Manage members' },
  member: { label: 'Member', icon: UserIcon, color: 'var(--color-gray-500)', description: 'View & contribute' }
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
  const {
    members,
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
  } = useTeam(isOpen, companyId, user);

  if (teamLoading) {
    return <TeamSkeleton />;
  }

  if (teamError) {
    return (
      <Card className="settings-card">
        <CardContent className="flex items-center justify-center p-6 gap-3 text-red-500">
          <AlertCircle size={20} />
          <span>{teamError}</span>
          <Button variant="outline" onClick={loadTeamData}>Retry</Button>
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
              <CardTitle>Team Members</CardTitle>
              <CardDescription>{members.length} {members.length === 1 ? 'member' : 'members'}</CardDescription>
            </div>
            {canManageMembers && (
              <Button
                variant="default"
                onClick={() => setShowAddForm(!showAddForm)}
                className="add-member-btn"
              >
                <Plus size={16} />
                <span className="add-member-text">Add Member</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Add member form */}
          {showAddForm && (
            <form onSubmit={handleAddMember} className="add-member-form">
              <div className="form-row">
                <input
                  type="email"
                  placeholder="Email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="form-input"
                  autoFocus
                />
                <Select value={newRole} onValueChange={(value: string) => setNewRole(value as TeamRole)}>
                  <SelectTrigger className="form-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" variant="default" disabled={addingMember || !newEmail.trim()}>
                  {addingMember ? <Spinner size={14} /> : 'Add'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
              {addError && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  {addError}
                </div>
              )}
              <p className="form-hint">User must have an existing account to be added.</p>
            </form>
          )}

          {/* Members list */}
          <div className="members-list">
            {members.map(member => {
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
              const RoleIcon = roleConfig.icon;
              const isCurrentUser = member.user_id === user?.id;
              const isLoading = memberActionLoading === member.id;

              const canModify = canManageMembers && !isCurrentUser && member.role !== 'owner';
              const canPromote = canModify && currentUserRole === 'owner' && member.role === 'member';
              const canDemote = canModify && currentUserRole === 'owner' && member.role === 'admin';
              const canRemove = canModify && (currentUserRole === 'owner' || (currentUserRole === 'admin' && member.role === 'member'));

              return (
                <div key={member.id} className={`member-row-compact ${isCurrentUser ? 'current' : ''}`}>
                  <div className="member-role-icon" style={{ color: roleConfig.color }}>
                    <RoleIcon size={16} />
                  </div>
                  <span className="member-name">
                    {isCurrentUser ? 'You' : `User ${member.user_id.slice(0, 8)}...`}
                  </span>
                  <span className="member-role-badge" style={{ color: roleConfig.color }}>
                    {roleConfig.label}
                  </span>
                  {isLoading ? (
                    <Spinner size={14} />
                  ) : (
                    <div className="member-actions">
                      {canPromote && (
                        <button
                          className="icon-btn promote"
                          onClick={() => handleChangeRole(member.id, 'admin')}
                          title="Promote to Admin"
                        >
                          <ChevronUp size={14} />
                        </button>
                      )}
                      {canDemote && (
                        <button
                          className="icon-btn demote"
                          onClick={() => handleChangeRole(member.id, 'member')}
                          title="Demote to Member"
                        >
                          <ChevronDown size={14} />
                        </button>
                      )}
                      {canRemove && (
                        <button
                          className="icon-btn danger"
                          onClick={() => onRemoveMember(member.id, member.role, handleRemoveMember)}
                          title="Remove from team"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </>
  );
}
