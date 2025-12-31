import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';

const log = logger.scope('useDecisionState');

// Minimum interval between decision status checks (ms)
const DECISION_CHECK_THROTTLE = 5000;

export type SaveState = 'idle' | 'saving' | 'saved' | 'promoting' | 'promoted' | 'error';

interface UseDecisionStateOptions {
  conversationId: string | null;
  companyId: string | null;
  responseIndex?: number;
  currentProjectId?: string | null;
  departmentId?: string | null;
}

export interface UseDecisionStateReturn {
  saveState: SaveState;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  savedDecisionId: string | null;
  setSavedDecisionId: React.Dispatch<React.SetStateAction<string | null>>;
  promotedPlaybookId: string | null;
  setPromotedPlaybookId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedProjectId: string | null;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedDeptIds: string[];
  setSelectedDeptIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDocType: string;
  setSelectedDocType: React.Dispatch<React.SetStateAction<string>>;
  checkDecisionStatus: (force?: boolean) => Promise<void>;
  lastSyncedProjectIdRef: MutableRefObject<string | null>;
}

/**
 * Hook to manage decision state - checking for existing decisions,
 * tracking save state, and syncing with backend.
 */
export function useDecisionState({
  conversationId,
  companyId,
  responseIndex = 0,
  currentProjectId = null,
  departmentId = null,
}: UseDecisionStateOptions): UseDecisionStateReturn {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedDecisionId, setSavedDecisionId] = useState<string | null>(null);
  const [promotedPlaybookId, setPromotedPlaybookId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(
    departmentId ? [departmentId] : []
  );
  const [selectedDocType, setSelectedDocType] = useState<string>('');

  // Refs for throttling and deduplication
  const lastDecisionCheck = useRef<number>(0);
  const isCheckingDecision = useRef<boolean>(false);
  const lastSyncedProjectIdRef = useRef<string | null>(null);
  const initialFetchKey = useRef<string | null>(null);
  const prevConversationRef = useRef<string | null>(null);
  const prevResponseIndexRef = useRef<number | null>(null);
  const isInitialMount = useRef<boolean>(true);

  // Unified decision status check - throttled and deduped
  const checkDecisionStatus = useCallback(
    async (force = false) => {
      if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;
      if (!savedDecisionId && !force) return;
      if (isCheckingDecision.current) return;

      const now = Date.now();
      if (!force && now - lastDecisionCheck.current < DECISION_CHECK_THROTTLE) return;

      isCheckingDecision.current = true;
      lastDecisionCheck.current = now;

      try {
        const data = await api.getConversationDecision(conversationId, companyId, responseIndex);
        if (data?.decision) {
          if (!savedDecisionId) {
            setSavedDecisionId(data.decision.id);
            setSaveState('saved');
          }
          if (data.decision.project_id && !selectedProjectId) {
            setSelectedProjectId(data.decision.project_id);
          }
        } else if (savedDecisionId) {
          log.debug('Decision was deleted, clearing state');
          setSavedDecisionId(null);
          setSaveState('idle');
        }
      } catch {
        if (savedDecisionId) {
          setSavedDecisionId(null);
          setSaveState('idle');
        }
      } finally {
        isCheckingDecision.current = false;
      }
    },
    [conversationId, companyId, responseIndex, savedDecisionId, selectedProjectId]
  );

  // Reset saved decision state when conversation changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevConversationRef.current = conversationId;
      prevResponseIndexRef.current = responseIndex;
      return;
    }

    const conversationChanged = prevConversationRef.current !== conversationId;
    const responseIndexChanged = prevResponseIndexRef.current !== responseIndex;

    prevConversationRef.current = conversationId;
    prevResponseIndexRef.current = responseIndex;

    if (conversationChanged || responseIndexChanged) {
      log.debug('Conversation/response changed, resetting saved state');
      setSavedDecisionId(null);
      setSaveState('idle');
      setPromotedPlaybookId(null);
      setSelectedProjectId(currentProjectId);
      setSelectedDeptIds(departmentId ? [departmentId] : []);
      setSelectedDocType('');
      lastDecisionCheck.current = 0;
      isCheckingDecision.current = false;
      lastSyncedProjectIdRef.current = null;
      initialFetchKey.current = null;
    }
  }, [conversationId, responseIndex, currentProjectId, departmentId]);

  // Sync selectedProjectId when currentProjectId prop changes
  useEffect(() => {
    if (currentProjectId && currentProjectId !== selectedProjectId) {
      log.debug('Syncing selectedProjectId from prop:', currentProjectId);
      setSelectedProjectId(currentProjectId);
    }
  }, [currentProjectId, selectedProjectId]);

  // Initial load: Check for existing decision
  useEffect(() => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;

    const fetchKey = `${conversationId}:${responseIndex}`;
    if (initialFetchKey.current === fetchKey) {
      return;
    }
    initialFetchKey.current = fetchKey;

    log.debug(`[${responseIndex}] Initial load - checking for existing decision`);

    api
      .getConversationDecision(conversationId, companyId, responseIndex)
      .then((decisionData) => {
        log.debug(`[${responseIndex}] getConversationDecision response:`, decisionData);
        if (decisionData?.decision) {
          const decision = decisionData.decision;
          setSavedDecisionId(decision.id);
          setSaveState('saved');

          if (decision.project_id) {
            setSelectedProjectId(decision.project_id);
          }
          if (decision.department_ids?.length > 0) {
            setSelectedDeptIds(decision.department_ids);
          }
          if (decision.doc_type) {
            setSelectedDocType(decision.doc_type);
          }
        }
        lastDecisionCheck.current = Date.now();
      })
      .catch((err) => {
        // 404 is expected when no decision exists - don't log as error
        if (err?.message?.includes('404') || err?.status === 404) {
          log.debug(`[${responseIndex}] No existing decision found`);
        } else {
          log.error(`[${responseIndex}] Error checking decision:`, err);
        }
      });
  }, [conversationId, companyId, responseIndex]);

  // Re-check decision status when tab becomes visible
  useEffect(() => {
    if (!conversationId || !companyId || conversationId.startsWith('temp-')) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDecisionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkDecisionStatus, conversationId, companyId]);

  return {
    saveState,
    setSaveState,
    savedDecisionId,
    setSavedDecisionId,
    promotedPlaybookId,
    setPromotedPlaybookId,
    selectedProjectId,
    setSelectedProjectId,
    selectedDeptIds,
    setSelectedDeptIds,
    selectedDocType,
    setSelectedDocType,
    checkDecisionStatus,
    lastSyncedProjectIdRef,
  };
}
