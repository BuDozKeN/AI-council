/**
 * useCouncilStats - Hook to fetch and cache council configuration stats
 *
 * Fetches the number of AIs in each stage from the backend LLM Hub configuration.
 * Results are cached per company so multiple components don't trigger multiple requests.
 *
 * Usage:
 *   const { aiCount, rounds, isLoading } = useCouncilStats(companyId);
 *   // aiCount = number of Stage 1 council members (e.g., 5)
 *   // rounds = number of deliberation stages (always 3)
 */

import React, { useCallback, useSyncExternalStore } from 'react';
import { api } from '../api';

// Global cache per company to avoid multiple fetches across components
// Key is company_id or 'global' for no company
const cachedStatsMap: Map<string, CouncilStatsData> = new Map();
const fetchPromiseMap: Map<string, Promise<CouncilStatsData>> = new Map();
const loadingSet: Set<string> = new Set();

// Subscribers that want to be notified when cache changes
type Listener = () => void;
const listeners: Set<Listener> = new Set();

// Snapshot cache to ensure referential equality between renders
// Key is cacheKey, value is the last snapshot returned for that key
const snapshotCache: Map<string, { stats: CouncilStatsData; isLoading: boolean }> = new Map();

// Notify all subscribers of cache changes
function notifyListeners(): void {
  // Clear snapshot cache when data changes to force new snapshots
  snapshotCache.clear();
  listeners.forEach((listener) => listener());
}

interface CouncilStatsData {
  aiCount: number;
  rounds: number;
  providers: string[];  // List of active provider names (e.g., 'openai', 'anthropic')
}

interface UseCouncilStatsResult extends CouncilStatsData {
  isLoading: boolean;
  refetch: () => void;
}

// Default values (shown while loading or on error)
const DEFAULT_STATS: CouncilStatsData = {
  aiCount: 5,
  rounds: 3,
  providers: ['openai', 'anthropic', 'google', 'xai', 'deepseek'],
};

/**
 * Get cache key for company ID
 */
function getCacheKey(companyId: string | null | undefined): string {
  return companyId || 'global';
}

/**
 * Subscribe to cache changes (for useSyncExternalStore)
 */
function subscribe(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Trigger a fetch for stats if not already cached or fetching.
 * This is called outside of render to avoid the setState-in-effect issue.
 */
function triggerFetch(companyId: string | null | undefined): void {
  const cacheKey = getCacheKey(companyId);

  // Already cached - nothing to do
  if (cachedStatsMap.has(cacheKey)) {
    return;
  }

  // Already fetching - nothing to do
  if (fetchPromiseMap.has(cacheKey)) {
    return;
  }

  // Mark as loading and notify
  loadingSet.add(cacheKey);
  notifyListeners();

  // Start fetch
  const fetchPromise = api.getCouncilStats(companyId || undefined).then((stats) => {
    const data: CouncilStatsData = {
      aiCount: stats.stage1_count,
      rounds: stats.total_rounds,
      providers: stats.providers,
    };
    cachedStatsMap.set(cacheKey, data);
    loadingSet.delete(cacheKey);
    fetchPromiseMap.delete(cacheKey);
    notifyListeners();
    return data;
  }).catch(() => {
    // On error, cache defaults for graceful degradation
    cachedStatsMap.set(cacheKey, DEFAULT_STATS);
    loadingSet.delete(cacheKey);
    fetchPromiseMap.delete(cacheKey);
    notifyListeners();
    return DEFAULT_STATS;
  });

  fetchPromiseMap.set(cacheKey, fetchPromise);
}

/**
 * Hook to get council configuration stats.
 * Stats are fetched once per company and cached globally.
 * Automatically re-fetches when invalidateCouncilStats() is called.
 *
 * @param companyId - Optional company ID for company-specific stats.
 *                   If not provided, returns global/default stats.
 */
export function useCouncilStats(companyId?: string | null): UseCouncilStatsResult {
  const cacheKey = getCacheKey(companyId);

  // Get snapshot of current state from external cache
  // Must return referentially stable object to avoid infinite re-renders
  const getSnapshot = useCallback(() => {
    const cached = cachedStatsMap.get(cacheKey);
    const isLoading = loadingSet.has(cacheKey) || (!cached && fetchPromiseMap.has(cacheKey));
    const stats = cached || DEFAULT_STATS;
    const loading = isLoading || !cached;

    // Check if we have a cached snapshot with the same values
    const existingSnapshot = snapshotCache.get(cacheKey);
    if (
      existingSnapshot &&
      existingSnapshot.stats === stats &&
      existingSnapshot.isLoading === loading
    ) {
      return existingSnapshot;
    }

    // Create and cache new snapshot
    const newSnapshot = { stats, isLoading: loading };
    snapshotCache.set(cacheKey, newSnapshot);
    return newSnapshot;
  }, [cacheKey]);

  // Use useSyncExternalStore to subscribe to cache changes
  const { stats, isLoading } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot // SSR snapshot (same as client)
  );

  // Trigger fetch in useEffect to avoid setState during render
  // This is the React-safe way to trigger side effects
  React.useEffect(() => {
    if (!cachedStatsMap.has(cacheKey) && !fetchPromiseMap.has(cacheKey)) {
      triggerFetch(companyId);
    }
  }, [cacheKey, companyId]);

  // Refetch function - can be called manually
  const refetch = useCallback(() => {
    // Clear cache for this company
    cachedStatsMap.delete(cacheKey);
    loadingSet.add(cacheKey);
    notifyListeners();

    // Trigger new fetch
    triggerFetch(companyId);
  }, [companyId, cacheKey]);

  return {
    ...stats,
    isLoading,
    refetch,
  };
}

/**
 * Force refresh of council stats (useful after LLM Hub changes).
 * Call this when you know the configuration has changed.
 * All active useCouncilStats hooks for this company will automatically re-fetch.
 *
 * @param companyId - Optional company ID. If provided, only invalidates that company's cache.
 *                   If not provided, invalidates all caches.
 */
export function invalidateCouncilStats(companyId?: string | null): void {
  if (companyId) {
    // Invalidate specific company
    const cacheKey = getCacheKey(companyId);
    cachedStatsMap.delete(cacheKey);
    fetchPromiseMap.delete(cacheKey);
    loadingSet.delete(cacheKey);
  } else {
    // Invalidate all
    cachedStatsMap.clear();
    fetchPromiseMap.clear();
    loadingSet.clear();
  }

  // Notify all subscribers - they will re-fetch on next render
  notifyListeners();
}

export default useCouncilStats;
