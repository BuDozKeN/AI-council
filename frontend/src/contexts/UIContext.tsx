/* eslint-disable react-refresh/only-export-components -- Context pattern exports both Provider and hook */
/**
 * UIContext - Manages UI state like mobile sidebar, triage, and upload states
 *
 * Extracted from App.jsx to reduce complexity and prop drilling.
 *
 * State managed:
 * - Mobile sidebar visibility
 * - Landing chat mode
 * - Triage state
 * - Upload state
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';

const log = logger.scope('UIContext');

export type LandingChatMode = 'council' | 'chat';

export interface TriageConstraints {
  [key: string]: unknown;
}

export interface TriageResult {
  constraints?: TriageConstraints;
  ready?: boolean;
  next_question?: string;
  recommended_council?: string;
  [key: string]: unknown;
}

export type TriageState = null | 'analyzing' | TriageResult;

interface UIContextValue {
  // Mobile sidebar
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;

  // Landing mode
  landingChatMode: LandingChatMode;
  setLandingChatMode: React.Dispatch<React.SetStateAction<LandingChatMode>>;

  // Triage
  triageState: TriageState;
  originalQuery: string;
  isTriageLoading: boolean;
  setTriageState: React.Dispatch<React.SetStateAction<TriageState>>;
  setOriginalQuery: React.Dispatch<React.SetStateAction<string>>;
  startTriage: (content: string, businessId: string) => Promise<TriageResult>;
  continueTriage: (response: string, businessId: string) => Promise<TriageResult | null>;
  clearTriage: () => void;

  // Upload
  isUploading: boolean;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
}

const UIContext = createContext<UIContextValue>({} as UIContextValue);

export const useUI = () => useContext(UIContext);

interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  // Mobile sidebar
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Landing page mode (council vs chat)
  const [landingChatMode, setLandingChatMode] = useState<LandingChatMode>('council');

  // Triage state
  const [triageState, setTriageState] = useState<TriageState>(null);
  const [originalQuery, setOriginalQuery] = useState<string>('');
  const [isTriageLoading, setIsTriageLoading] = useState<boolean>(false);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Mobile sidebar handlers
  const openMobileSidebar = useCallback((): void => setIsMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback((): void => setIsMobileSidebarOpen(false), []);
  const toggleMobileSidebar = useCallback((): void => setIsMobileSidebarOpen((prev) => !prev), []);

  // Triage handlers
  const startTriage = useCallback(
    async (content: string, businessId: string): Promise<TriageResult> => {
      setOriginalQuery(content);
      setIsTriageLoading(true);
      setTriageState('analyzing');

      try {
        const result = await api.analyzeTriage(content, businessId);
        setTriageState(result);
        return result;
      } catch (error) {
        log.error('Triage analysis failed:', error);
        throw error;
      } finally {
        setIsTriageLoading(false);
      }
    },
    []
  );

  const continueTriage = useCallback(
    async (response: string, businessId: string): Promise<TriageResult | null> => {
      if (!triageState || triageState === 'analyzing') return null;

      setIsTriageLoading(true);

      try {
        const result = await api.continueTriage(
          originalQuery,
          (triageState as TriageResult).constraints || {},
          response,
          businessId
        );
        setTriageState(result);
        return result;
      } catch (error) {
        log.error('Triage continue failed:', error);
        throw error;
      } finally {
        setIsTriageLoading(false);
      }
    },
    [originalQuery, triageState]
  );

  const clearTriage = useCallback((): void => {
    setTriageState(null);
    setOriginalQuery('');
    setIsTriageLoading(false);
  }, []);

  const value = useMemo(
    (): UIContextValue => ({
      // Mobile sidebar
      isMobileSidebarOpen,
      setIsMobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,

      // Landing mode
      landingChatMode,
      setLandingChatMode,

      // Triage
      triageState,
      originalQuery,
      isTriageLoading,
      setTriageState,
      setOriginalQuery,
      startTriage,
      continueTriage,
      clearTriage,

      // Upload
      isUploading,
      setIsUploading,
    }),
    [
      isMobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      landingChatMode,
      triageState,
      originalQuery,
      isTriageLoading,
      startTriage,
      continueTriage,
      clearTriage,
      isUploading,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
