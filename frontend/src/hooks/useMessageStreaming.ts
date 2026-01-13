/**
 * Hook for handling message streaming (council and chat modes)
 *
 * Extracts the complex streaming logic from App.tsx to reduce its size
 * and make the streaming behavior testable.
 *
 * Performance: Uses requestAnimationFrame batching for token updates
 * to reduce CPU usage during streaming (~60fps cap instead of per-token).
 */

import { useCallback, useRef, useEffect } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';
import type { Conversation, Message, StreamingState } from '../types/conversation';

const log = logger.scope('MessageStreaming');

// ============================================================================
// Types
// ============================================================================

/** Extended conversation type with internal streaming state */
interface StreamableConversation extends Omit<Conversation, 'messages'> {
  messages: StreamableMessage[];
  /** Internal timestamp for tracking stream updates */
  _streamTick?: number;
}

/** Message with streaming-specific fields - extends Message with optional streaming state */
interface StreamableMessage extends Message {
  stage1Streaming?: Record<string, StreamingState>;
  stage2Streaming?: Record<string, StreamingState>;
  stage3Streaming?: StreamingState;
  isChat?: boolean;
  imageAnalysis?: unknown;
  loading?: { stage1: boolean; stage2: boolean; stage3: boolean };
}

/** Image attachment for upload */
interface ImageAttachment {
  file: File;
  preview?: string;
}

/** Uploaded attachment response */
interface UploadedAttachment {
  id: string;
}

/** Stream event data - typed as Record for API compatibility with narrowing helpers */
type StreamEventData = Record<string, unknown>;

/** State updater function type for conversation state */
type ConversationUpdater = (prev: StreamableConversation | null) => StreamableConversation | null;

// ============================================================================
// Performance: Token batching with requestAnimationFrame
// ============================================================================
interface PendingTokens {
  stage1: Record<string, string>;
  stage2: Record<string, string>;
  stage3: string;
  chat: string;
}

