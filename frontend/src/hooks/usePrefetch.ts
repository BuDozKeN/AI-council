/**
 * usePrefetch - Hover-based prefetching for instant navigation
 *
 * Prefetches data on mouse enter to make navigation feel instant.
 * Uses TanStack Query's prefetchQuery to populate the cache.
 */

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { companyKeys } from './queries/useCompany';

// Delay before prefetching starts (avoids prefetching on quick mouse movements)
const PREFETCH_DELAY_MS = 100;

// Minimum time between prefetches for the same key (prevents spamming)
const PREFETCH_THROTTLE_MS = 5000;

// Track recently prefetched keys to avoid redundant fetches
const prefetchedKeys = new Map<string, number>();

/**
 * Hook to prefetch company-related data on hover
 */
export function usePrefetchCompany(companyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchTeam = useCallback(() => {
    if (!companyId) return;

    const cacheKey = `team:${companyId}`;
    const lastPrefetch = prefetchedKeys.get(cacheKey) || 0;

    // Skip if recently prefetched
    if (Date.now() - lastPrefetch < PREFETCH_THROTTLE_MS) return;

    // Check if already in cache and fresh
    const existing = queryClient.getQueryData(companyKeys.departments(companyId));
    if (existing) return;

    prefetchedKeys.set(cacheKey, Date.now());
    queryClient.prefetchQuery({
      queryKey: companyKeys.departments(companyId),
      queryFn: () => api.getCompanyTeam(companyId),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  }, [companyId, queryClient]);

  const prefetchPlaybooks = useCallback(() => {
    if (!companyId) return;

    const cacheKey = `playbooks:${companyId}`;
    const lastPrefetch = prefetchedKeys.get(cacheKey) || 0;

    if (Date.now() - lastPrefetch < PREFETCH_THROTTLE_MS) return;

    const existing = queryClient.getQueryData(companyKeys.playbooks(companyId));
    if (existing) return;

    prefetchedKeys.set(cacheKey, Date.now());
    queryClient.prefetchQuery({
      queryKey: companyKeys.playbooks(companyId),
      queryFn: () => api.getCompanyPlaybooks(companyId),
      staleTime: 1000 * 60 * 5,
    });
  }, [companyId, queryClient]);

  const prefetchProjects = useCallback(() => {
    if (!companyId) return;

    const cacheKey = `projects:${companyId}`;
    const lastPrefetch = prefetchedKeys.get(cacheKey) || 0;

    if (Date.now() - lastPrefetch < PREFETCH_THROTTLE_MS) return;

    const existing = queryClient.getQueryData(companyKeys.projects(companyId));
    if (existing) return;

    prefetchedKeys.set(cacheKey, Date.now());
    queryClient.prefetchQuery({
      queryKey: companyKeys.projects(companyId),
      queryFn: () => api.listProjects(companyId),
      staleTime: 1000 * 60 * 5,
    });
  }, [companyId, queryClient]);

  const prefetchDecisions = useCallback(() => {
    if (!companyId) return;

    const cacheKey = `decisions:${companyId}`;
    const lastPrefetch = prefetchedKeys.get(cacheKey) || 0;

    if (Date.now() - lastPrefetch < PREFETCH_THROTTLE_MS) return;

    const existing = queryClient.getQueryData(companyKeys.decisions(companyId));
    if (existing) return;

    prefetchedKeys.set(cacheKey, Date.now());
    queryClient.prefetchQuery({
      queryKey: companyKeys.decisions(companyId),
      queryFn: () => api.getCompanyDecisions(companyId),
      staleTime: 1000 * 60 * 5,
    });
  }, [companyId, queryClient]);

  // Prefetch all company data (for "My Company" button hover)
  const prefetchAll = useCallback(() => {
    prefetchTeam();
    prefetchPlaybooks();
    prefetchProjects();
    prefetchDecisions();
  }, [prefetchTeam, prefetchPlaybooks, prefetchProjects, prefetchDecisions]);

  // Create delayed prefetch handlers (prevents prefetch on quick mouse movements)
  const createDelayedPrefetch = useCallback((prefetchFn: () => void) => {
    return {
      onMouseEnter: () => {
        timeoutRef.current = setTimeout(prefetchFn, PREFETCH_DELAY_MS);
      },
      onMouseLeave: () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      },
    };
  }, []);

  return {
    prefetchTeam,
    prefetchPlaybooks,
    prefetchProjects,
    prefetchDecisions,
    prefetchAll,
    // Convenience handlers with built-in delay
    teamHoverHandlers: createDelayedPrefetch(prefetchTeam),
    playbooksHoverHandlers: createDelayedPrefetch(prefetchPlaybooks),
    projectsHoverHandlers: createDelayedPrefetch(prefetchProjects),
    decisionsHoverHandlers: createDelayedPrefetch(prefetchDecisions),
    allHoverHandlers: createDelayedPrefetch(prefetchAll),
  };
}

/**
 * Hook to prefetch conversation data on hover
 */
export function usePrefetchConversation() {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchConversation = useCallback(
    (conversationId: string) => {
      if (!conversationId) return;

      const cacheKey = `conversation:${conversationId}`;
      const lastPrefetch = prefetchedKeys.get(cacheKey) || 0;

      if (Date.now() - lastPrefetch < PREFETCH_THROTTLE_MS) return;

      prefetchedKeys.set(cacheKey, Date.now());
      queryClient.prefetchQuery({
        queryKey: ['conversation', conversationId],
        queryFn: () => api.getConversation(conversationId),
        staleTime: 1000 * 60 * 5,
      });
    },
    [queryClient]
  );

  const createHoverHandlers = useCallback(
    (conversationId: string) => ({
      onMouseEnter: () => {
        timeoutRef.current = setTimeout(
          () => prefetchConversation(conversationId),
          PREFETCH_DELAY_MS
        );
      },
      onMouseLeave: () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      },
    }),
    [prefetchConversation]
  );

  return {
    prefetchConversation,
    createHoverHandlers,
  };
}
