import { Crown, Shield, UserIcon, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { formatDate } from '../../lib/dateUtils';
import { useTeam } from './hooks/useTeam';

// Role configuration for display
const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, color: '#6366f1', description: 'Full control' },
  admin: { label: 'Admin', icon: Shield, color: '#3b82f6', description: 'Manage members' },
  member: { label: 'Member', icon: UserIcon, color: '#6b7280', description: 'View & contribute' }
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
          <Skeleton width={115} height={36} className="rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="members-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="member-row">
              <div className="member-role-icon">
                <Skeleton variant="circular" width={18} height={18} />
              </div>
              <div className="member-info">
                <Skeleton width={80} height={14} />
                <Skeleton width={50} height={12} className="mt-0.5" />
              </div>
              <Skeleton width={110} height={12} />
              <div className="member-actions">
                <Skeleton width={28} height={28} className="rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Usage Statistics Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <Skeleton width={130} height={16} />
        <Skeleton width={200} height={13} className="mt-1" />
      </CardHeader>
      <CardContent>
        <div className="usage-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="usage-stat">
              <Skeleton width={40} height={24} />
              <Skeleton width={90} height={12} className="mt-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </>
);

export function TeamSection({ user, isOpen, companyId, onRemoveMember }) {
  const {
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
                className="flex items-center gap-1.5"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <Plus size={16} />
                Add Member
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
                <Select value={newRole} onValueChange={setNewRole}>
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
                <div key={member.id} className={`member-row ${isCurrentUser ? 'current' : ''}`}>
                  <div className="member-role-icon" style={{ color: roleConfig.color }}>
                    <RoleIcon size={18} />
                  </div>
                  <div className="member-info">
                    <span className="member-name">
                      {isCurrentUser ? 'You' : `User ${member.user_id.slice(0, 8)}...`}
                    </span>
                    <span className="member-role-label" style={{ color: roleConfig.color }}>
                      {roleConfig.label}
                    </span>
                  </div>
                  <div className="member-joined">
                    Joined {formatDate(member.joined_at || member.created_at)}
                  </div>
                  {isLoading ? (
                    <div className="member-actions">
                      <Spinner size={16} />
                    </div>
                  ) : (
                    <div className="member-actions">
                      {canPromote && (
                        <button
                          className="icon-btn promote"
                          onClick={() => handleChangeRole(member.id, 'admin')}
                          title="Promote to Admin"
                        >
                          <ChevronUp size={16} />
                        </button>
                      )}
                      {canDemote && (
                        <button
                          className="icon-btn demote"
                          onClick={() => handleChangeRole(member.id, 'member')}
                          title="Demote to Member"
                        >
                          <ChevronDown size={16} />
                        </button>
                      )}
                      {canRemove && (
                        <button
                          className="icon-btn danger"
                          onClick={() => onRemoveMember(member.id, member.role, handleRemoveMember)}
                          title="Remove from team"
                        >
                          <Trash2 size={16} />
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

      {/* Usage Statistics (for owners/admins) */}
      {usage && (
        <Card className="settings-card">
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Council usage for your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="usage-grid">
              <div className="usage-stat">
                <span className="usage-value">{usage.sessions_this_month}</span>
                <span className="usage-label">Sessions this month</span>
              </div>
              <div className="usage-stat">
                <span className="usage-value">{usage.total_sessions}</span>
                <span className="usage-label">Total sessions</span>
              </div>
              <div className="usage-stat">
                <span className="usage-value">
                  {((usage.tokens_this_month_input + usage.tokens_this_month_output) / 1000).toFixed(1)}k
                </span>
                <span className="usage-label">Tokens this month</span>
              </div>
              <div className="usage-stat">
                <span className="usage-value">
                  {((usage.total_tokens_input + usage.total_tokens_output) / 1000).toFixed(1)}k
                </span>
                <span className="usage-label">Total tokens</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
