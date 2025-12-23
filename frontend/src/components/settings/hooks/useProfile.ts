import { useState, useEffect } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { User } from '@supabase/supabase-js';

const log = logger.scope('useProfile');

export interface Profile {
  display_name: string;
  company: string;
  phone: string;
  bio: string;
}

export interface SaveMessage {
  type: '' | 'success' | 'error';
  text: string;
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
  const [saveMessage, setSaveMessage] = useState<SaveMessage>({ type: '', text: '' });

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
    setSaveMessage({ type: '', text: '' });

    try {
      await api.updateProfile(profile);
      setSaveMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (error) {
      log.error('Failed to save profile:', error);
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      setSaveMessage({ type: 'error', text: message });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    profile,
    setProfile,
    profileLoading,
    isSaving,
    saveMessage,
    handleSaveProfile,
  };
}
