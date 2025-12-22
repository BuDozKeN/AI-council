import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { AdaptiveModal } from './ui/AdaptiveModal';
import { Skeleton } from './ui/Skeleton';
import { Spinner } from './ui/Spinner';
import { User, CreditCard, Users, Crown, Shield, UserIcon, Plus, Trash2, ChevronUp, ChevronDown, BarChart3, AlertCircle } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { formatDate } from '../lib/dateUtils';
import './Settings.css';

// Role configuration for display
const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, color: '#f59e0b', description: 'Full control' },
  admin: { label: 'Admin', icon: Shield, color: '#3b82f6', description: 'Manage members' },
  member: { label: 'Member', icon: UserIcon, color: '#6b7280', description: 'View & contribute' }
};

export default function Settings({ isOpen, onClose, companyId }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile form state
  const [profile, setProfile] = useState({
    display_name: '',
    company: '',
    phone: '',
    bio: '',
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  // Billing state
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [billingError, setBillingError] = useState(null);

  // Team state
  const [members, setMembers] = useState([]);
  const [usage, setUsage] = useState(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [addError, setAddError] = useState(null);
  const [addingMember, setAddingMember] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(null);

  // Load profile on mount
  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
      loadBillingData();
    }
  }, [isOpen, user]);

  // Load team data when team tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'team' && companyId) {
      loadTeamData();
    }
  }, [isOpen, activeTab, companyId]);

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const data = await api.getProfile();
      setProfile({
        display_name: data.display_name || '',
        company: data.company || '',
        phone: data.phone || '',
        bio: data.bio || '',
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
      setProfile({
        display_name: user?.user_metadata?.display_name || '',
        company: user?.user_metadata?.company || '',
        phone: user?.user_metadata?.phone || '',
        bio: user?.user_metadata?.bio || '',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const loadBillingData = async () => {
    try {
      setBillingLoading(true);
      setBillingError(null);
      const [plansData, subData] = await Promise.all([
        api.getBillingPlans(),
        api.getSubscription(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setBillingError('Failed to load billing information');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage({ type: '', text: '' });

    try {
      await api.updateProfile(profile);
      setSaveMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubscribe = async (tierId) => {
    try {
      setCheckoutLoading(tierId);
      setBillingError(null);
      const result = await api.createCheckout(tierId);
      window.location.href = result.checkout_url;
    } catch (err) {
      console.error('Failed to create checkout:', err);
      setBillingError(err.message || 'Failed to start checkout');
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setCheckoutLoading('manage');
      setBillingError(null);
      const result = await api.createBillingPortal();
      window.location.href = result.portal_url;
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setBillingError(err.message || 'Failed to open billing portal');
      setCheckoutLoading(null);
    }
  };

  // Team functions
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
      setTeamError(err.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !companyId) return;

    try {
      setAddingMember(true);
      setAddError(null);
      await api.addCompanyMember(companyId, newEmail.trim(), newRole);
      await loadTeamData();
      setNewEmail('');
      setNewRole('member');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleChangeRole = async (memberId, role) => {
    try {
      setMemberActionLoading(memberId);
      await api.updateCompanyMember(companyId, memberId, role);
      await loadTeamData();
    } catch (err) {
      alert(err.message);
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId, memberRole) => {
    if (!confirm(`Remove this ${memberRole} from the team?`)) return;
    try {
      setMemberActionLoading(memberId);
      await api.removeCompanyMember(companyId, memberId);
      await loadTeamData();
    } catch (err) {
      alert(err.message);
    } finally {
      setMemberActionLoading(null);
    }
  };

  // Derived state
  const currentMember = members.find(m => m.user_id === user?.id);
  const currentUserRole = currentMember?.role || 'member';
  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);

  const currentTier = subscription?.tier || 'free';
  const queriesUsed = subscription?.queries_used || 0;
  const queriesLimit = subscription?.queries_limit || 5;
  const isUnlimited = queriesLimit === -1;

  // Profile skeleton
  const ProfileSkeleton = () => (
    <>
      {/* Account Info Card Skeleton */}
      <div className="settings-card">
        <div className="card-header">
          <Skeleton width={180} height={20} />
          <Skeleton width={200} height={14} style={{ marginTop: 8 }} />
        </div>
        <div className="card-body">
          <div className="form-group">
            <Skeleton width={50} height={14} />
            <Skeleton height={40} style={{ marginTop: 8 }} />
            <Skeleton width={160} height={12} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      {/* Profile Details Card Skeleton */}
      <div className="settings-card">
        <div className="card-header">
          <Skeleton width={140} height={20} />
          <Skeleton width={220} height={14} style={{ marginTop: 8 }} />
        </div>
        <div className="card-body">
          {[1, 2, 3].map((i) => (
            <div className="form-group" key={i}>
              <Skeleton width={80} height={14} />
              <Skeleton height={40} style={{ marginTop: 8 }} />
            </div>
          ))}
          <div className="form-group">
            <Skeleton width={40} height={14} />
            <Skeleton height={80} style={{ marginTop: 8 }} />
          </div>
          <div className="form-actions">
            <Skeleton width={120} height={40} />
          </div>
        </div>
      </div>
    </>
  );

  // Team skeleton - matches exact structure of loaded content to prevent layout shift
  const TeamSkeleton = () => (
    <>
      {/* Team Members Card Skeleton - mirrors actual card structure */}
      <div className="settings-card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Skeleton width={120} height={16} /> {/* h3: "Team Members" */}
              <Skeleton width={70} height={13} style={{ marginTop: 4 }} /> {/* p: "X members" */}
            </div>
            <Skeleton width={115} height={36} style={{ borderRadius: 6 }} /> {/* Add Member button */}
          </div>
        </div>
        <div className="card-body">
          <div className="members-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="member-row">
                <div className="member-role-icon">
                  <Skeleton variant="circular" width={18} height={18} />
                </div>
                <div className="member-info">
                  <Skeleton width={80} height={14} /> {/* member-name */}
                  <Skeleton width={50} height={12} style={{ marginTop: 2 }} /> {/* role label */}
                </div>
                <Skeleton width={110} height={12} /> {/* member-joined */}
                <div className="member-actions">
                  <Skeleton width={28} height={28} style={{ borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage Statistics Skeleton */}
      <div className="settings-card">
        <div className="card-header">
          <Skeleton width={130} height={16} /> {/* h3: "Usage Statistics" */}
          <Skeleton width={200} height={13} style={{ marginTop: 4 }} /> {/* p description */}
        </div>
        <div className="card-body">
          <div className="usage-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="usage-stat">
                <Skeleton width={40} height={24} /> {/* usage-value */}
                <Skeleton width={90} height={12} style={{ marginTop: 4 }} /> {/* usage-label */}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // Billing skeleton
  const BillingSkeleton = () => (
    <>
      {/* Usage Card Skeleton */}
      <div className="settings-card">
        <div className="card-header">
          <Skeleton width={120} height={20} />
          <Skeleton width={240} height={14} style={{ marginTop: 8 }} />
        </div>
        <div className="card-body">
          <Skeleton height={10} style={{ borderRadius: 5 }} />
          <Skeleton width={200} height={14} style={{ marginTop: 10 }} />
        </div>
      </div>

      {/* Plans Skeleton */}
      <div className="plans-section">
        <Skeleton width={160} height={20} style={{ marginBottom: 16 }} />
        <div className="plans-grid">
          {[1, 2, 3].map((i) => (
            <div className="plan-card" key={i}>
              <div className="plan-header">
                <Skeleton width={60} height={20} style={{ margin: '0 auto 8px' }} />
                <Skeleton width={80} height={32} style={{ margin: '0 auto 4px' }} />
                <Skeleton width={100} height={14} style={{ margin: '0 auto' }} />
              </div>
              <div style={{ padding: '0 0 16px' }}>
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, padding: '6px 0' }}>
                    <Skeleton width={16} height={16} />
                    <Skeleton width={120} height={14} />
                  </div>
                ))}
              </div>
              <Skeleton height={40} />
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="xl"
      contentClassName="settings-modal-body"
    >
      {/* Content */}
      <div className="settings-content">
          {/* Sidebar tabs */}
          <div className="settings-sidebar">
            <button
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} className="tab-icon" />
              Profile
            </button>
            <button
              className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
            >
              <CreditCard size={18} className="tab-icon" />
              Billing
            </button>
            {companyId && (
              <button
                className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                <Users size={18} className="tab-icon" />
                Team
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="settings-panel">
            {activeTab === 'profile' && (
              <div className="profile-content">
                {profileLoading ? (
                  <ProfileSkeleton />
                ) : (
                  <>
                    {/* Account Info Card */}
                    <div className="settings-card">
                      <div className="card-header">
                        <h3>Account Information</h3>
                        <p>Your email and account details</p>
                      </div>
                      <div className="card-body">
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="input-disabled"
                          />
                          <span className="input-hint">Email cannot be changed</span>
                        </div>
                      </div>
                    </div>

                    {/* Profile Details Card */}
                    <div className="settings-card">
                      <div className="card-header">
                        <h3>Profile Details</h3>
                        <p>Update your personal information</p>
                      </div>
                      <div className="card-body">
                        <form onSubmit={handleSaveProfile}>
                          <div className="form-group">
                            <label>Display Name</label>
                            <input
                              type="text"
                              value={profile.display_name}
                              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                              placeholder="Your name"
                            />
                          </div>
                          <div className="form-group">
                            <label>Company</label>
                            <input
                              type="text"
                              value={profile.company}
                              onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                              placeholder="Company name"
                            />
                          </div>
                          <div className="form-group">
                            <label>Phone</label>
                            <input
                              type="tel"
                              value={profile.phone}
                              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                              placeholder="+1 (555) 123-4567"
                            />
                          </div>
                          <div className="form-group">
                            <label>Bio</label>
                            <textarea
                              value={profile.bio}
                              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                              placeholder="Tell us about yourself or your business..."
                              rows={3}
                            />
                          </div>

                          <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={isSaving}>
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            {saveMessage.text && (
                              <span className={`save-message ${saveMessage.type}`}>
                                {saveMessage.text}
                              </span>
                            )}
                          </div>
                        </form>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="billing-content">
                {billingLoading ? (
                  <BillingSkeleton />
                ) : (
                  <>
                    {billingError && (
                      <div className="error-banner">{billingError}</div>
                    )}

                    {/* Usage Card */}
                    <div className="settings-card">
                      <div className="card-header">
                        <h3>Current Usage</h3>
                        <p>Your council queries this billing period</p>
                      </div>
                      <div className="card-body">
                        <div className="usage-bar">
                          <div
                            className="usage-fill"
                            style={{
                              width: isUnlimited ? '10%' : `${Math.min((queriesUsed / queriesLimit) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <p className="usage-text">
                          {isUnlimited
                            ? `${queriesUsed} queries used (Unlimited)`
                            : `${queriesUsed} / ${queriesLimit} queries this month`
                          }
                        </p>
                      </div>
                    </div>

                    {/* Plans */}
                    <div className="plans-section">
                      <h3>Subscription Plans</h3>
                      <div className="plans-grid">
                        {plans.map((plan) => {
                          const isCurrentPlan = plan.id === currentTier;
                          const isUpgrade = !plan.is_free && (currentTier === 'free' ||
                            (currentTier === 'pro' && plan.id === 'enterprise'));

                          return (
                            <div
                              key={plan.id}
                              className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.id === 'pro' ? 'popular' : ''}`}
                            >
                              {plan.id === 'pro' && (
                                <div className="popular-badge">Most Popular</div>
                              )}
                              <div className="plan-header">
                                <h4>{plan.name}</h4>
                                <div className="plan-price">
                                  {plan.is_free ? (
                                    <span className="price">Free</span>
                                  ) : (
                                    <>
                                      <span className="price">${plan.price}</span>
                                      <span className="period">/month</span>
                                    </>
                                  )}
                                </div>
                                <p className="plan-queries">{plan.queries_display}</p>
                              </div>
                              <ul className="plan-features">
                                {plan.features.map((feature, idx) => (
                                  <li key={idx}>
                                    <span className="check">✓</span>
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                              <div className="plan-action">
                                {isCurrentPlan ? (
                                  <button className="btn-outline" disabled>Current Plan</button>
                                ) : (
                                  <button
                                    className={isUpgrade ? 'btn-primary' : 'btn-outline'}
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={checkoutLoading !== null}
                                  >
                                    {checkoutLoading === plan.id ? 'Loading...' : isUpgrade ? 'Upgrade' : 'Select'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Manage Subscription */}
                    {currentTier !== 'free' && (
                      <div className="settings-card manage-card">
                        <div className="manage-content">
                          <div>
                            <p className="manage-title">Manage your subscription</p>
                            <p className="manage-desc">Update payment method, view invoices, or cancel</p>
                          </div>
                          <button
                            className="btn-outline"
                            onClick={handleManageSubscription}
                            disabled={checkoutLoading !== null}
                          >
                            {checkoutLoading === 'manage' ? 'Loading...' : 'Manage Billing'}
                          </button>
                        </div>
                      </div>
                    )}

                    <p className="stripe-note">Secure payments powered by Stripe</p>
                  </>
                )}
              </div>
            )}

            {activeTab === 'team' && companyId && (
              <div className="team-content">
                {teamLoading ? (
                  <TeamSkeleton />
                ) : teamError ? (
                  <div className="settings-card">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, color: 'var(--color-danger)' }}>
                      <AlertCircle size={20} />
                      <span>{teamError}</span>
                      <button className="btn-outline" onClick={loadTeamData}>Retry</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Team Members Card */}
                    <div className="settings-card">
                      <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <h3>Team Members</h3>
                            <p>{members.length} {members.length === 1 ? 'member' : 'members'}</p>
                          </div>
                          {canManageMembers && (
                            <button
                              className="btn-primary"
                              onClick={() => setShowAddForm(!showAddForm)}
                              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <Plus size={16} />
                              Add Member
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="card-body">
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
                              <button type="submit" className="btn-primary" disabled={addingMember || !newEmail.trim()}>
                                {addingMember ? <Spinner size={14} /> : 'Add'}
                              </button>
                              <button type="button" className="btn-outline" onClick={() => setShowAddForm(false)}>
                                Cancel
                              </button>
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
                      </div>
                    </div>

                    {/* Usage Statistics (for owners/admins) */}
                    {usage && (
                      <div className="settings-card">
                        <div className="card-header">
                          <h3>Usage Statistics</h3>
                          <p>Council usage for your organization</p>
                        </div>
                        <div className="card-body">
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
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </AdaptiveModal>
  );
}
