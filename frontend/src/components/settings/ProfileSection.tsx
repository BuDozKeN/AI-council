import { Skeleton } from '../ui/Skeleton';
import { useProfile } from './hooks/useProfile';

const ProfileSkeleton = () => (
  <>
    {/* Account Info Card Skeleton */}
    <div className="settings-card">
      <div className="card-header">
        <Skeleton width={180} height={20} />
        <Skeleton width={200} height={14} className="mt-2" />
      </div>
      <div className="card-body">
        <div className="form-group">
          <Skeleton width={50} height={14} />
          <Skeleton height={40} className="mt-2" />
          <Skeleton width={160} height={12} className="mt-1.5" />
        </div>
      </div>
    </div>

    {/* Profile Details Card Skeleton */}
    <div className="settings-card">
      <div className="card-header">
        <Skeleton width={140} height={20} />
        <Skeleton width={220} height={14} className="mt-2" />
      </div>
      <div className="card-body">
        {[1, 2, 3].map((i) => (
          <div className="form-group" key={i}>
            <Skeleton width={80} height={14} />
            <Skeleton height={40} className="mt-2" />
          </div>
        ))}
        <div className="form-group">
          <Skeleton width={40} height={14} />
          <Skeleton height={80} className="mt-2" />
        </div>
        <div className="form-actions">
          <Skeleton width={120} height={40} />
        </div>
      </div>
    </div>
  </>
);

export function ProfileSection({ user, isOpen }) {
  const {
    profile,
    setProfile,
    profileLoading,
    isSaving,
    saveMessage,
    handleSaveProfile,
  } = useProfile(isOpen, user);

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  return (
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
  );
}
