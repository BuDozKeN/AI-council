/**
 * Hook for bulk conversation actions with optimistic updates and undo support
 */

import { useCallback } from 'react';
import { api } from '../api';
import { toast } from '../components/ui/sonner';
import { logger } from '../utils/logger';
import type { Conversation } from '../types/conversation';

const log = logger.scope('BulkActions');

interface UseBulkConversationActionsOptions {
  conversations: Conversation[];
  currentConversationId: string | null;
  setConversations: (updater: (prev: Conversation[]) => Conversation[]) => void;
  setCurrentConversation: (
    conv: Conversation | null | ((prev: Conversation | null) => Conversation | null)
  ) => void;
  setCurrentConversationId: (id: string | null) => void;
}

export function useBulkConversationActions({
  conversations,
  currentConversationId,
  setConversations,
  setCurrentConversation,
  setCurrentConversationId,
}: UseBulkConversationActionsOptions) {
  const handleBulkDeleteConversations = useCallback(
    async (ids: string[]) => {
      // Store conversations for potential undo
      const conversationsToDelete = conversations.filter((c) => ids.includes(c.id));
      if (conversationsToDelete.length === 0) return { deleted: [] };

      // Store original positions for restore
      const originalPositions = ids
        .map((id) => ({
          id,
          index: conversations.findIndex((c) => c.id === id),
          conversation: conversations.find((c) => c.id === id),
        }))
        .filter((item) => item.conversation);

      const wasCurrentConversationDeleted = ids.includes(currentConversationId || '');

      // Optimistically remove from UI immediately
      setConversations((prev) => prev.filter((conv) => !ids.includes(conv.id)));
      if (wasCurrentConversationDeleted) {
        setCurrentConversation(null);
        setCurrentConversationId(null);
      }

      // Track whether undo was clicked
      let undoClicked = false;

      const executeDelete = async () => {
        if (!undoClicked) {
          try {
            await api.bulkDeleteConversations(ids);
          } catch (error) {
            log.error('Failed to bulk delete conversations:', error);
            // Restore on error
            setConversations((prev) => {
              const newList = [...prev];
              originalPositions
                .sort((a, b) => a.index - b.index)
                .forEach(({ index, conversation }) => {
                  if (conversation) newList.splice(index, 0, conversation);
                });
              return newList;
            });
            toast.error('Failed to delete conversations');
          }
        }
      };

      // Show toast with undo action
      toast(`${conversationsToDelete.length} conversations deleted`, {
        action: {
          label: 'Undo',
          onClick: () => {
            undoClicked = true;
            // Restore conversations at original positions
            setConversations((prev) => {
              const newList = [...prev];
              // Sort by original index to insert in correct order
              originalPositions
                .sort((a, b) => a.index - b.index)
                .forEach(({ index, conversation }) => {
                  if (conversation) newList.splice(index, 0, conversation);
                });
              return newList;
            });
            // Restore selection if it was a deleted conversation
            if (wasCurrentConversationDeleted) {
              setCurrentConversationId(currentConversationId);
            }
            toast.success(`${conversationsToDelete.length} conversations restored`);
          },
        },
        duration: 5000,
        onDismiss: executeDelete,
        onAutoClose: executeDelete,
      });

      return { deleted: ids };
    },
    [
      conversations,
      currentConversationId,
      setConversations,
      setCurrentConversation,
      setCurrentConversationId,
    ]
  );

  const handleUpdateConversationDepartment = useCallback(
    (conversationId: string, newDepartment: string) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, department: newDepartment } : conv
        )
      );
      // Also update current conversation if it's the one being moved
      setCurrentConversation((prev) =>
        prev && prev.id === conversationId ? { ...prev, department: newDepartment } : prev
      );
    },
    [setConversations, setCurrentConversation]
  );

  return {
    handleBulkDeleteConversations,
    handleUpdateConversationDepartment,
  };
}

export type { UseBulkConversationActionsOptions };
