/**
 * MembersTab - Company members management
 *
 * Shows:
 * - List of company members with their roles (owner, admin, member)
 * - Add member form (by email)
 * - Role management (promote/demote)
 * - Usage statistics (for owners/admins)
 *
 * Per Council recommendation: Simple team management for MVP
 * - Single owner per company
 * - Roles: owner, admin, member
 * - No email sending yet - manual addition only
 */

import { useState, useEffect } from 'react';
import { api } from '../../../api';
import { Users, Crown, Shield, User, Plus, Trash2, ChevronUp, ChevronDown, BarChart3, AlertCircle } from 'lucide-react';
import { Spinner } from '../../ui/Spinner';

// Role hierarchy for display
const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, color: '#f59e0b', description: 'Full control' },
  admin: { label: 'Admin', icon: Shield, color: '#3b82f6', description: 'Manage members' },
  member: { label: 'Member', icon: User, color: '#6b7280', description: 'View & contribute' }
};

export function MembersTab({
  companyId,
  currentUserId // To identify current user and their role
}) {
  const [members, setMembers] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add member form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState(null); // member id being acted on

  // Current user's role (derived from members list)
  const currentMember = members.find(m => m.user_id === currentUserId);
  const currentRole = currentMember?.role || 'member';
  const canManageMembers = ['owner', 'admin'].includes(currentRole);

  // Load members and usage
  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load members
      const membersResult = await api.getCompanyMembers(companyId);
      setMembers(membersResult.members || []);

      // Load usage (only if admin/owner - will fail gracefully otherwise)
      try {
        const usageResult = await api.getCompanyUsage(companyId);
        setUsage(usageResult.usage);
      } catch {
        // Not authorized to see usage - that's fine
        setUsage(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setAdding(true);
      setAddError(null);

      await api.addCompanyMember(companyId, newEmail.trim(), newRole);

      // Refresh list
      await loadData();

      // Reset form
      setNewEmail('');
      setNewRole('member');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      setActionLoading(memberId);
      await api.updateCompanyMember(companyId, memberId, newRole);
      await loadData();
    } catch (err) {
      // Show error inline
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId, memberRole) => {
    if (!confirm(`Are you sure you want to remove this ${memberRole}?`)) return;

    try {
      setActionLoading(memberId);
      await api.removeCompanyMember(companyId, memberId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="mc-loading">
        <Spinner size={24} />
        <span>Loading team...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mc-error">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button className="mc-btn secondary small" onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="mc-members">
      {/* Header with count and add button */}
      <div className="mc-members-header">
        <div className="mc-members-count">
          <Users size={18} />
          <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
        </div>
        {canManageMembers && (
          <button
            className="mc-btn primary small"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            Add Member
          </button>
        )}
      </div>

      {/* Add member form */}
      {showAddForm && (
        <form className="mc-add-member-form" onSubmit={handleAddMember}>
          <div className="mc-form-row">
            <input
              type="email"
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mc-input"
              autoFocus
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="mc-select"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="mc-btn primary" disabled={adding || !newEmail.trim()}>
              {adding ? <Spinner size={14} /> : 'Add'}
            </button>
            <button type="button" className="mc-btn secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
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

      {/* Members list */}
      <div className="mc-members-list">
        {members.map(member => {
          const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
          const RoleIcon = roleConfig.icon;
          const isCurrentUser = member.user_id === currentUserId;
          const isLoading = actionLoading === member.id;

          // Can this member be modified?
          const canModify = canManageMembers && !isCurrentUser && member.role !== 'owner';
          const canPromote = canModify && currentRole === 'owner' && member.role === 'member';
          const canDemote = canModify && currentRole === 'owner' && member.role === 'admin';
          const canRemove = canModify && (currentRole === 'owner' || (currentRole === 'admin' && member.role === 'member'));

          return (
            <div key={member.id} className={`mc-member-row ${isCurrentUser ? 'current' : ''}`}>
              {/* Role badge */}
              <div className="mc-member-role" style={{ color: roleConfig.color }}>
                <RoleIcon size={18} />
              </div>

              {/* User info */}
              <div className="mc-member-info">
                <span className="mc-member-name">
                  {/* TODO: Display email when we have user lookup */}
                  {isCurrentUser ? 'You' : `User ${member.user_id.slice(0, 8)}...`}
                </span>
                <span className="mc-member-role-label" style={{ color: roleConfig.color }}>
                  {roleConfig.label}
                </span>
              </div>

              {/* Joined date */}
              <div className="mc-member-joined">
                Joined {new Date(member.joined_at || member.created_at).toLocaleDateString()}
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
                      title="Promote to Admin"
                    >
                      <ChevronUp size={16} />
                    </button>
                  )}
                  {canDemote && (
                    <button
                      className="mc-icon-btn demote"
                      onClick={() => handleChangeRole(member.id, 'member')}
                      title="Demote to Member"
                    >
                      <ChevronDown size={16} />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      className="mc-icon-btn danger"
                      onClick={() => handleRemoveMember(member.id, member.role)}
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

      {/* Usage statistics (for owners/admins) */}
      {usage && (
        <div className="mc-usage-section">
          <h3 className="mc-section-title">
            <BarChart3 size={18} />
            Usage Statistics
          </h3>
          <div className="mc-usage-grid">
            <div className="mc-usage-card">
              <span className="mc-usage-value">{usage.sessions_this_month}</span>
              <span className="mc-usage-label">Sessions this month</span>
            </div>
            <div className="mc-usage-card">
              <span className="mc-usage-value">{usage.total_sessions}</span>
              <span className="mc-usage-label">Total sessions</span>
            </div>
            <div className="mc-usage-card">
              <span className="mc-usage-value">
                {((usage.tokens_this_month_input + usage.tokens_this_month_output) / 1000).toFixed(1)}k
              </span>
              <span className="mc-usage-label">Tokens this month</span>
            </div>
            <div className="mc-usage-card">
              <span className="mc-usage-value">
                {((usage.total_tokens_input + usage.total_tokens_output) / 1000).toFixed(1)}k
              </span>
              <span className="mc-usage-label">Total tokens</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
