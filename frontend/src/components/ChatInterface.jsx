import { useState, useRef, useEffect } from 'react';
import Triage from './Triage';
import ImageUpload from './ImageUpload';
import CouncilProgressCapsule from './CouncilProgressCapsule';
import { Spinner } from './ui/Spinner';
import { MessageSkeletonGroup } from './ui/Skeleton';
import {
  WelcomeState,
  ConversationEmptyState,
  ContextIndicator,
  ContextBar,
  ModeToggle,
  MessageList,
  ChatInput
} from './chat';
import './ChatInterface.css';
import './ImageUpload.css';

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
  onReturnToMyCompany,
  // Initial loading state (for conversation fetch)
  isLoadingConversation = false,
}) {
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState('chat');
  const [attachedImages, setAttachedImages] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const userHasScrolledUp = useRef(false);

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

  // Handle user scroll - track if they've scrolled up
  const handleScroll = () => {
    userHasScrolledUp.current = !isNearBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (!userHasScrolledUp.current && !scrollToStage3) {
      scrollToBottom();
    }
  }, [conversation, scrollToStage3]);

  // Scroll to Stage 3 when navigating from decision source
  useEffect(() => {
    if (scrollToStage3 && conversation?.messages?.length > 0) {
      userHasScrolledUp.current = true;

      const timer = setTimeout(() => {
        let targetElement = null;

        if (scrollToResponseIndex !== null && scrollToResponseIndex !== undefined) {
          const allMessageGroups = messagesContainerRef.current?.querySelectorAll('.message-group');
          if (allMessageGroups && allMessageGroups.length > scrollToResponseIndex) {
            const messageGroup = allMessageGroups[scrollToResponseIndex];
            targetElement = messageGroup?.querySelector('.stage3') ||
                           messageGroup?.querySelector('.chat-response') ||
                           messageGroup;
          } else {
            const allStage3Elements = messagesContainerRef.current?.querySelectorAll('.stage3');
            if (allStage3Elements && allStage3Elements.length > 0) {
              targetElement = allStage3Elements[allStage3Elements.length - 1];
            }
          }
        } else {
          targetElement = messagesContainerRef.current?.querySelector('.stage3');
        }

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (onScrollToStage3Complete) {
          onScrollToStage3Complete();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scrollToStage3, scrollToResponseIndex, conversation, onScrollToStage3Complete]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((input.trim() || attachedImages.length > 0) && !isLoading) {
      userHasScrolledUp.current = false;
      const imagesToSend = attachedImages.length > 0 ? attachedImages : null;

      if (conversation.messages.length === 0) {
        onSendMessage(input, imagesToSend);
      } else if (chatMode === 'council') {
        onSendMessage(input, imagesToSend);
      } else {
        onSendChatMessage(input, imagesToSend);
      }

      setInput('');
      setAttachedImages([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // No conversation - show welcome state
  if (!conversation) {
    return <WelcomeState />;
  }

  // Format tab name for display
  const formatTabName = (tab) => {
    const tabNames = {
      'decisions': 'Decisions',
      'activity': 'Activity',
      'playbooks': 'Playbooks',
      'projects': 'Projects',
      'team': 'Team',
      'overview': 'Overview'
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
          onClick={() => onReturnToMyCompany(returnToMyCompanyTab)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to {formatTabName(returnToMyCompanyTab)}</span>
        </button>
      )}

      <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
        {/* Persistent Context Indicator */}
        {selectedBusiness && hasMessages && (
          <ContextIndicator
            businesses={businesses}
            selectedBusiness={selectedBusiness}
            projects={projects}
            selectedProject={selectedProject}
            departments={departments}
            selectedDepartment={selectedDepartment}
            roles={roles}
            selectedRole={selectedRole}
          />
        )}

        {/* Triage - show at top when active */}
        {triageState === 'analyzing' && (
          <div className="triage-analyzing">
            <Spinner size="md" />
            <span>Analyzing your question...</span>
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

        {/* Show skeleton while loading conversation */}
        {isLoadingConversation && !hasMessages && (
          <MessageSkeletonGroup count={3} />
        )}

        {/* Show empty state only when no triage and no messages */}
        {!hasMessages && !triageState && !isLoadingConversation ? (
          <ConversationEmptyState />
        ) : hasMessages ? (
          <MessageList
            messages={conversation.messages}
            conversation={conversation}
            selectedBusiness={selectedBusiness}
            selectedDepartment={selectedDepartment}
            selectedProject={selectedProject}
            projects={projects}
            onSelectProject={onSelectProject}
            onOpenProjectModal={onOpenProjectModal}
            onProjectCreated={onProjectCreated}
            onViewDecision={onViewDecision}
          />
        ) : null}

        {/* Loading indicator during initial setup */}
        {isLoading && hasMessages && (() => {
          const lastMsg = conversation.messages[conversation.messages.length - 1];
          if (lastMsg.role === 'assistant' && (lastMsg.loading?.stage1 || lastMsg.loading?.stage2 || lastMsg.loading?.stage3)) {
            return null;
          }
          return (
            <div className="loading-indicator">
              <Spinner size="md" />
              <span>Setting up conversation...</span>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Input form when no triage active */}
      {!triageState && (
        <form
          className={`input-form ${imageUpload.isDragging ? 'dragging' : ''}`}
          onSubmit={handleSubmit}
          {...imageUpload.dropZoneProps}
          style={{ position: 'relative' }}
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
              onOpenProjectModal={onOpenProjectModal}
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
              departments={departments}
              selectedDepartment={selectedDepartment}
              onSelectDepartment={onSelectDepartment}
              roles={roles}
              selectedRole={selectedRole}
              onSelectRole={onSelectRole}
              selectedBusiness={selectedBusiness}
              useCompanyContext={useCompanyContext}
              onToggleCompanyContext={onToggleCompanyContext}
              useDepartmentContext={useDepartmentContext}
              onToggleDepartmentContext={onToggleDepartmentContext}
              isLoading={isLoading}
            />
          )}

          <ChatInput
            input={input}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onSubmit={handleSubmit}
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
        const isComplete = lastMsg?.stage3 && !loading?.stage3;
        const isStopped = lastMsg?.stopped;

        if (!isAnyLoading && !isComplete && !isStopped && !isUploading) return null;

        return (
          <CouncilProgressCapsule
            stage1Streaming={lastMsg?.stage1Streaming}
            stage2Streaming={lastMsg?.stage2Streaming}
            loading={loading}
            isComplete={isComplete}
            stopped={isStopped}
            isUploading={isUploading}
          />
        );
      })()}
    </main>
  );
}
