/**
 * Tests for useProfile hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useProfile } from './useProfile';

// Mock the API
vi.mock('../../../api', () => ({
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    scope: () => ({
      error: vi.fn(),
    }),
  },
}));

import { api } from '../../../api';

describe('useProfile', () => {
  const mockUser = {
    email: 'test@example.com',
    user_metadata: {
      display_name: 'Test User',
      company: 'Test Co',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty profile', () => {
    const { result } = renderHook(() => useProfile(false, null));

    expect(result.current.profile).toEqual({
      display_name: '',
      company: '',
      phone: '',
      bio: '',
    });
  });

  it('should start with loading state true', () => {
    const { result } = renderHook(() => useProfile(false, null));

    expect(result.current.profileLoading).toBe(true);
  });

  it('should load profile when isOpen and user are provided', async () => {
    const mockProfile = {
      display_name: 'John Doe',
      company: 'Acme Inc',
      phone: '555-1234',
      bio: 'Developer',
    };

    api.getProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useProfile(true, mockUser));

    await waitFor(() => {
      expect(result.current.profileLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
  });

  it('should fall back to user metadata on API error', async () => {
    api.getProfile.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useProfile(true, mockUser));

    await waitFor(() => {
      expect(result.current.profileLoading).toBe(false);
    });

    expect(result.current.profile.display_name).toBe('Test User');
    expect(result.current.profile.company).toBe('Test Co');
  });

  it('should save profile successfully', async () => {
    api.getProfile.mockResolvedValue({ display_name: 'John' });
    api.updateProfile.mockResolvedValue({});

    const { result } = renderHook(() => useProfile(true, mockUser));

    await waitFor(() => {
      expect(result.current.profileLoading).toBe(false);
    });

    const mockEvent = { preventDefault: vi.fn() };

    await act(async () => {
      await result.current.handleSaveProfile(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(api.updateProfile).toHaveBeenCalled();
    expect(result.current.saveMessage.type).toBe('success');
  });

  it('should handle save error', async () => {
    api.getProfile.mockResolvedValue({ display_name: 'John' });
    api.updateProfile.mockRejectedValue(new Error('Save failed'));

    const { result } = renderHook(() => useProfile(true, mockUser));

    await waitFor(() => {
      expect(result.current.profileLoading).toBe(false);
    });

    const mockEvent = { preventDefault: vi.fn() };

    await act(async () => {
      await result.current.handleSaveProfile(mockEvent);
    });

    expect(result.current.saveMessage.type).toBe('error');
    expect(result.current.saveMessage.text).toBe('Save failed');
  });

  it('should allow updating profile fields', async () => {
    api.getProfile.mockResolvedValue({ display_name: '' });

    const { result } = renderHook(() => useProfile(true, mockUser));

    await waitFor(() => {
      expect(result.current.profileLoading).toBe(false);
    });

    act(() => {
      result.current.setProfile({ ...result.current.profile, display_name: 'New Name' });
    });

    expect(result.current.profile.display_name).toBe('New Name');
  });
});
