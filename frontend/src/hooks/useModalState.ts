/**
 * useModalState - Consolidated state management for modals
 *
 * Reduces the number of useState calls in App.jsx by grouping
 * modal-related state into a single reducer.
 */

import { useReducer, useCallback } from 'react';
import type { MyCompanyTab } from '../components/mycompany/hooks';

export interface ProjectModalContext {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface PromoteDecision {
  id: string;
  title?: string;
  content?: string;
  [key: string]: unknown;
}

export interface OpenMyCompanyPayload {
  tab?: MyCompanyTab;
  decisionId?: string | null;
  playbookId?: string | null;
  projectId?: string | null;
  projectDecisionId?: string | null;
  clearPromoteDecision?: boolean;
}

export interface NavigateToConversationPayload {
  fromTab?: MyCompanyTab | null;
  responseIndex?: number | null;
  projectId?: string | null;
  decisionId?: string | null;
}

export interface ModalState {
  isLeaderboardOpen: boolean;
  isSettingsOpen: boolean;
  isProjectModalOpen: boolean;
  isMyCompanyOpen: boolean;
  projectModalContext: ProjectModalContext | null;
  myCompanyInitialTab: MyCompanyTab;
  myCompanyInitialDecisionId: string | null;
  myCompanyInitialPlaybookId: string | null;
  myCompanyInitialProjectId: string | null;
  myCompanyInitialProjectDecisionId: string | null;
  myCompanyPromoteDecision: PromoteDecision | null;
  returnToMyCompanyTab: MyCompanyTab | null;
  returnToProjectId: string | null;
  returnToDecisionId: string | null;
  scrollToStage3: boolean;
  scrollToResponseIndex: number | null;
}

type ModalAction =
  | { type: 'OPEN_LEADERBOARD' }
  | { type: 'CLOSE_LEADERBOARD' }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'OPEN_PROJECT_MODAL'; payload?: ProjectModalContext }
  | { type: 'CLOSE_PROJECT_MODAL' }
  | { type: 'OPEN_MY_COMPANY'; payload?: OpenMyCompanyPayload }
  | { type: 'CLOSE_MY_COMPANY' }
  | { type: 'RESET_MY_COMPANY_INITIAL' }
  | { type: 'SET_MY_COMPANY_PROMOTE_DECISION'; payload: PromoteDecision | null }
  | { type: 'SET_RETURN_TO_MY_COMPANY_TAB'; payload: MyCompanyTab | null }
  | { type: 'NAVIGATE_TO_CONVERSATION'; payload?: NavigateToConversationPayload }
  | { type: 'CLEAR_SCROLL_STATE' }
  | { type: 'SET_SCROLL_TO_STAGE3' }
  | { type: 'CLEAR_RETURN_STATE' }
  | { type: 'RESET' };

