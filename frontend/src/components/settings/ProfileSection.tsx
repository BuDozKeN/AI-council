import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { useProfile } from './hooks/useProfile';
import type { User } from '@supabase/supabase-js';

const ProfileSkeleton = () => (
  <>
    {/* Account Info Card Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <Skeleton width={180} height={20} />
        <Skeleton width={200} height={14} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="form-group">
          <Skeleton width={50} height={14} />
          <Skeleton height={40} className="mt-2" />
          <Skeleton width={160} height={12} className="mt-1.5" />
        </div>
      </CardContent>
    </Card>

    {/* Profile Details Card Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <Skeleton width={140} height={20} />
        <Skeleton width={220} height={14} className="mt-2" />
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  </>
);

interface ProfileSectionProps {
  user: User | null;
  isOpen: boolean;
}

export function ProfileSection({ user, isOpen }: ProfileSectionProps) {
  const {
    profile,
    setProfile,
    profileLoading,
    isSaving,
    handleSaveProfile,
  } = useProfile(isOpen, user);

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      {/* Account Info Card */}
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your email and account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="form-group">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="input-disabled"
            />
            <span className="input-hint">Email cannot be changed</span>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Card */}
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label htmlFor="profile-display-name">Display Name</label>
              <input
                id="profile-display-name"
                name="display_name"
                type="text"
                autoComplete="name"
                value={profile.display_name}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-company">Company</label>
              <input
                id="profile-company"
                name="company"
                type="text"
                autoComplete="organization"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-phone">Phone</label>
              <input
                id="profile-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                name="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself or your business..."
                rows={3}
                enterKeyHint="done"
              />
            </div>

            <div className="form-actions">
              <Button type="submit" variant="default" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
