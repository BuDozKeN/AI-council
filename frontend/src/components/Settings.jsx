import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { AdaptiveModal } from './ui/AdaptiveModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { Skeleton } from './ui/Skeleton';
import { Spinner } from './ui/Spinner';
import { User, CreditCard, Users, Crown, Shield, UserIcon, Plus, Trash2, ChevronUp, ChevronDown, BarChart3, AlertCircle, Key, CheckCircle, XCircle, ExternalLink, RefreshCw, HelpCircle, Zap, DollarSign, Lock, ArrowRight, MoreHorizontal, Power, Edit3 } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import * as Accordion from '@radix-ui/react-accordion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Switch } from './ui/switch';
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

  // API Key (BYOK) state
  const [apiKeyStatus, setApiKeyStatus] = useState(null); // { status, masked_key, is_valid }
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyTesting, setApiKeyTesting] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(null);
  const [apiKeySuccess, setApiKeySuccess] = useState(null);
  const [showReplaceKeyForm, setShowReplaceKeyForm] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null);

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

  // Load API key status when api tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'api') {
      loadApiKeyStatus();
    }
  }, [isOpen, activeTab]);

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

  const handleRemoveMember = (memberId, memberRole) => {
    setConfirmModal({
      title: 'Remove Team Member',
      message: `Remove this ${memberRole} from the team?`,
      variant: 'danger',
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          setMemberActionLoading(memberId);
          await api.removeCompanyMember(companyId, memberId);
          await loadTeamData();
        } catch (err) {
          setTeamError(err.message);
        } finally {
          setMemberActionLoading(null);
        }
      }
    });
  };

  // API Key (BYOK) functions
  const loadApiKeyStatus = async () => {
    try {
      setApiKeyLoading(true);
      setApiKeyError(null);
      const status = await api.getOpenRouterKeyStatus();
      setApiKeyStatus(status);
    } catch (err) {
      console.error('Failed to load API key status:', err);
      setApiKeyError('Failed to load API key status');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    try {
      setApiKeySaving(true);
      setApiKeyError(null);
      setApiKeySuccess(null);
      const result = await api.saveOpenRouterKey(apiKeyInput.trim());
      setApiKeyStatus(result);
      setApiKeyInput('');
      setApiKeySuccess('API key connected successfully!');
    } catch (err) {
      setApiKeyError(err.message || 'Failed to save API key');
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleTestApiKey = async () => {
    try {
      setApiKeyTesting(true);
      setApiKeyError(null);
      setApiKeySuccess(null);
      const result = await api.testOpenRouterKey();
      setApiKeyStatus(result);
      if (result.is_valid) {
        setApiKeySuccess('API key is valid and working!');
      } else {
        setApiKeyError('API key validation failed. Please check your key.');
      }
    } catch (err) {
      setApiKeyError(err.message || 'Failed to test API key');
    } finally {
      setApiKeyTesting(false);
    }
  };

  const handleDeleteApiKey = () => {
    setConfirmModal({
      title: 'Remove API Key',
      message: 'Remove your OpenRouter API key? You will use the system key with usage limits.',
      variant: 'danger',
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          setApiKeySaving(true);
          setApiKeyError(null);
          await api.deleteOpenRouterKey();
          setApiKeyStatus({ status: 'not_connected', is_valid: false, is_active: true });
          setApiKeySuccess('API key removed');
        } catch (err) {
          setApiKeyError(err.message || 'Failed to delete API key');
        } finally {
          setApiKeySaving(false);
        }
      }
    });
  };

  const handleToggleApiKey = async () => {
    try {
      setApiKeySaving(true);
      setApiKeyError(null);
      setApiKeySuccess(null);
      const result = await api.toggleOpenRouterKey();
      setApiKeyStatus(result);
      setApiKeySuccess(result.is_active ? 'API key activated' : 'API key deactivated');
    } catch (err) {
      setApiKeyError(err.message || 'Failed to toggle API key');
    } finally {
      setApiKeySaving(false);
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
    <>
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
              data-tooltip="Profile"
            >
              <User size={18} className="tab-icon" />
              <span className="tab-label">Profile</span>
            </button>
            <button
              className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
              data-tooltip="Billing"
            >
              <CreditCard size={18} className="tab-icon" />
              <span className="tab-label">Billing</span>
            </button>
            {companyId && (
              <button
                className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => setActiveTab('team')}
                data-tooltip="Team"
              >
                <Users size={18} className="tab-icon" />
                <span className="tab-label">Team</span>
              </button>
            )}
            <button
              className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
              data-tooltip="API Keys"
            >
              <Key size={18} className="tab-icon" />
              <span className="tab-label">API Keys</span>
            </button>
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

            {activeTab === 'api' && (
              <div className="api-content">
                {apiKeyLoading ? (
                  <>
                    <div className="settings-card">
                      <div className="card-header">
                        <Skeleton width={200} height={20} />
                        <Skeleton width={300} height={14} style={{ marginTop: 8 }} />
                      </div>
                      <div className="card-body">
                        <Skeleton height={40} style={{ marginBottom: 16 }} />
                        <Skeleton height={40} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Page intro */}
                    <div className="api-page-intro">
                      <h2>Connect Your AI Provider</h2>
                      <p>
                        AxCouncil uses AI models to power the council. Connect your own API key
                        to have full control over costs — you only pay for what you use, directly
                        to the provider.
                      </p>
                    </div>

                    {/* OpenRouter Provider Accordion */}
                    <Accordion.Root type="single" collapsible defaultValue="openrouter" className="api-provider-accordion">
                      <Accordion.Item value="openrouter" className="api-provider-item">
                        <Accordion.Header>
                          <Accordion.Trigger className="api-provider-trigger">
                            <div className="provider-header">
                              <div className="provider-info">
                                <div className="provider-logo openrouter">
                                  <Zap size={20} />
                                </div>
                                <div className="provider-details">
                                  <div className="provider-title-row">
                                    <h3>OpenRouter</h3>
                                    {/* Status dot based on is_active toggle state */}
                                    {apiKeyStatus && (
                                      apiKeyStatus.is_active ? (
                                        apiKeyStatus.is_valid ? (
                                          <span className="status-dot connected" title="Active" />
                                        ) : (
                                          <span className="status-dot invalid" title="Invalid" />
                                        )
                                      ) : (
                                        <span className="status-dot paused" title="Paused" />
                                      )
                                    )}
                                  </div>
                                  <span className="provider-tagline">Access all major AI models through one API</span>
                                </div>
                              </div>
                            </div>
                            <ChevronDown className="accordion-chevron" size={20} />
                          </Accordion.Trigger>
                        </Accordion.Header>

                        <Accordion.Content className="api-provider-content">
                          {/* Ultra-compact connection row */}
                          {(apiKeyStatus?.status === 'connected' || apiKeyStatus?.status === 'disabled' || apiKeyStatus?.status === 'invalid') && (
                            <div className="byok-inline">
                              {/* Toast messages */}
                              {(apiKeyError || apiKeySuccess) && (
                                <div className={`byok-toast ${apiKeyError ? 'error' : 'success'}`}>
                                  {apiKeyError ? <XCircle size={12} /> : <CheckCircle size={12} />}
                                  <span>{apiKeyError || apiKeySuccess}</span>
                                </div>
                              )}

                              {/* Single row: key + toggle + menu */}
                              <div className="byok-row">
                                <code className="byok-key">{apiKeyStatus.masked_key}</code>

                                <div className="byok-actions">
                                  {/* Standard shadcn Switch */}
                                  <Switch
                                    checked={apiKeyStatus.is_active}
                                    onCheckedChange={handleToggleApiKey}
                                    disabled={apiKeySaving}
                                  />

                                  {/* Dropdown Menu */}
                                  <DropdownMenu.Root modal={false}>
                                    <DropdownMenu.Trigger asChild>
                                      <button
                                        className="byok-menu"
                                        disabled={apiKeySaving}
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {apiKeySaving ? <Spinner size={14} /> : <MoreHorizontal size={16} />}
                                      </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Portal>
                                      <DropdownMenu.Content
                                        className="byok-dropdown"
                                        sideOffset={5}
                                        align="end"
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                        onPointerDownOutside={(e) => e.preventDefault()}
                                      >
                                        <DropdownMenu.Item
                                          className="byok-dropdown-item"
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            handleTestApiKey();
                                          }}
                                        >
                                          <RefreshCw size={14} /> Test
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          className="byok-dropdown-item"
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            setShowReplaceKeyForm(true);
                                          }}
                                        >
                                          <Edit3 size={14} /> Replace
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Separator className="byok-dropdown-separator" />
                                        <DropdownMenu.Item
                                          className="byok-dropdown-item danger"
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            handleDeleteApiKey();
                                          }}
                                        >
                                          <Trash2 size={14} /> Remove
                                        </DropdownMenu.Item>
                                      </DropdownMenu.Content>
                                    </DropdownMenu.Portal>
                                  </DropdownMenu.Root>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Replace key inline form */}
                          {showReplaceKeyForm && (
                            <div className="byok-replace-form">
                              <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!apiKeyInput.trim()) return;
                                try {
                                  setApiKeySaving(true);
                                  setApiKeyError(null);
                                  const result = await api.saveOpenRouterKey(apiKeyInput.trim());
                                  setApiKeyStatus(result);
                                  setApiKeyInput('');
                                  setShowReplaceKeyForm(false);
                                  setApiKeySuccess('API key replaced successfully!');
                                } catch (err) {
                                  setApiKeyError(err.message || 'Failed to save API key');
                                } finally {
                                  setApiKeySaving(false);
                                }
                              }}>
                                <input
                                  type="password"
                                  value={apiKeyInput}
                                  onChange={(e) => setApiKeyInput(e.target.value)}
                                  placeholder="sk-or-v1-..."
                                  autoComplete="off"
                                  autoFocus
                                />
                                <div className="byok-replace-actions">
                                  <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={() => {
                                      setShowReplaceKeyForm(false);
                                      setApiKeyInput('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={apiKeySaving || !apiKeyInput.trim()}
                                  >
                                    {apiKeySaving ? <Spinner size={14} /> : 'Save'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}

                          {/* What is OpenRouter - always visible */}
                          <div className="provider-explainer">
                            <div className="explainer-section">
                              <h4><HelpCircle size={16} /> What is OpenRouter?</h4>
                              <p>
                                OpenRouter is a service that gives you access to all the major AI models
                                (like ChatGPT, Claude, Gemini, and more) through a single account. Instead
                                of signing up separately with OpenAI, Anthropic, Google, etc., you just
                                need one OpenRouter account.
                              </p>
                              <p>
                                Think of it like a phone plan that lets you call any network — OpenRouter
                                lets you use any AI model without managing multiple subscriptions.
                              </p>
                            </div>

                            <div className="explainer-section">
                              <h4><DollarSign size={16} /> How does billing work?</h4>
                              <p>
                                <strong>You only pay for what you use.</strong> There are no monthly fees
                                or subscriptions. Each time the council runs, it costs a small amount
                                (typically a few cents) which is charged directly to your OpenRouter account.
                              </p>
                              <p>
                                AxCouncil does not charge you for AI usage — all costs go directly to
                                OpenRouter at their published rates. You can set spending limits on your
                                OpenRouter account to stay in control.
                              </p>
                            </div>

                            <div className="explainer-section">
                              <h4><Lock size={16} /> Is my API key secure?</h4>
                              <p>
                                Yes. Your API key is encrypted before being stored and is only ever
                                decrypted on our secure servers when making AI requests. We never
                                log or expose your full key.
                              </p>
                            </div>
                          </div>

                          {/* Setup guide - ALWAYS visible */}
                          <div className="provider-setup-guide">
                            <div className="setup-steps">
                              <h4>How to get your OpenRouter API key</h4>

                              <div className="setup-step">
                                <div className="step-number">1</div>
                                <div className="step-content">
                                  <p><strong>Create an OpenRouter account</strong></p>
                                  <p>
                                    Go to{' '}
                                    <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">
                                      openrouter.ai <ExternalLink size={12} />
                                    </a>
                                    {' '}and sign up for a free account. You can use Google, GitHub, or email.
                                  </p>
                                </div>
                              </div>

                              <div className="setup-step">
                                <div className="step-number">2</div>
                                <div className="step-content">
                                  <p><strong>Add credits to your account</strong></p>
                                  <p>
                                    Go to{' '}
                                    <a href="https://openrouter.ai/credits" target="_blank" rel="noopener noreferrer">
                                      Credits <ExternalLink size={12} />
                                    </a>
                                    {' '}and add funds. Start with $5-10 to try it out — this will last
                                    for many council sessions.
                                  </p>
                                </div>
                              </div>

                              <div className="setup-step">
                                <div className="step-number">3</div>
                                <div className="step-content">
                                  <p><strong>Create an API key</strong></p>
                                  <p>
                                    Go to{' '}
                                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                                      API Keys <ExternalLink size={12} />
                                    </a>
                                    {' '}and click "Create API Key". Give it a name like "AxCouncil"
                                    and optionally set a spending limit.
                                  </p>
                                </div>
                              </div>

                              <div className="setup-step">
                                <div className="step-number">4</div>
                                <div className="step-content">
                                  <p><strong>Copy and paste your key below</strong></p>
                                  <p>
                                    Your key will look like <code>sk-or-v1-...</code> — paste it in the
                                    field below and we'll verify it works.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Input form - only show if not connected */}
                            {apiKeyStatus?.status !== 'connected' && (
                              <div className="provider-connection">
                                {apiKeyError && !apiKeyStatus?.status && (
                                  <div className="api-message error">
                                    <XCircle size={16} />
                                    {apiKeyError}
                                  </div>
                                )}

                                <form onSubmit={handleSaveApiKey} className="api-key-form">
                                  <div className="form-group">
                                    <label>Your OpenRouter API Key</label>
                                    <input
                                      type="password"
                                      value={apiKeyInput}
                                      onChange={(e) => setApiKeyInput(e.target.value)}
                                      placeholder="sk-or-v1-..."
                                      autoComplete="off"
                                    />
                                    <span className="form-hint">
                                      Your key is encrypted and stored securely
                                    </span>
                                  </div>
                                  <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={apiKeySaving || !apiKeyInput.trim()}
                                  >
                                    {apiKeySaving ? <Spinner size={14} /> : <><ArrowRight size={14} /> Connect & Verify</>}
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
                        </Accordion.Content>
                      </Accordion.Item>

                      {/* Placeholder for future providers */}
                      {/*
                      <Accordion.Item value="anthropic" className="api-provider-item coming-soon">
                        <Accordion.Header>
                          <Accordion.Trigger className="api-provider-trigger" disabled>
                            <div className="provider-header">
                              <div className="provider-info">
                                <div className="provider-logo anthropic">A</div>
                                <div className="provider-details">
                                  <h3>Anthropic (Claude)</h3>
                                  <span className="provider-tagline">Coming soon</span>
                                </div>
                              </div>
                            </div>
                          </Accordion.Trigger>
                        </Accordion.Header>
                      </Accordion.Item>
                      */}
                    </Accordion.Root>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </AdaptiveModal>

    {/* Confirmation Modal */}
    {confirmModal && (
      <ConfirmModal
        {...confirmModal}
        onCancel={() => setConfirmModal(null)}
      />
    )}
    </>
  );
}
