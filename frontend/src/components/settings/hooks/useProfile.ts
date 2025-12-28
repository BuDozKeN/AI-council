import { useState, useEffect } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import { toast } from '../../ui/sonner';
import type { User } from '@supabase/supabase-js';

const log = logger.scope('useProfile');

export interface Profile {
  display_name: string;
  company: string;
  phone: string;
  bio: string;
}

export function useProfile(isOpen: boolean, user: User | null) {
  const [profile, setProfile] = useState<Profile>({
    display_name: '',
    company: '',
    phone: '',
    bio: '',
  });
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProfile is stable
  }, [isOpen, user]);

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
      log.error('Failed to load profile:', err);
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

  const handleSaveProfile = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await api.updateProfile(profile);
      toast.success('Profile saved', { duration: 3000 });
    } catch (error) {
      log.error('Failed to save profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    profile,
    setProfile,
    profileLoading,
    isSaving,
    handleSaveProfile,
  };
}
