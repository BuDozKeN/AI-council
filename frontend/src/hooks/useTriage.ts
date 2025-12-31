/**
 * Hook for triage analysis flow
 *
 * Handles the triage process where the AI analyzes the user's question
 * and may ask clarifying questions before sending to the council.
 */

import { useState, useCallback } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';
import type { TriageState } from '../contexts/UIContext';
import type { ImageAttachment } from './useMessageStreaming';

const log = logger.scope('Triage');

interface UseTriageOptions {
  currentConversationId: string | null;
  selectedBusiness: string | null;
  useCompanyContext: boolean;
  onSendToCouncil: (content: string, images?: ImageAttachment[] | null) => Promise<void>;
}

export function useTriage({
  currentConversationId,
  selectedBusiness,
  useCompanyContext,
  onSendToCouncil,
}: UseTriageOptions) {
  const [triageState, setTriageState] = useState<TriageState>(null);
  const [originalQuery, setOriginalQuery] = useState('');
  const [isTriageLoading, setIsTriageLoading] = useState(false);

  // Define handleSendToCouncil first so other callbacks can reference it
  const handleSendToCouncil = useCallback(
    async (content: string, images: ImageAttachment[] | null = null) => {
      // Clear triage state
      setTriageState(null);
      setOriginalQuery('');

      // Delegate to the actual send function
      await onSendToCouncil(content, images);
    },
    [onSendToCouncil]
  );

  const handleStartTriage = useCallback(
    async (content: string) => {
      if (!currentConversationId) return;

      setOriginalQuery(content);
      setIsTriageLoading(true);
      setTriageState('analyzing');

      // Only pass businessId if useCompanyContext is enabled
      const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;

      try {
        const result = await api.analyzeTriage(content, effectiveBusinessId);
        setTriageState(result);
      } catch (error) {
        log.error('Triage analysis failed:', error);
        // On error, skip triage and go directly to council
        handleSendToCouncil(content);
      } finally {
        setIsTriageLoading(false);
      }
    },
    [currentConversationId, selectedBusiness, useCompanyContext, handleSendToCouncil]
  );

  const handleTriageRespond = useCallback(
    async (response: string) => {
      if (!triageState || triageState === 'analyzing') return;

      setIsTriageLoading(true);

      // Only pass businessId if useCompanyContext is enabled
      const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;

      try {
        const result = await api.continueTriage(
          originalQuery,
          triageState.constraints || {},
          response,
          effectiveBusinessId
        );
        setTriageState(result);
      } catch (error) {
        log.error('Triage continue failed:', error);
        // On error, proceed with what we have
        const enhancedQuery = (triageState as { enhanced_query?: string }).enhanced_query;
        handleSendToCouncil(enhancedQuery || originalQuery);
      } finally {
        setIsTriageLoading(false);
      }
    },
    [triageState, originalQuery, selectedBusiness, useCompanyContext, handleSendToCouncil]
  );

  const handleTriageSkip = useCallback(() => {
    // Skip triage and send original query to council
    handleSendToCouncil(originalQuery);
  }, [originalQuery, handleSendToCouncil]);

  const handleTriageProceed = useCallback(
    (enhancedQuery: string) => {
      // Proceed with the enhanced query
      handleSendToCouncil(enhancedQuery);
    },
    [handleSendToCouncil]
  );

  const clearTriageState = useCallback(() => {
    setTriageState(null);
    setOriginalQuery('');
    setIsTriageLoading(false);
  }, []);

  return {
    triageState,
    originalQuery,
    isTriageLoading,
    handleStartTriage,
    handleTriageRespond,
    handleTriageSkip,
    handleTriageProceed,
    handleSendToCouncil,
    clearTriageState,
  };
}

export type { UseTriageOptions };
