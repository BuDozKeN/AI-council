/**
 * Hook for handling message streaming (council and chat modes)
 *
 * Extracts the complex streaming logic from App.tsx to reduce its size
 * and make the streaming behavior testable.
 */

import { useCallback, useRef } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';

const log = logger.scope('MessageStreaming');

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

interface ConversationState {
  currentConversationId: string | null;
  currentConversation: any;
  setCurrentConversationId: (id: string | null) => void;
  setCurrentConversation: (updater: any) => void;
  setConversations: (updater: any) => void;
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

  // Stop generation handler
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [setIsLoading]);

  // Create streaming event handler
  const createStreamEventHandler = useCallback(
    (conversationId: string) => (eventType: string, event: any) => {
      if (eventType.includes('error') || eventType.includes('Error')) {
        log.error('[SSE Event]', eventType, event);
      }

      switch (eventType) {
        case 'stage1_start':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? { ...msg, loading: { ...msg.loading, stage1: true }, stage1Streaming: {} }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage1_token':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const model = event.model;
            const messages = [...prev.messages];
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0) {
              const msg = messages[lastIdx];
              const currentStreaming = msg.stage1Streaming?.[model] || { text: '', complete: false };
              messages[lastIdx] = {
                ...msg,
                stage1Streaming: {
                  ...msg.stage1Streaming,
                  [model]: {
                    text: currentStreaming.text + event.content,
                    complete: false,
                  },
                },
              };
            }
            return { ...prev, messages, _streamTick: Date.now() };
          });
          break;

        case 'stage1_model_complete':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const model = event.model;
            const messages = prev.messages.map((msg: any, idx: number) => {
              if (idx !== prev.messages.length - 1) return msg;
              const currentStreaming = msg.stage1Streaming?.[model];
              return {
                ...msg,
                stage1Streaming: {
                  ...msg.stage1Streaming,
                  [model]: currentStreaming
                    ? { ...currentStreaming, complete: true }
                    : { text: event.response, complete: true },
                },
              };
            });
            return { ...prev, messages };
          });
          break;

        case 'stage1_model_error':
          log.error(`[Stage1 Error] Model ${event.model}:`, event.error);
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const model = event.model;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage1Streaming: {
                      ...msg.stage1Streaming,
                      [model]: { text: `Error: ${event.error}`, complete: true, error: true },
                    },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage1_complete':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? { ...msg, stage1: event.data, loading: { ...msg.loading, stage1: false } }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage2_start':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? { ...msg, loading: { ...msg.loading, stage2: true }, stage2Streaming: {} }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage2_token':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const model = event.model;
            const messages = [...prev.messages];
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0) {
              const msg = messages[lastIdx];
              const currentStreaming = msg.stage2Streaming?.[model] || { text: '', complete: false };
              messages[lastIdx] = {
                ...msg,
                stage2Streaming: {
                  ...msg.stage2Streaming,
                  [model]: {
                    text: currentStreaming.text + event.content,
                    complete: false,
                  },
                },
              };
            }
            return { ...prev, messages, _streamTick: Date.now() };
          });
          break;

        case 'stage2_model_complete':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const model = event.model;
            const messages = prev.messages.map((msg: any, idx: number) => {
              if (idx !== prev.messages.length - 1) return msg;
              const currentStreaming = msg.stage2Streaming?.[model];
              return {
                ...msg,
                stage2Streaming: {
                  ...msg.stage2Streaming,
                  [model]: currentStreaming
                    ? { ...currentStreaming, complete: true }
                    : { text: event.ranking, complete: true },
                },
              };
            });
            return { ...prev, messages };
          });
          break;

        case 'stage2_model_error':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const model = event.model;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage2Streaming: {
                      ...msg.stage2Streaming,
                      [model]: { text: `Error: ${event.error}`, complete: true, error: true },
                    },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage2_complete':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage2: event.data,
                    metadata: event.metadata,
                    loading: { ...msg.loading, stage2: false },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage3_start':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    loading: { ...msg.loading, stage3: true },
                    stage3Streaming: { text: '', complete: false },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage3_token':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = [...prev.messages];
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0) {
              const msg = messages[lastIdx];
              const currentStreaming = msg.stage3Streaming || { text: '', complete: false };
              messages[lastIdx] = {
                ...msg,
                stage3Streaming: {
                  text: currentStreaming.text + event.content,
                  complete: false,
                },
              };
            }
            return { ...prev, messages, _streamTick: Date.now() };
          });
          break;

        case 'stage3_error':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage3Streaming: { text: `Error: ${event.error}`, complete: true, error: true },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'stage3_complete':
          setCurrentConversation((prev: any) => {
            if (!prev?.messages) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    stage3: event.data,
                    stage3Streaming: msg.stage3Streaming
                      ? { ...msg.stage3Streaming, complete: true }
                      : { text: event.data.response, complete: true },
                    loading: { ...msg.loading, stage3: false },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          break;

        case 'title_complete':
          // Backend sends: { type: 'title_complete', data: { title: '...' } }
          const newTitle = event.data?.title;
          if (newTitle) {
            setConversations((prev: any[]) =>
              prev.map((conv) =>
                conv.id === conversationId ? { ...conv, title: newTitle } : conv
              )
            );
            setCurrentConversation((prev: any) => {
              if (!prev || prev.id !== conversationId) return prev;
              return { ...prev, title: newTitle };
            });
          }
          break;

        case 'complete':
          loadConversations();
          setIsLoading(false);
          break;

        case 'error':
          log.error('Stream error:', event.message);
          setCurrentConversation((prev: any) => {
            if (!prev || !prev.messages || prev.messages.length === 0) return prev;
            const messages = prev.messages.map((msg: any, idx: number) =>
              idx === prev.messages.length - 1
                ? {
                    ...msg,
                    loading: { stage1: false, stage2: false, stage3: false },
                  }
                : msg
            );
            return { ...prev, messages };
          });
          setIsLoading(false);
          break;

        case 'cancelled':
          log.debug('Request cancelled');
          setIsLoading(false);
          break;

        case 'image_analysis_start':
          log.debug('[IMAGE] Starting analysis of', event.count, 'images');
          break;

        case 'image_analysis_complete':
          log.debug('[IMAGE] Analysis complete:', event.analyzed, 'images analyzed');
          if (event.analysis) {
            setCurrentConversation((prev: any) => {
              if (!prev?.messages) return prev;
              const lastIdx = prev.messages.length - 1;
              const messages = prev.messages.map((msg: any, idx: number) =>
                idx === lastIdx ? { ...msg, imageAnalysis: event.analysis } : msg
              );
              return { ...prev, messages };
            });
          }
          break;

        default:
          log.warn('Unknown event type:', eventType);
      }
    },
    [setCurrentConversation, setConversations, loadConversations, setIsLoading]
  );

  // Send message to council (full deliberation)
  const sendToCouncil = useCallback(
    async (content: string, images: any[] | null = null) => {
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
          const uploadedAttachments = await Promise.all(uploadPromises);
          attachmentIds = uploadedAttachments.map((a: any) => a.id);
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
          setCurrentConversation((prev: any) => {
            if (!prev) return prev;
            return { ...prev, id: conversationId, isTemp: false, title: initialTitle };
          });

          setConversations((prev: any[]) => [
            { id: conversationId, created_at: newConv.created_at, message_count: 0, title: initialTitle },
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
        const userMessage = { id: generateMessageId(), role: 'user', content };
        setCurrentConversation((prev: any) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, userMessage] };
        });

        // Create partial assistant message
        const assistantMessage = {
          id: generateMessageId(),
          role: 'assistant',
          stage1: null,
          stage1Streaming: {},
          stage2: null,
          stage3: null,
          metadata: null,
          loading: { stage1: true, stage2: false, stage3: false },
        };

        setCurrentConversation((prev: any) => {
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

        await api.sendMessageStream(conversationId, content, createStreamEventHandler(conversationId), {
          businessId: effectiveBusinessId,
          department: effectiveDepartment,
          role: selectedRole,
          departments: effectiveDepartments,
          roles: effectiveRoles,
          playbooks: effectivePlaybooks,
          projectId: selectedProject,
          attachmentIds: attachmentIds,
          signal: abortControllerRef.current?.signal,
        });
      } catch (error: any) {
        if (error.name === 'AbortError') {
          log.debug('Request was cancelled');
          setIsLoading(false);
          return;
        }
        log.error('Failed to send message:', error);
        setCurrentConversation((prev: any) => {
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
        const userMessage = { id: generateMessageId(), role: 'user', content };
        setCurrentConversation((prev: any) => {
          if (!prev) return prev;
          return { ...prev, messages: [...prev.messages, userMessage] };
        });

        // Create partial assistant message for chat
        const assistantMessage = {
          id: generateMessageId(),
          role: 'assistant',
          stage1: [],
          stage2: [],
          stage3: null,
          stage3Streaming: { text: '', complete: false },
          isChat: true,
          loading: { stage1: false, stage2: false, stage3: true },
        };

        setCurrentConversation((prev: any) => {
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
          (eventType: string, event: any) => {
            switch (eventType) {
              case 'chat_start':
                break;

              case 'chat_token':
                setCurrentConversation((prev: any) => {
                  if (!prev?.messages) return prev;
                  const messages = prev.messages.map((msg: any, idx: number) => {
                    if (idx !== prev.messages.length - 1) return msg;
                    const currentStreaming = msg.stage3Streaming || { text: '', complete: false };
                    return {
                      ...msg,
                      stage3Streaming: {
                        ...currentStreaming,
                        text: currentStreaming.text + event.content,
                      },
                    };
                  });
                  return { ...prev, messages };
                });
                break;

              case 'chat_error':
                log.error('Chat error:', event.error);
                break;

              case 'chat_complete':
                setCurrentConversation((prev: any) => {
                  if (!prev?.messages) return prev;
                  const messages = prev.messages.map((msg: any, idx: number) =>
                    idx === prev.messages.length - 1
                      ? {
                          ...msg,
                          stage3: { model: event.data.model, response: event.data.content },
                          stage3Streaming: { text: event.data.content, complete: true },
                          loading: { ...msg.loading, stage3: false },
                        }
                      : msg
                  );
                  return { ...prev, messages };
                });
                break;

              case 'complete':
                setIsLoading(false);
                break;

              case 'error':
                log.error('Chat stream error:', event.message);
                setCurrentConversation((prev: any) => {
                  if (!prev?.messages) return prev;
                  const messages = prev.messages.map((msg: any, idx: number) =>
                    idx === prev.messages.length - 1
                      ? { ...msg, loading: { stage1: false, stage2: false, stage3: false } }
                      : msg
                  );
                  return { ...prev, messages };
                });
                setIsLoading(false);
                break;

              case 'cancelled':
                log.debug('Chat request cancelled');
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
      } catch (error: any) {
        if (error.name === 'AbortError') {
          log.debug('Chat request was cancelled');
          setIsLoading(false);
          return;
        }
        log.error('Failed to send chat message:', error);
        setCurrentConversation((prev: any) => {
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
    ]
  );

  return {
    sendToCouncil,
    sendChatMessage,
    handleStopGeneration,
    abortControllerRef,
  };
}

export type { StreamingContext, ConversationState, UseMessageStreamingOptions };
