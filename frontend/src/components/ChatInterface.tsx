import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp } from 'lucide-react';
import Triage from './Triage';
import ImageUpload from './ImageUpload';
import CouncilProgressCapsule from './CouncilProgressCapsule';
import { Spinner } from './ui/Spinner';
import { CouncilLoader } from './ui/CouncilLoader';
import {
  WelcomeState,
  ConversationEmptyState,
  ContextIndicator,
  ContextBar,
  ModeToggle,
  MessageList,
  ChatInput,
} from './chat';
import { hapticLight } from '../lib/haptics';
import type { Conversation } from '../types/conversation';
import type { Business, Department, Role, Channel, Style, Project, Playbook } from '../types/business';
import type { MyCompanyTab } from './mycompany/hooks';
import type { ProjectModalContext, PromoteDecision } from '../hooks/useModalState';
import './ChatInterface.css';
import './ImageUpload.css';

// Triage result type (compatible with App.tsx)
interface TriageResult {
  constraints?: Record<string, unknown>;
  enhanced_query?: string;
  follow_up_question?: string;
  questions?: string;
  ready?: boolean;
}

type TriageState = null | 'analyzing' | TriageResult;

// Image upload type (matching ImageUpload.tsx)
interface UploadedImage {
  file: File;
  preview: string;
  name: string;
  size: number;
  type: string;
}

interface ChatInterfaceProps {
  conversation: Conversation | null;
  onSendMessage: (content: string, images: UploadedImage[] | null) => void;
  onSendChatMessage: (content: string) => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  businesses?: Business[];
  selectedBusiness: string | null;
  onSelectBusiness: (id: string | null) => void;
  departments?: Department[];
  selectedDepartment: string | null;
  onSelectDepartment: (id: string | null) => void;
  // Multi-select support
  selectedDepartments?: string[];
  onSelectDepartments: (ids: string[]) => void;
  allRoles?: Role[];
  selectedRoles?: string[];
  onSelectRoles: (ids: string[]) => void;
  // Playbooks
  playbooks?: Playbook[];
  selectedPlaybooks?: string[];
  onSelectPlaybooks: (ids: string[]) => void;
  // Legacy single-select
  roles?: Role[];
  selectedRole: string | null;
  onSelectRole: (id: string | null) => void;
  channels?: Channel[];
  selectedChannel: string | null;
  onSelectChannel: (id: string | null) => void;
  styles?: Style[];
  selectedStyle: string | null;
  onSelectStyle: (id: string | null) => void;
  // Projects
  projects?: Project[];
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenProjectModal: (context: ProjectModalContext) => void;
  onProjectCreated: (project: Project) => void;
  // Independent context toggles
  useCompanyContext: boolean;
  onToggleCompanyContext: (value: boolean) => void;
  useDepartmentContext: boolean;
  onToggleDepartmentContext: (value: boolean) => void;
  // Triage props
  triageState: TriageState;
  originalQuestion: string;
  isTriageLoading: boolean;
  onTriageRespond: (response: string) => void;
  onTriageSkip: () => void;
  onTriageProceed: (query: string) => void;
  // Upload progress
  isUploading: boolean;
  // Decision navigation
  onViewDecision: (decisionId: string, type?: string, targetId?: string | null) => void;
  // Scroll to Stage 3 when navigating from decision source
  scrollToStage3: boolean;
  scrollToResponseIndex: number | null;
  onScrollToStage3Complete: () => void;
  // Return to My Company (after viewing source)
  returnToMyCompanyTab: MyCompanyTab | null;
  returnToProjectId: string | null;
  returnToDecisionId: string | null;
  returnPromoteDecision?: PromoteDecision | null;
  onReturnToMyCompany: (tab: MyCompanyTab, projectId: string | null, decisionId: string | null) => void;
  // Initial loading state (for conversation fetch)
  isLoadingConversation?: boolean;
  // Knowledge Base navigation
  onViewKnowledgeBase?: () => void;
  // Mobile sidebar toggle
  onOpenSidebar: () => void;
}

