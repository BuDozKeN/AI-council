/**
 * Public endpoints domain API methods.
 * Includes council stats, feature flags, onboarding, and trial status.
 * These endpoints require no authentication.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION } from './client';
import type { CouncilStats, OnboardingProfileResponse, TrialStatusResponse } from './types';

export const publicMethods = {
  async getCouncilStats(companyId?: string): Promise<CouncilStats> {
    const url = companyId
      ? `${API_BASE}${API_VERSION}/council-stats?company_id=${encodeURIComponent(companyId)}`
      : `${API_BASE}${API_VERSION}/council-stats`;
    const response = await fetch(url);
    if (!response.ok) {
      // Return defaults if endpoint fails (graceful degradation)
      return {
        stage1_count: 5,
        stage2_count: 6,
        stage3_count: 3,
        total_rounds: 3,
        providers: ['openai', 'anthropic', 'google', 'xai', 'deepseek'],
      };
    }
    return response.json();
  },

  async getFeatureFlags(): Promise<{ flags: Record<string, boolean> }> {
    const response = await fetch(`${API_BASE}/api/feature-flags`);
    if (!response.ok) {
      // Return empty flags on error (fail open)
      return { flags: {} };
    }
    return response.json();
  },

  async analyzeLinkedInProfile(linkedInUrl: string): Promise<OnboardingProfileResponse> {
    const response = await fetch(`${API_BASE}${API_VERSION}/onboarding/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_url: linkedInUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to analyze profile' }));
      return {
        success: false,
        fallback_required: true,
        error: error.detail || error.error || 'Failed to analyze profile',
      };
    }

    return response.json();
  },

  async getTrialStatus(token: string): Promise<TrialStatusResponse> {
    const response = await fetch(`${API_BASE}${API_VERSION}/onboarding/trial-status`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Default to no trial on error
      return {
        has_trial_available: false,
        has_api_key: false,
        trial_count: 0,
        trial_limit: 3,
      };
    }

    return response.json();
  },
};