const initialState: ModalState = {
  // Modal open states
  isLeaderboardOpen: false,
  isSettingsOpen: false,
  isProjectModalOpen: false,
  isMyCompanyOpen: false,

  // Project modal context
  projectModalContext: null,

  // MyCompany navigation state
  myCompanyInitialTab: 'overview',
  myCompanyInitialDecisionId: null,
  myCompanyInitialPlaybookId: null,
  myCompanyInitialProjectId: null,
  myCompanyInitialProjectDecisionId: null,
  myCompanyPromoteDecision: null,

  // Return navigation
  returnToMyCompanyTab: null,
  returnToProjectId: null,
  returnToDecisionId: null,
  scrollToStage3: false,
  scrollToResponseIndex: null,
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_LEADERBOARD':
      return {
        ...state,
        isLeaderboardOpen: true,
        returnToMyCompanyTab: null,
      };

    case 'CLOSE_LEADERBOARD':
      return { ...state, isLeaderboardOpen: false };

    case 'OPEN_SETTINGS':
      return {
        ...state,
        isSettingsOpen: true,
        returnToMyCompanyTab: null,
      };

    case 'CLOSE_SETTINGS':
      return { ...state, isSettingsOpen: false };

    case 'OPEN_PROJECT_MODAL':
      return {
        ...state,
        isProjectModalOpen: true,
        projectModalContext: action.payload || null,
      };

    case 'CLOSE_PROJECT_MODAL':
      return {
        ...state,
        isProjectModalOpen: false,
        projectModalContext: null,
      };

    case 'OPEN_MY_COMPANY':
      return {
        ...state,
        isMyCompanyOpen: true,
        returnToMyCompanyTab: null,
        returnToProjectId: null,
        returnToDecisionId: null,
        myCompanyPromoteDecision: action.payload?.clearPromoteDecision ? null : state.myCompanyPromoteDecision,
        myCompanyInitialTab: action.payload?.tab || 'overview',
        myCompanyInitialDecisionId: action.payload?.decisionId || null,
        myCompanyInitialPlaybookId: action.payload?.playbookId || null,
        myCompanyInitialProjectId: action.payload?.projectId || null,
        myCompanyInitialProjectDecisionId: action.payload?.projectDecisionId || null,
      };

    case 'CLOSE_MY_COMPANY':
      return {
        ...state,
        isMyCompanyOpen: false,
        myCompanyInitialTab: 'overview',
        myCompanyInitialDecisionId: null,
        myCompanyInitialPlaybookId: null,
        myCompanyInitialProjectId: null,
        myCompanyInitialProjectDecisionId: null,
        myCompanyPromoteDecision: null,
      };

    case 'RESET_MY_COMPANY_INITIAL':
      // Reset to overview without closing - used when switching companies
      return {
        ...state,
        myCompanyInitialTab: 'overview',
        myCompanyInitialDecisionId: null,
        myCompanyInitialPlaybookId: null,
        myCompanyInitialProjectId: null,
        myCompanyInitialProjectDecisionId: null,
      };

    case 'SET_MY_COMPANY_PROMOTE_DECISION':
      return { ...state, myCompanyPromoteDecision: action.payload };

    case 'SET_RETURN_TO_MY_COMPANY_TAB':
      return { ...state, returnToMyCompanyTab: action.payload };

    case 'NAVIGATE_TO_CONVERSATION':
      // Close MyCompany and set up return state
      return {
        ...state,
        isMyCompanyOpen: false,
        scrollToStage3: true,
        scrollToResponseIndex: action.payload?.responseIndex ?? null,
        returnToMyCompanyTab: action.payload?.fromTab || null,
        returnToProjectId: action.payload?.projectId || null,
        returnToDecisionId: action.payload?.decisionId || null,
      };

    case 'CLEAR_SCROLL_STATE':
      return {
        ...state,
        scrollToStage3: false,
        scrollToResponseIndex: null,
      };

    case 'SET_SCROLL_TO_STAGE3':
      return {
        ...state,
        scrollToStage3: true,
        scrollToResponseIndex: null,
      };

    case 'CLEAR_RETURN_STATE':
      return {
        ...state,
        returnToMyCompanyTab: null,
        returnToProjectId: null,
        returnToDecisionId: null,
        myCompanyPromoteDecision: null,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useModalState() {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  // Memoized action creators
  const openLeaderboard = useCallback(() =>
    dispatch({ type: 'OPEN_LEADERBOARD' }), []);

  const closeLeaderboard = useCallback(() =>
    dispatch({ type: 'CLOSE_LEADERBOARD' }), []);

  const openSettings = useCallback(() =>
    dispatch({ type: 'OPEN_SETTINGS' }), []);

  const closeSettings = useCallback(() =>
    dispatch({ type: 'CLOSE_SETTINGS' }), []);

  const openProjectModal = useCallback((context?: ProjectModalContext): void => {
    if (context) {
      dispatch({ type: 'OPEN_PROJECT_MODAL', payload: context });
    } else {
      dispatch({ type: 'OPEN_PROJECT_MODAL' });
    }
  }, []);

  const closeProjectModal = useCallback((): void =>
    dispatch({ type: 'CLOSE_PROJECT_MODAL' }), []);

  const openMyCompany = useCallback((options?: OpenMyCompanyPayload): void => {
    if (options) {
      dispatch({ type: 'OPEN_MY_COMPANY', payload: options });
    } else {
      dispatch({ type: 'OPEN_MY_COMPANY' });
    }
  }, []);

  const closeMyCompany = useCallback((): void =>
    dispatch({ type: 'CLOSE_MY_COMPANY' }), []);

  const resetMyCompanyInitial = useCallback((): void =>
    dispatch({ type: 'RESET_MY_COMPANY_INITIAL' }), []);

  const setMyCompanyPromoteDecision = useCallback((decision: PromoteDecision | null): void =>
    dispatch({ type: 'SET_MY_COMPANY_PROMOTE_DECISION', payload: decision }), []);

  const navigateToConversation = useCallback((
    fromTab: MyCompanyTab | null,
    responseIndex: number | null,
    projectId: string | null = null,
    decisionId: string | null = null
  ): void =>
    dispatch({ type: 'NAVIGATE_TO_CONVERSATION', payload: { fromTab, responseIndex, projectId, decisionId } }), []);

  const clearScrollState = useCallback(() =>
    dispatch({ type: 'CLEAR_SCROLL_STATE' }), []);

  const setScrollToStage3 = useCallback(() =>
    dispatch({ type: 'SET_SCROLL_TO_STAGE3' }), []);

  const clearReturnState = useCallback(() =>
    dispatch({ type: 'CLEAR_RETURN_STATE' }), []);

  return {
    // State
    ...state,

    // Actions
    openLeaderboard,
    closeLeaderboard,
    openSettings,
    closeSettings,
    openProjectModal,
    closeProjectModal,
    openMyCompany,
    closeMyCompany,
    resetMyCompanyInitial,
    setMyCompanyPromoteDecision,
    navigateToConversation,
    clearScrollState,
    setScrollToStage3,
    clearReturnState,
  };
}