export default function ChatInterface({
  conversation,
  onSendMessage,
  onSendChatMessage,
  onStopGeneration,
  isLoading,
  businesses = [],
  selectedBusiness,
  onSelectBusiness,
  departments = [],
  selectedDepartment,
  onSelectDepartment,
  // Multi-select support
  selectedDepartments = [],
  onSelectDepartments,
  allRoles = [],
  selectedRoles = [],
  onSelectRoles,
  // Playbooks
  playbooks = [],
  selectedPlaybooks = [],
  onSelectPlaybooks,
  // Legacy single-select
  roles = [],
  selectedRole,
  onSelectRole,
  channels = [],
  selectedChannel,
  onSelectChannel,
  styles = [],
  selectedStyle,
  onSelectStyle,
  // Projects
  projects = [],
  selectedProject,
  onSelectProject,
  onOpenProjectModal,
  onProjectCreated,
  // Independent context toggles
  useCompanyContext,
  onToggleCompanyContext,
  useDepartmentContext,
  onToggleDepartmentContext,
  // Triage props
  triageState,
  originalQuestion,
  isTriageLoading,
  onTriageRespond,
  onTriageSkip,
  onTriageProceed,
  // Upload progress
  isUploading,
  // Decision navigation
  onViewDecision,
  // Scroll to Stage 3 when navigating from decision source
  scrollToStage3,
  scrollToResponseIndex,
  onScrollToStage3Complete,
  // Return to My Company (after viewing source)
  returnToMyCompanyTab,
  returnToProjectId,
  returnToDecisionId,
  onReturnToMyCompany,
  // Initial loading state (for conversation fetch)
  isLoadingConversation = false,
  // Mobile sidebar toggle
  onOpenSidebar: _onOpenSidebar,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState<'chat' | 'council'>('chat');
  const [attachedImages, setAttachedImages] = useState<UploadedImage[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const userHasScrolledUp = useRef(false);

  // Get first user question for context indicator
  const firstUserQuestion = useMemo(() => {
    const messages = conversation?.messages || [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg?.role === 'user') {
        return msg.content;
      }
    }
    return '';
  }, [conversation?.messages]);

  // Image upload hook
  const imageUpload = ImageUpload({
    images: attachedImages,
    onImagesChange: setAttachedImages,
    disabled: isLoading,
    maxImages: 5,
    maxSizeMB: 10,
  });

  // Check if user is near the bottom of the scroll area
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle user scroll - track if they've scrolled up and show/hide scroll-to-top
  const handleScroll = () => {
    userHasScrolledUp.current = !isNearBottom();
    const container = messagesContainerRef.current;
    if (container) {
      // Show scroll-to-top button when scrolled down more than 300px
      setShowScrollTop(container.scrollTop > 300);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to the last Stage 3 response (unused for now, kept for potential future use)
  // const scrollToLastStage3 = () => {
  //   const allStage3Elements = messagesContainerRef.current?.querySelectorAll('.stage3');
  //   if (allStage3Elements && allStage3Elements.length > 0) {
  //     const targetElement = allStage3Elements[allStage3Elements.length - 1];
  //     targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  //     return true;
  //   }
  //   return false;
  // };

  // Handle scroll when conversation loads or changes
  useEffect(() => {
    if (!conversation?.messages?.length) return;

    // If scrollToStage3 is requested, scroll to the last Stage 3
    if (scrollToStage3) {
      userHasScrolledUp.current = true;

      // Wait for DOM to fully render (animations need time)
      const timer = setTimeout(() => {
        let targetElement: Element | null = null;

        if (scrollToResponseIndex !== null && scrollToResponseIndex !== undefined) {
          // Scroll to a specific response index
          const allMessageGroups = messagesContainerRef.current?.querySelectorAll('.message-group');
          if (allMessageGroups && allMessageGroups.length > scrollToResponseIndex) {
            const messageGroup = allMessageGroups[scrollToResponseIndex];
            targetElement = messageGroup?.querySelector('.stage3') ??
                           messageGroup?.querySelector('.chat-response') ??
                           messageGroup ?? null;
          }
        }

        // Fallback: scroll to the last Stage 3
        if (!targetElement) {
          const allStage3Elements = messagesContainerRef.current?.querySelectorAll('.stage3');
          if (allStage3Elements && allStage3Elements.length > 0) {
            targetElement = allStage3Elements[allStage3Elements.length - 1] ?? null;
          }
        }

        if (targetElement) {
          // Use instant scroll for snappy, frictionless UX
          targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
        }

        if (onScrollToStage3Complete) {
          onScrollToStage3Complete();
        }
      }, 150);

      return () => clearTimeout(timer);
    }

    // Default behavior: scroll to bottom only if user hasn't scrolled up
    if (!userHasScrolledUp.current) {
      scrollToBottom();
    }
    return undefined;
  }, [scrollToStage3, scrollToResponseIndex, conversation, onScrollToStage3Complete]);

  // Auto-scroll during streaming - only if user hasn't scrolled up
  // Track the streaming text length to detect content changes
  const lastMsg = conversation?.messages?.[conversation?.messages?.length - 1];
  const streamingTextLength = useMemo(() => {
    if (!lastMsg || lastMsg.role !== 'assistant') return 0;

    // Calculate total streaming content length across all stages
    let length = 0;

    // Stage 1: sum of all model responses
    if (lastMsg.stage1Streaming) {
      Object.values(lastMsg.stage1Streaming).forEach((response: { text?: string } | string) => {
        if (typeof response === 'string') length += response.length;
        else if (response?.text) length += response.text.length;
      });
    }

    // Stage 2: sum of all model rankings
    if (lastMsg.stage2Streaming) {
      Object.values(lastMsg.stage2Streaming).forEach((ranking: { text?: string } | string) => {
        if (typeof ranking === 'string') length += ranking.length;
        else if (ranking?.text) length += ranking.text.length;
      });
    }

    // Stage 3: final response text
    if (lastMsg.stage3Streaming?.text) {
      length += lastMsg.stage3Streaming.text.length;
    }

    return length;
  }, [lastMsg]);

  useEffect(() => {
    // Skip if user has intentionally scrolled up
    if (userHasScrolledUp.current) return;

    if (!lastMsg || lastMsg.role !== 'assistant') return;

    // Check if any stage is actively streaming
    const isStreaming = lastMsg.loading?.stage1 || lastMsg.loading?.stage2 || lastMsg.loading?.stage3;
    if (!isStreaming) return;

    // Scroll to bottom during streaming
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [streamingTextLength, lastMsg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachedImages.length > 0) && !isLoading) {
      hapticLight(); // Haptic feedback on send
      userHasScrolledUp.current = false;
      const imagesToSend = attachedImages.length > 0 ? attachedImages : null;

      if (!conversation || conversation.messages.length === 0) {
        onSendMessage(input, imagesToSend);
      } else if (chatMode === 'council') {
        onSendMessage(input, imagesToSend);
      } else {
        onSendChatMessage(input);
      }

      setInput('');
      setAttachedImages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Loading conversation - show council loader
  if (!conversation && isLoadingConversation) {
    return (
      <main id="main-content" className="chat-interface" aria-label="Chat interface">
        <div className="council-loader-overlay">
          <CouncilLoader text="Getting your conversation ready..." />
        </div>
      </main>
    );
  }

  // No conversation - show welcome state
  if (!conversation) {
    return <WelcomeState />;
  }

  // Format tab name for display
  const formatTabName = (tab: MyCompanyTab): string => {
    const tabNames: Record<MyCompanyTab, string> = {
      'decisions': 'Decisions',
      'activity': 'Activity',
      'playbooks': 'Playbooks',
      'projects': 'Projects',
      'team': 'Team',
      'overview': 'Overview',
      'usage': 'Usage'
    };
    return tabNames[tab] || 'My Company';
  };

  const hasMessages = conversation.messages.length > 0;

  return (
    <main id="main-content" className="chat-interface" aria-label="Chat interface">
      {/* Back to My Company floating button */}
      {returnToMyCompanyTab && onReturnToMyCompany && (
        <button
          className="back-to-company-btn"
          onClick={() => onReturnToMyCompany(returnToMyCompanyTab, returnToProjectId, returnToDecisionId)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to {formatTabName(returnToMyCompanyTab)}</span>
        </button>
      )}

      <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
        {/* Persistent Context Indicator - shows question + context */}
        {hasMessages && (
          <ContextIndicator
            businesses={businesses}
            selectedBusiness={selectedBusiness || undefined}
            projects={projects}
            selectedProject={selectedProject || undefined}
            departments={departments}
            selectedDepartment={selectedDepartment || undefined}
            roles={roles}
            selectedRole={selectedRole || undefined}
            question={firstUserQuestion || undefined}
            conversationTitle={conversation?.title}
          />
        )}

        {/* Triage - show at top when active */}
        {triageState === 'analyzing' && (
          <div className="triage-analyzing">
            <Spinner size="md" />
            <span>Understanding what you need...</span>
          </div>
        )}

        {triageState && triageState !== 'analyzing' && (
          <Triage
            triageResult={triageState}
            originalQuestion={originalQuestion}
            onRespond={onTriageRespond}
            onSkip={onTriageSkip}
            onProceed={onTriageProceed}
            isLoading={isTriageLoading || isLoading}
          />
        )}

        {/* Show council loader while loading conversation */}
        {isLoadingConversation && !hasMessages && (
          <div className="council-loader-overlay">
            <CouncilLoader text="Getting your conversation ready..." />
          </div>
        )}

        {/* Show empty state only when no triage and no messages */}
        {!hasMessages && !triageState && !isLoadingConversation ? (
          <ConversationEmptyState />
        ) : hasMessages ? (
          <MessageList
            messages={conversation.messages as unknown as Parameters<typeof MessageList>[0]['messages']}
            conversation={conversation}
            selectedBusiness={selectedBusiness || undefined}
            selectedDepartment={selectedDepartment || undefined}
            selectedProject={selectedProject || undefined}
            projects={projects}
            onSelectProject={onSelectProject}
            onOpenProjectModal={(context) => onOpenProjectModal(context ? { type: 'new', ...context } : { type: 'new' })}
            onProjectCreated={onProjectCreated}
            onViewDecision={(decisionId: string | null, viewType?: string, contextId?: string) => {
              if (decisionId) {
                onViewDecision(decisionId, viewType, contextId ?? null);
              }
            }}
          />
        ) : null}

        {/* Loading indicator during initial setup - only show before any streaming begins */}
        {isLoading && hasMessages && (() => {
          const lastMsg = conversation.messages[conversation.messages.length - 1];
          if (lastMsg?.role === 'assistant') {
            // Hide if any stage is actively loading
            if (lastMsg?.loading?.stage1 || lastMsg?.loading?.stage2 || lastMsg?.loading?.stage3) {
              return null;
            }
            // Hide if any streaming data exists (prevents flicker between stages)
            const hasStage1Streaming = lastMsg?.stage1Streaming && Object.keys(lastMsg.stage1Streaming).length > 0;
            const hasStage2Streaming = lastMsg?.stage2Streaming && Object.keys(lastMsg.stage2Streaming).length > 0;
            const hasStage3Streaming = lastMsg?.stage3Streaming && lastMsg.stage3Streaming.text;
            // Hide if any final stage data exists
            const hasStage1Data = lastMsg?.stage1 && lastMsg.stage1.length > 0;
            const hasStage2Data = lastMsg?.stage2 && lastMsg.stage2.length > 0;
            const hasStage3Data = lastMsg?.stage3;
            if (hasStage1Streaming || hasStage2Streaming || hasStage3Streaming ||
                hasStage1Data || hasStage2Data || hasStage3Data) {
              return null;
            }
          }
          return (
            <div className="loading-indicator">
              <Spinner size="md" />
              <span>Preparing your council...</span>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />

        {/* Floating scroll-to-top button - inside messages container */}
        {showScrollTop && (
          <button
            className="scroll-to-top-fab"
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <ArrowUp size={20} />
          </button>
        )}
      </div>

      {/* Input form when no triage active */}
      {!triageState && (
        <form
          className={`input-form relative ${imageUpload.isDragging ? 'dragging' : ''}`}
          onSubmit={handleSubmit}
          {...imageUpload.dropZoneProps}
        >
          {imageUpload.dragOverlay}
          {imageUpload.fileInput}

          {/* Context bar - only show for new conversations */}
          {!hasMessages && (
            <ContextBar
              businesses={businesses}
              selectedBusiness={selectedBusiness}
              onSelectBusiness={onSelectBusiness}
              departments={departments}
              selectedDepartment={selectedDepartment}
              onSelectDepartment={onSelectDepartment}
              // Multi-select support
              selectedDepartments={selectedDepartments}
              onSelectDepartments={onSelectDepartments}
              allRoles={allRoles}
              selectedRoles={selectedRoles}
              onSelectRoles={onSelectRoles}
              // Playbooks
              playbooks={playbooks}
              selectedPlaybooks={selectedPlaybooks}
              onSelectPlaybooks={onSelectPlaybooks}
              // Legacy single-select
              roles={roles}
              selectedRole={selectedRole}
              onSelectRole={onSelectRole}
              channels={channels}
              selectedChannel={selectedChannel}
              onSelectChannel={onSelectChannel}
              styles={styles}
              selectedStyle={selectedStyle}
              onSelectStyle={onSelectStyle}
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={onSelectProject}
              onOpenProjectModal={() => onOpenProjectModal({ type: 'new' })}
              useCompanyContext={useCompanyContext}
              onToggleCompanyContext={onToggleCompanyContext}
              useDepartmentContext={useDepartmentContext}
              onToggleDepartmentContext={onToggleDepartmentContext}
              isLoading={isLoading}
            />
          )}

          {/* Mode toggle - only show for follow-up messages */}
          {hasMessages && (
            <ModeToggle
              chatMode={chatMode}
              onChatModeChange={setChatMode}
              // Multi-select props (primary)
              departments={departments}
              selectedDepartments={selectedDepartments}
              onSelectDepartments={onSelectDepartments}
              allRoles={allRoles}
              selectedRoles={selectedRoles}
              onSelectRoles={onSelectRoles}
              playbooks={playbooks}
              selectedPlaybooks={selectedPlaybooks}
              onSelectPlaybooks={onSelectPlaybooks}
              // Legacy single-select props (fallback)
              selectedDepartment={selectedDepartment}
              onSelectDepartment={onSelectDepartment}
              roles={roles}
              selectedRole={selectedRole}
              onSelectRole={onSelectRole}
              selectedBusiness={selectedBusiness}
              isLoading={isLoading}
            />
          )}

          <ChatInput
            input={input}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            isLoading={isLoading}
            onStopGeneration={onStopGeneration}
            chatMode={chatMode}
            hasMessages={hasMessages}
            hasImages={attachedImages.length > 0}
            imageUpload={imageUpload}
          />
        </form>
      )}

      {/* Progress Capsule */}
      {(() => {
        const lastMsg = conversation?.messages?.[conversation.messages.length - 1];
        if (lastMsg?.role !== 'assistant') return null;

        const loading = lastMsg?.loading;
        const isAnyLoading = loading?.stage1 || loading?.stage2 || loading?.stage3;
        const isComplete = Boolean(lastMsg?.stage3) && !loading?.stage3;
        const isStopped = lastMsg?.stopped;

        if (!isAnyLoading && !isComplete && !isStopped && !isUploading) return null;

        // Use type assertion since both types have compatible shapes
        const s1 = lastMsg?.stage1Streaming as Record<string, { complete?: boolean; text?: string }> | undefined;
        const s2 = lastMsg?.stage2Streaming as Record<string, { complete?: boolean; text?: string }> | undefined;

        return (
          <CouncilProgressCapsule
            stage1Streaming={s1 || null}
            stage2Streaming={s2 || null}
            loading={loading || null}
            isComplete={isComplete}
            stopped={isStopped || false}
            isUploading={isUploading}
          />
        );
      })()}
    </main>
  );
}
