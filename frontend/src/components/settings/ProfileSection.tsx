import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { useProfile } from './hooks/useProfile';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { User } from '@supabase/supabase-js';
import './ProfileSection.css';

const ProfileSkeleton = () => (
  <>
    {/* Profile Details Card Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <Skeleton width={140} height={20} />
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

    {/* Account Card Skeleton */}
    <Card className="settings-card">
      <CardHeader>
        <Skeleton width={80} height={20} />
      </CardHeader>
      <CardContent>
        <div className="form-group">
          <Skeleton width={50} height={14} />
          <Skeleton height={40} className="mt-2" />
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
  const { t } = useTranslation();
  const { profile, setProfile, profileLoading, isSaving, handleSaveProfile } = useProfile(
    isOpen,
    user
  );

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      {/* Profile Details Card - Most important, what users actually edit */}
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>{t('settings.profileDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label htmlFor="profile-display-name">{t('settings.displayName')}</label>
              <input
                id="profile-display-name"
                name="display_name"
                type="text"
                autoComplete="name"
                value={profile.display_name}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                placeholder={t('settings.displayName')}
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-company">{t('company.companyName')}</label>
              <input
                id="profile-company"
                name="company"
                type="text"
                autoComplete="organization"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                placeholder={t('company.companyName')}
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-phone">{t('settings.phone')}</label>
              <input
                id="profile-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder={t('settings.phonePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-bio">{t('settings.bio')}</label>
              <textarea
                id="profile-bio"
                name="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder={t('settings.bioPlaceholder')}
                rows={3}
                enterKeyHint="done"
              />
            </div>

            <div className="form-actions">
              <Button type="submit" variant="default" loading={isSaving}>
                {t('settings.saveChanges')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Card - Just for reference, email can't be changed */}
      <Card className="settings-card">
        <CardHeader>
          <CardTitle>{t('settings.account')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="form-group">
            <label htmlFor="profile-email">{t('auth.email')}</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="input-disabled"
              readOnly
              tabIndex={-1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language - Occasional change */}
      <LanguageSwitcher />
    </>
  );
}
