import { useState, useEffect } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { Decision } from '../../../types';

// Extended Decision type with promoted_to_id field (used in pending decisions logic)
interface DecisionWithPromotion extends Decision {
  promoted_to_id?: string | null;
}
import type { MyCompanyTab } from './useCompanyData';

const log = logger.scope('usePendingDecisions');

interface UsePendingDecisionsOptions {
  companyId: string | null;
  decisions: Decision[];
  activeTab: MyCompanyTab;
}

/**
 * Hook for tracking pending decisions count for header status indicator
 */
export function usePendingDecisions({ companyId, decisions, activeTab }: UsePendingDecisionsOptions): number | null {
  const [pendingDecisionsCount, setPendingDecisionsCount] = useState<number | null>(null);

  // Load decisions count on mount
  useEffect(() => {
    if (!companyId) return;
    // Fetch decisions to count pending ones
    api.getCompanyDecisions(companyId)
      .then(data => {
        const allDecisions = data.decisions || [];
        // Pending = not promoted (has promoted_to_id) AND not linked to a project
        const pending = allDecisions.filter((d: DecisionWithPromotion) => !d.promoted_to_id && !d.project_id);
        setPendingDecisionsCount(pending.length);
      })
      .catch(err => {
        log.error('Failed to load decisions count', { error: err });
        setPendingDecisionsCount(0);
      });
  }, [companyId]);

  // Update count when decisions change (e.g., after promoting)
  useEffect(() => {
    if (decisions.length > 0 || activeTab === 'decisions') {
      // Pending = not promoted (has promoted_to_id) AND not linked to a project
      const pending = decisions.filter((d: DecisionWithPromotion) => !d.promoted_to_id && !d.project_id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: derived state from props
      setPendingDecisionsCount(pending.length);
    }
  }, [decisions, activeTab]);

  return pendingDecisionsCount;
}
