/**
 * Utility Hooks
 *
 * Common reusable hooks for gestures, keyboard, and modals.
 */

// TanStack Query hooks
export * from './queries';

// App-level state hooks
export { useMessageStreaming } from './useMessageStreaming';
export { useFeatureFlags } from './useFeatureFlags';
export { useBulkConversationActions } from './useBulkConversationActions';
export { useTriage } from './useTriage';
export { usePrefetchCompany, usePrefetchConversation } from './usePrefetch';

// Gesture and UI Hooks
export { useSwipeGesture, useGlobalSwipe } from './useSwipeGesture';
export { usePullToRefresh } from './usePullToRefresh';
export { useLongPress } from './useLongPress';
export { useSwipeBack } from './useSwipeBack';
export { useModalState } from './useModalState';
export { useRouteSync } from './useRouteSync';
export { useCanonical } from './useCanonical';
export { useKeyboardShortcuts, useListNavigation } from './useKeyboardShortcuts';
export { useDragAndDrop } from './useDragAndDrop';

// Types
export type { UseSwipeGestureOptions, UseGlobalSwipeOptions } from './useSwipeGesture';
export type { UsePullToRefreshOptions, UsePullToRefreshReturn } from './usePullToRefresh';
export type { UseLongPressOptions, UseLongPressReturn } from './useLongPress';
export type { UseSwipeBackOptions } from './useSwipeBack';
export type {
  ModalState,
  ProjectModalContext,
  PromoteDecision,
  OpenMyCompanyPayload,
  NavigateToConversationPayload,
} from './useModalState';
export type {
  KeyboardShortcutsOptions,
  ListItem,
  ListNavigationOptions,
  ListNavigationReturn,
} from './useKeyboardShortcuts';
export type {
  DraggableConversation,
  UseDragAndDropOptions,
  DragHandlers,
  DropHandlers,
  UseDragAndDropReturn,
} from './useDragAndDrop';
export type {
  StreamingContext,
  ConversationState,
  UseMessageStreamingOptions,
} from './useMessageStreaming';
export type { UseBulkConversationActionsOptions } from './useBulkConversationActions';
export type { UseTriageOptions } from './useTriage';
export type { FeatureFlags, FeatureFlagName } from './useFeatureFlags';