function useTokenBatcher(setCurrentConversation: (updater: ConversationUpdater) => void) {
  const pendingTokens = useRef<PendingTokens>({
    stage1: {},
    stage2: {},
    stage3: '',
    chat: '',
  });
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStreamingRef = useRef(false);

  // Check if there are pending tokens to flush
  const hasPendingTokens = useCallback(() => {
    const pending = pendingTokens.current;
    return (
      Object.keys(pending.stage1).length > 0 ||
      Object.keys(pending.stage2).length > 0 ||
      pending.stage3.length > 0 ||
      pending.chat.length > 0
    );
  }, []);

  const flushTokens = useCallback(() => {
    rafRef.current = null;
    const pending = pendingTokens.current;
    const hasStage1 = Object.keys(pending.stage1).length > 0;
    const hasStage2 = Object.keys(pending.stage2).length > 0;
    const hasStage3 = pending.stage3.length > 0;
    const hasChat = pending.chat.length > 0;

    if (!hasStage1 && !hasStage2 && !hasStage3 && !hasChat) return;

    setCurrentConversation((prev) => {
      if (!prev?.messages) return prev;
      const messages = [...prev.messages] as StreamableMessage[];
      const lastIdx = messages.length - 1;
      if (lastIdx < 0) return prev;

      const msg = { ...messages[lastIdx] };

      if (hasStage1) {
        const stage1Streaming = { ...msg.stage1Streaming };
        for (const [model, tokens] of Object.entries(pending.stage1)) {
          const current = stage1Streaming[model] || { text: '', complete: false };
          stage1Streaming[model] = { text: (current.text || '') + tokens, complete: false };
        }
        msg.stage1Streaming = stage1Streaming;
      }

      if (hasStage2) {
        const stage2Streaming = { ...msg.stage2Streaming };
        for (const [model, tokens] of Object.entries(pending.stage2)) {
          const current = stage2Streaming[model] || { text: '', complete: false };
          stage2Streaming[model] = { text: (current.text || '') + tokens, complete: false };
        }
        msg.stage2Streaming = stage2Streaming;
      }

      if (hasStage3 || hasChat) {
        const currentStreaming = msg.stage3Streaming || { text: '', complete: false };
        msg.stage3Streaming = {
          text: (currentStreaming.text || '') + pending.stage3 + pending.chat,
          complete: false,
        };
      }

      messages[lastIdx] = msg as StreamableMessage;
      pendingTokens.current = { stage1: {}, stage2: {}, stage3: '', chat: '' };

      return { ...prev, messages, _streamTick: Date.now() };
    });
  }, [setCurrentConversation]);

  // Start the fallback interval timer when streaming begins
  const startFallbackInterval = useCallback(() => {
    if (intervalRef.current === null) {
      isStreamingRef.current = true;
      // Fallback: flush every 100ms if RAF doesn't fire (e.g., tab in background)
      intervalRef.current = setInterval(() => {
        if (hasPendingTokens()) {
          log.debug('[TokenBatcher] Fallback interval flush triggered');
          flushTokens();
        }
      }, 100);
    }
  }, [flushTokens, hasPendingTokens]);

  // Stop the fallback interval when streaming ends
  const stopFallbackInterval = useCallback(() => {
    isStreamingRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    // Ensure fallback interval is running during streaming
    if (!isStreamingRef.current) {
      startFallbackInterval();
    }
    // Primary: use RAF for smooth 60fps updates when tab is active
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushTokens);
    }
  }, [flushTokens, startFallbackInterval]);

  const addStage1Token = useCallback(
    (model: string, content: string) => {
      pendingTokens.current.stage1[model] = (pendingTokens.current.stage1[model] || '') + content;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const addStage2Token = useCallback(
    (model: string, content: string) => {
      pendingTokens.current.stage2[model] = (pendingTokens.current.stage2[model] || '') + content;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const addStage3Token = useCallback(
    (content: string) => {
      pendingTokens.current.stage3 += content;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const addChatToken = useCallback(
    (content: string) => {
      pendingTokens.current.chat += content;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const flushNow = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushTokens();
    // Stop fallback interval when explicitly flushing (stream complete)
    stopFallbackInterval();
  }, [flushTokens, stopFallbackInterval]);

  // Flush on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasPendingTokens()) {
        log.debug('[TokenBatcher] Visibility change flush triggered');
        flushTokens();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushTokens, hasPendingTokens]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { addStage1Token, addStage2Token, addStage3Token, addChatToken, flushNow };
}

// Simple unique ID generator for message keys
let messageIdCounter = 0;
const generateMessageId = () => `msg-${Date.now()}-${++messageIdCounter}`;

// Generate an initial title from user's message (before AI generates one)
const generateInitialTitle = (content: string, maxLength = 60): string => {
  if (!content) return 'New Conversation';
  const cleaned = content.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
};

interface StreamingContext {
  selectedBusiness: string | null;
  selectedDepartment: string | null;
  selectedDepartments: string[];
  selectedRole: string | null;
  selectedRoles: string[];
  selectedPlaybooks: string[];
  selectedProject: string | null;
  useCompanyContext: boolean;
  useDepartmentContext: boolean;
}

/** Summarized conversation for list display */
interface ConversationListItem {
  id: string;
  title?: string;
  created_at?: string;
  message_count?: number;
}

interface ConversationState {
  currentConversationId: string | null;
  currentConversation: StreamableConversation | null;
  setCurrentConversationId: (id: string | null) => void;
  setCurrentConversation: (updater: ConversationUpdater) => void;
  setConversations: (updater: (prev: ConversationListItem[]) => ConversationListItem[]) => void;
  skipNextLoadRef: React.MutableRefObject<boolean>;
  loadConversations: () => void;
}

interface UseMessageStreamingOptions {
  context: StreamingContext;
  conversationState: ConversationState;
  setIsLoading: (loading: boolean) => void;
  setIsUploading: (uploading: boolean) => void;
}

export function useMessageStreaming({
  context,
  conversationState,
  setIsLoading,
  setIsUploading,
}: UseMessageStreamingOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    selectedBusiness,
    selectedDepartment,
    selectedDepartments,
    selectedRole,
    selectedRoles,
    selectedPlaybooks,
    selectedProject,
    useCompanyContext,
    useDepartmentContext,
  } = context;

  const {
    currentConversationId,
    currentConversation,
    setCurrentConversationId,
    setCurrentConversation,
    setConversations,
    skipNextLoadRef,
    loadConversations,
  } = conversationState;

  // Performance: Use batched token updates (RAF-throttled)
  const { addStage1Token, addStage2Token, addStage3Token, addChatToken, flushNow } =
    useTokenBatcher(setCurrentConversation);

  // Stop generation handler
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [setIsLoading]);

  // Create streaming event handler with batched token updates
  const createStreamEventHandler = useCallback(
    (conversationId: string) => (eventType: string, event: StreamEventData) => {
      if (eventType.includes('error') || eventType.includes('Error')) {
        log.error('[SSE Event]', eventType, event);
      }

      switch (eventType) {
        case 'stage1_start':
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? { ...msg, loading: { ...msg.loading, stage1: true }, stage1Streaming: {} }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;

        case 'stage1_token': {
          // Performance: Batched with RAF instead of per-token state updates
          const model = event.model as string;
          const content = event.content as string;
          addStage1Token(model, content);
          break;
        }

        case 'stage1_model_complete': {
          // Flush pending tokens before marking complete
          const model = event.model as string;
          const response = event.response as string | undefined;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) => {
              if (idx !== prev.messages.length - 1) return msg;
              const currentStreaming = msg.stage1Streaming?.[model];
              return {
                ...msg,
                stage1Streaming: {
                  ...msg.stage1Streaming,
                  [model]: currentStreaming
                    ? { ...currentStreaming, complete: true }
                    : { text: response || '', complete: true },
                },
              };
            }) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage1_model_error': {
          const model = event.model as string;
          const error = event.error as string;
          log.error(`[Stage1 Error] Model ${model}:`, error);
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage1Streaming: {
                      ...msg.stage1Streaming,
                      [model]: { text: `Error: ${error}`, complete: true, error: true },
                    },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage1_complete': {
          const data = event.data;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? { ...msg, stage1: data, loading: { ...msg.loading, stage1: false } }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage1_timeout': {
          // Handle Stage 1 timeout - individual models took too long
          log.error('Stage 1 timed out', event);
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? { ...msg, loading: { ...msg.loading, stage1: false } }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage1_insufficient': {
          // Not enough model responses - council cannot proceed
          const required = (event.required as number) ?? 3;
          const received = (event.received as number) ?? 0;
          log.error('Stage 1 insufficient responses', event);
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage3Streaming: {
                      text: `Only ${received} of ${required} required models responded. The council cannot provide a reliable synthesis. Please try again.`,
                      complete: true,
                      error: true,
                    },
                    loading: { stage1: false, stage2: false, stage3: false },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          setIsLoading(false);
          break;
        }

        case 'stage2_start':
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? { ...msg, loading: { ...msg.loading, stage2: true }, stage2Streaming: {} }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;

        case 'stage2_token': {
          // Performance: Batched with RAF instead of per-token state updates
          const model = event.model as string;
          const content = event.content as string;
          addStage2Token(model, content);
          break;
        }

        case 'stage2_model_complete': {
          const model = event.model as string;
          const ranking = event.ranking as string | undefined;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) => {
              if (idx !== prev.messages.length - 1) return msg;
              const currentStreaming = msg.stage2Streaming?.[model];
              return {
                ...msg,
                stage2Streaming: {
                  ...msg.stage2Streaming,
                  [model]: currentStreaming
                    ? { ...currentStreaming, complete: true }
                    : { text: ranking || '', complete: true },
                },
              };
            }) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage2_model_error': {
          const model = event.model as string;
          const error = event.error as string;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage2Streaming: {
                      ...msg.stage2Streaming,
                      [model]: { text: `Error: ${error}`, complete: true, error: true },
                    },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage2_complete': {
          const data = event.data;
          const metadata = event.metadata;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage2: data,
                    metadata: metadata,
                    loading: { ...msg.loading, stage2: false },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage2_timeout': {
          // Handle Stage 2 timeout - ranking models took too long
          log.error('Stage 2 timed out', event);
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? { ...msg, loading: { ...msg.loading, stage2: false } }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage3_start':
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    loading: { ...msg.loading, stage3: true },
                    stage3Streaming: { text: '', complete: false },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;

        case 'stage3_token': {
          // Performance: Batched with RAF instead of per-token state updates
          const content = event.content as string;
          addStage3Token(content);
          break;
        }

        case 'stage3_error': {
          const error = event.error as string;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage3Streaming: { text: `Error: ${error}`, complete: true, error: true },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage3_timeout': {
          // Handle Stage 3 timeout - synthesis took too long
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage3Streaming: {
                      text: 'Synthesis timed out. The chairman models are taking longer than expected. Please try again.',
                      complete: true,
                      error: true,
                    },
                    loading: { ...msg.loading, stage3: false },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'stage3_fallback': {
          // Chairman model failed, trying fallback - no UI update needed, just continue
          log.warn('Stage 3 fallback triggered', event);
          break;
        }

        case 'stage3_complete': {
          const data = event.data as { response?: string } | undefined;
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage3: data,
                    stage3Streaming: msg.stage3Streaming
                      ? { ...msg.stage3Streaming, complete: true }
                      : { text: data?.response || '', complete: true },
                    loading: { ...msg.loading, stage3: false },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        case 'title_complete': {
          // Backend sends: { type: 'title_complete', data: { title: '...' } }
          const data = event.data as { title?: string } | undefined;
          const newTitle = data?.title;
          if (newTitle) {
            setConversations((prev) =>
              prev.map((conv) => (conv.id === conversationId ? { ...conv, title: newTitle } : conv))
            );
            setCurrentConversation((prev) => {
              if (!prev || prev.id !== conversationId) return prev;
              return { ...prev, title: newTitle };
            });
          }
          break;
        }

        case 'complete':
          flushNow();
          loadConversations();
          setIsLoading(false);
          break;

        case 'error': {
          const message = event.message as string | undefined;
          log.error('Stream error:', message);
          flushNow();
          setCurrentConversation((prev) => {
            if (!prev || !prev.messages || prev.messages.length === 0) return prev;
            const messages = prev.messages.map((msg, idx) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    loading: { stage1: false, stage2: false, stage3: false },
                  }
                : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          setIsLoading(false);
          break;
        }

        case 'cancelled':
          log.debug('Request cancelled');
          flushNow();
          setIsLoading(false);
          break;

        case 'image_analysis_start': {
          const count = event.count as number | undefined;
          log.debug('[IMAGE] Starting analysis of', count, 'images');
          break;
        }

        case 'image_analysis_complete': {
          const analyzed = event.analyzed as number | undefined;
          const analysis = event.analysis;
          log.debug('[IMAGE] Analysis complete:', analyzed, 'images analyzed');
          if (analysis) {
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const lastIdx = prev.messages.length - 1;
              const messages = prev.messages.map((msg, idx) =>
                idx === lastIdx ? { ...msg, imageAnalysis: analysis } : msg
              ) as StreamableMessage[];
              return { ...prev, messages };
            });
          }
          break;
        }

        case 'usage': {
          // Token usage data for developer display
          const data = event.data;
          log.debug('[USAGE]', data);
          setCurrentConversation((prev) => {
            if (!prev?.messages) return prev;
            const lastIdx = prev.messages.length - 1;
            const messages = prev.messages.map((msg, idx) =>
              idx === lastIdx ? { ...msg, usage: data } : msg
            ) as StreamableMessage[];
            return { ...prev, messages };
          });
          break;
        }

        default:
          log.warn('Unknown event type:', eventType);
      }
    },
    [
      setCurrentConversation,
      setConversations,
      loadConversations,
      setIsLoading,
      addStage1Token,
      addStage2Token,
      addStage3Token,
      flushNow,
    ]
  );

  // Send message to council (full deliberation)
  const sendToCouncil = useCallback(
    async (content: string, images: ImageAttachment[] | null = null) => {
      if (!currentConversationId) return;

      abortControllerRef.current = new AbortController();
      setIsLoading(true);

      // Upload images if provided
      let attachmentIds: string[] | null = null;
      if (images && images.length > 0) {
        try {
          setIsUploading(true);
          log.debug(`Uploading ${images.length} images...`);
          const uploadPromises = images.map((img) => api.uploadAttachment(img.file));
          const uploadedAttachments = (await Promise.all(uploadPromises)) as UploadedAttachment[];
          attachmentIds = uploadedAttachments.map((a) => a.id);
          log.debug(`Uploaded attachments:`, attachmentIds);
        } catch (error) {
          log.error('Failed to upload images:', error);
        } finally {
          setIsUploading(false);
        }
      }

      // Handle temp conversation creation
      let conversationId = currentConversationId;
      const isTemp = currentConversation?.isTemp || currentConversationId.startsWith('temp-');

      if (isTemp) {
        try {
          const newConv = await api.createConversation(selectedBusiness);
          conversationId = newConv.id;
          skipNextLoadRef.current = true;

          const initialTitle = generateInitialTitle(content);

          setCurrentConversationId(conversationId);
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            return { ...prev, id: conversationId, isTemp: false, title: initialTitle };
          });

          setConversations((prev) => [
            {
              id: conversationId,
              created_at: newConv.created_at,
              message_count: 0,
              title: initialTitle,
            },
            ...prev,
          ]);
        } catch (error) {
          log.error('Failed to create conversation:', error);
          setIsLoading(false);
          return;
        }
      }

      try {
        // Add user message optimistically
        const userMessage = { id: generateMessageId(), role: 'user' as const, content };
        setCurrentConversation((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, userMessage as StreamableMessage] };
        });

        // Create partial assistant message
        const assistantMessage = {
          id: generateMessageId(),
          role: 'assistant' as const,
          stage1Streaming: {},
          loading: { stage1: true, stage2: false, stage3: false },
        } satisfies Partial<StreamableMessage> & { id: string; role: 'assistant' };

        setCurrentConversation((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, assistantMessage] };
        });

        // Build effective context
        const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;
        const effectiveDepartment = useDepartmentContext ? selectedDepartment : null;
        const effectiveDepartments =
          useDepartmentContext && selectedDepartments.length > 0 ? selectedDepartments : null;
        const effectiveRoles = selectedRoles.length > 0 ? selectedRoles : null;
        const effectivePlaybooks = selectedPlaybooks.length > 0 ? selectedPlaybooks : null;

        await api.sendMessageStream(
          conversationId,
          content,
          createStreamEventHandler(conversationId),
          {
            businessId: effectiveBusinessId,
            department: effectiveDepartment,
            role: selectedRole,
            departments: effectiveDepartments,
            roles: effectiveRoles,
            playbooks: effectivePlaybooks,
            projectId: selectedProject,
            attachmentIds: attachmentIds,
            signal: abortControllerRef.current?.signal,
          }
        );
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          log.debug('Request was cancelled');
          setIsLoading(false);
          return;
        }
        log.error('Failed to send message:', error);
        setCurrentConversation((prev) => {
          if (!prev?.messages) return prev;
          return { ...prev, messages: prev.messages.slice(0, -2) };
        });
        setIsLoading(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      currentConversationId,
      currentConversation,
      selectedBusiness,
      selectedDepartment,
      selectedDepartments,
      selectedRole,
      selectedRoles,
      selectedPlaybooks,
      selectedProject,
      useCompanyContext,
      useDepartmentContext,
      setCurrentConversationId,
      setCurrentConversation,
      setConversations,
      skipNextLoadRef,
      createStreamEventHandler,
      setIsLoading,
      setIsUploading,
    ]
  );

  // Send chat message (chairman only, no full council)
  const sendChatMessage = useCallback(
    async (content: string) => {
      if (!currentConversationId || currentConversation?.isTemp) return;

      abortControllerRef.current = new AbortController();
      setIsLoading(true);

      try {
        // Add user message optimistically
        const userMessage = { id: generateMessageId(), role: 'user' as const, content };
        setCurrentConversation((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, userMessage as StreamableMessage] };
        });

        // Create partial assistant message for chat
        const assistantMessage = {
          id: generateMessageId(),
          role: 'assistant' as const,
          stage1: [],
          stage2: [],
          stage3Streaming: { text: '', complete: false },
          isChat: true,
          loading: { stage1: false, stage2: false, stage3: true },
        } satisfies Partial<StreamableMessage> & { id: string; role: 'assistant' };

        setCurrentConversation((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, assistantMessage] };
        });

        // Build effective context
        const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;
        const effectiveDepartmentId = useDepartmentContext ? selectedDepartment : null;
        const effectiveDepartmentIds =
          useDepartmentContext && selectedDepartments.length > 0 ? selectedDepartments : null;
        const effectiveRoleIds = selectedRoles.length > 0 ? selectedRoles : null;
        const effectivePlaybookIds = selectedPlaybooks.length > 0 ? selectedPlaybooks : null;

        await api.sendChatStream(
          currentConversationId,
          content,
          (eventType: string, event: StreamEventData) => {
            switch (eventType) {
              case 'chat_start':
                break;

              case 'chat_token': {
                // Performance: Batched with RAF instead of per-token state updates
                const content = event.content as string;
                addChatToken(content);
                break;
              }

              case 'chat_error': {
                const error = event.error as string | undefined;
                log.error('Chat error:', error);
                break;
              }

              case 'chat_complete': {
                const data = event.data as { model: string; content: string };
                flushNow();
                setCurrentConversation((prev) => {
                  if (!prev?.messages) return prev;
                  const messages = prev.messages.map((msg, idx) =>
                    idx === prev.messages.length - 1
                      ? {
                          ...msg,
                          stage3: { model: data.model, response: data.content },
                          stage3Streaming: { text: data.content, complete: true },
                          loading: { ...msg.loading, stage3: false },
                        }
                      : msg
                  ) as StreamableMessage[];
                  return { ...prev, messages };
                });
                break;
              }

              case 'complete':
                flushNow();
                setIsLoading(false);
                break;

              case 'error': {
                const message = event.message as string | undefined;
                log.error('Chat stream error:', message);
                flushNow();
                setCurrentConversation((prev) => {
                  if (!prev?.messages) return prev;
                  const messages = prev.messages.map((msg, idx) =>
                    idx === prev.messages.length - 1
                      ? { ...msg, loading: { stage1: false, stage2: false, stage3: false } }
                      : msg
                  ) as StreamableMessage[];
                  return { ...prev, messages };
                });
                setIsLoading(false);
                break;
              }

              case 'cancelled':
                log.debug('Chat request cancelled');
                flushNow();
                setIsLoading(false);
                break;

              default:
                log.warn('Unknown chat event type:', eventType);
            }
          },
          {
            businessId: effectiveBusinessId,
            departmentId: effectiveDepartmentId,
            departmentIds: effectiveDepartmentIds,
            roleIds: effectiveRoleIds,
            playbookIds: effectivePlaybookIds,
            projectId: selectedProject,
            signal: abortControllerRef.current?.signal,
          }
        );
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          log.debug('Chat request was cancelled');
          setIsLoading(false);
          return;
        }
        log.error('Failed to send chat message:', error);
        setCurrentConversation((prev) => {
          if (!prev?.messages) return prev;
          return { ...prev, messages: prev.messages.slice(0, -2) };
        });
        setIsLoading(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      currentConversationId,
      currentConversation,
      selectedBusiness,
      selectedDepartment,
      selectedDepartments,
      selectedRoles,
      selectedPlaybooks,
      selectedProject,
      useCompanyContext,
      useDepartmentContext,
      setCurrentConversation,
      setIsLoading,
      addChatToken,
      flushNow,
    ]
  );

  return {
    sendToCouncil,
    sendChatMessage,
    handleStopGeneration,
    abortControllerRef,
  };
}

export type { StreamingContext, ConversationState, UseMessageStreamingOptions, ImageAttachment };
