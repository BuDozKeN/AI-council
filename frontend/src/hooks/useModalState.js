/**
 * useModalState - Consolidated state management for modals
 *
 * Reduces the number of useState calls in App.jsx by grouping
 * modal-related state into a single reducer.
 */

import { useReducer, useCallback } from 'react';

const initialState = {
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
  myCompanyInitialProjectDecisionId: null, // Decision ID to expand when opening a project
  myCompanyPromoteDecision: null,

  // Return navigation
  returnToMyCompanyTab: null,
  returnToProjectId: null,      // Project ID to reopen when returning from source conversation
  returnToDecisionId: null,     // Decision ID to expand when returning to project
  scrollToStage3: false,
  scrollToResponseIndex: null,
};

function modalReducer(state, action) {
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

  const openProjectModal = useCallback((context) =>
    dispatch({ type: 'OPEN_PROJECT_MODAL', payload: context }), []);

  const closeProjectModal = useCallback(() =>
    dispatch({ type: 'CLOSE_PROJECT_MODAL' }), []);

  const openMyCompany = useCallback((options) =>
    dispatch({ type: 'OPEN_MY_COMPANY', payload: options }), []);

  const closeMyCompany = useCallback(() =>
    dispatch({ type: 'CLOSE_MY_COMPANY' }), []);

  const resetMyCompanyInitial = useCallback(() =>
    dispatch({ type: 'RESET_MY_COMPANY_INITIAL' }), []);

  const setMyCompanyPromoteDecision = useCallback((decision) =>
    dispatch({ type: 'SET_MY_COMPANY_PROMOTE_DECISION', payload: decision }), []);

  const navigateToConversation = useCallback((fromTab, responseIndex, projectId = null, decisionId = null) =>
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
