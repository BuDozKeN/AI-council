/**
 * Feature Flags Hook
 *
 * Provides access to feature flags for conditional rendering.
 * Flags are fetched once on app load and cached.
 *
 * Usage:
 *   const { flags, isEnabled, isLoading } = useFeatureFlags();
 *
 *   // Check a specific flag
 *   if (isEnabled('advanced_search')) {
 *     // render advanced search UI
 *   }
 *
 *   // Or use flags directly
 *   {flags.command_palette && <CommandPalette />}
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

// Default flags to use before fetch completes or on error
const DEFAULT_FLAGS: Record<string, boolean> = {
  prompt_caching: true,
  stage2_ranking: true,
  streaming_responses: true,
  command_palette: true,
  dark_mode: true,
  advanced_search: false,
  multi_company: false,
  export_pdf: false,
  gpt5_model: true,
  claude_opus: true,
};

export const featureFlagKeys = {
  all: ['feature-flags'] as const,
};

/**
 * Hook to access feature flags.
 *
 * @returns {Object} Feature flag state and helpers
 * @returns {Record<string, boolean>} flags - All flags as a key-value object
 * @returns {function} isEnabled - Check if a specific flag is enabled
 * @returns {boolean} isLoading - True while fetching flags
 * @returns {boolean} isError - True if fetch failed
 */
export function useFeatureFlags() {
  const { data, isLoading, isError } = useQuery({
    queryKey: featureFlagKeys.all,
    queryFn: () => api.getFeatureFlags(),
    staleTime: 5 * 60 * 1000, // 5 minutes - flags don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 1, // Only retry once on failure
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  });

  // Merge fetched flags with defaults (fetched values take precedence)
  const flags: Record<string, boolean> = {
    ...DEFAULT_FLAGS,
    ...(data?.flags || {}),
  };

  /**
   * Check if a specific feature flag is enabled.
   *
   * @param flagName - The name of the flag to check
   * @returns True if enabled, false otherwise (including unknown flags)
   */
  const isEnabled = (flagName: string): boolean => {
    return flags[flagName] ?? false;
  };

  return {
    flags,
    isEnabled,
    isLoading,
    isError,
  };
}

// Type for the flags object
export type FeatureFlags = typeof DEFAULT_FLAGS;

// Export individual flag names for type safety
export type FeatureFlagName = keyof FeatureFlags;
