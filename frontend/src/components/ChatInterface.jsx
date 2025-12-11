import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import Triage from './Triage';
import ImageUpload from './ImageUpload';
import CouncilProgressCapsule from './CouncilProgressCapsule';
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
  // Knowledge Base navigation
  onViewKnowledgeBase,
}) {
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState('chat'); // 'chat' (chairman only) or 'council' (full)
  const [attachedImages, setAttachedImages] = useState([]); // Images to attach to message
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
    const threshold = 100; // pixels from bottom
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
    if (!userHasScrolledUp.current) {
      scrollToBottom();
    }
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((input.trim() || attachedImages.length > 0) && !isLoading) {
      userHasScrolledUp.current = false; // Reset so new responses auto-scroll

      // Prepare images for sending
      const imagesToSend = attachedImages.length > 0 ? attachedImages : null;

      // For new conversations (0 messages), always go through triage/council
      // For existing conversations, check the chat mode
      if (conversation.messages.length === 0) {
        onSendMessage(input, imagesToSend);
      } else if (chatMode === 'council') {
        onSendMessage(input, imagesToSend);
      } else {
        // Chat mode - send directly to chairman
        onSendChatMessage(input, imagesToSend);
      }

      setInput('');
      // Clear attached images after sending
      setAttachedImages([]);
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">AX</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to AxCouncil</h2>
          <p className="text-gray-500">Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
        {/* Triage - show at top when active */}
        {triageState === 'analyzing' && (
          <div className="triage-analyzing">
            <div className="spinner"></div>
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

        {/* Show empty state only when no triage and no messages */}
        {conversation.messages.length === 0 && !triageState ? (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask a question to consult the AI Council</p>
          </div>
        ) : conversation.messages.length > 0 ? (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  <div className="message-content">
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">
                    {msg.isChat ? 'AI Advisor' : 'AI Council'}
                  </div>

                  {/* For chat-only messages, show a simpler response */}
                  {msg.isChat ? (
                    /* Chat-only response - just show the response directly */
                    <div className="chat-response">
                      <div className="chat-label">Response</div>
                      {msg.stage3Streaming ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.stage3Streaming.text || ''}
                          </ReactMarkdown>
                          {msg.loading?.stage3 && <span className="cursor-blink">|</span>}
                        </div>
                      ) : msg.stage3 ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.stage3.response || msg.stage3.content || ''}
                          </ReactMarkdown>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    /* Full council response - show all 3 stages */
                    <>
                      {/* Stage 1 - show with streaming or final responses */}
                      {(msg.loading?.stage1 || msg.stage1 || (msg.stage1Streaming && Object.keys(msg.stage1Streaming).length > 0)) && (
                        <Stage1
                          responses={msg.stage1}
                          streaming={msg.stage1Streaming}
                          isLoading={msg.loading?.stage1}
                          stopped={msg.stopped}
                          isComplete={msg.stage3 && !msg.loading?.stage3}
                          conversationTitle={conversation?.title}
                          imageAnalysis={msg.imageAnalysis}
                        />
                      )}

                      {/* Stage 2 - show with streaming or final rankings */}
                      {(msg.loading?.stage2 || msg.stage2 || (msg.stage2Streaming && Object.keys(msg.stage2Streaming).length > 0)) && (
                        <Stage2
                          rankings={msg.stage2}
                          streaming={msg.stage2Streaming}
                          labelToModel={msg.metadata?.label_to_model || msg.label_to_model}
                          aggregateRankings={msg.metadata?.aggregate_rankings || msg.aggregate_rankings}
                          isLoading={msg.loading?.stage2}
                          isComplete={msg.stage3 && !msg.loading?.stage3}
                          conversationTitle={conversation?.title}
                        />
                      )}

                      {/* Stage 3 - show with streaming or final response */}
                      {(msg.loading?.stage3 || msg.stage3 || msg.stage3Streaming) && (
                        <Stage3
                          finalResponse={msg.stage3}
                          streaming={msg.stage3Streaming}
                          isLoading={msg.loading?.stage3}
                          companyId={selectedBusiness}
                          departmentId={selectedDepartment}
                          conversationId={conversation?.id}
                          conversationTitle={conversation?.title}
                          userQuestion={
                            // Get the FIRST user message in this conversation (the original question)
                            // This ensures follow-up questions still show the original context
                            conversation.messages.find(m => m.role === 'user')?.content || null
                          }
                          projects={projects}
                          currentProjectId={selectedProject}
                          onProjectCreated={onProjectCreated}
                        />
                      )}
                    </>
                  )}

                </div>
              )}
            </div>
          ))
        ) : null}

        {/* Only show this loading indicator if we don't have an assistant message with stage loading */}
        {isLoading && conversation.messages.length > 0 && (() => {
          const lastMsg = conversation.messages[conversation.messages.length - 1];
          // Don't show generic loading if there's already an assistant message showing stages
          if (lastMsg.role === 'assistant' && (lastMsg.loading?.stage1 || lastMsg.loading?.stage2 || lastMsg.loading?.stage3)) {
            return null;
          }
          // Show generic loading only during initial setup (creating conversation, etc.)
          return (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Setting up conversation...</span>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Show input form when:
          1. New conversation (0 messages) and no triage active
          2. Existing conversation with messages and not loading (follow-up mode)
      */}
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
          {conversation.messages.length === 0 && businesses.length > 0 && (
            <div className="context-bar">
              {/* Company selector as subtle dropdown */}
              <select
                id="business-select"
                value={selectedBusiness || ''}
                onChange={(e) => onSelectBusiness(e.target.value || null)}
                disabled={isLoading}
                className="context-select company-select"
              >
                <option value="">No company</option>
                {businesses.map((biz) => (
                  <option key={biz.id} value={biz.id}>
                    {biz.name}
                  </option>
                ))}
              </select>

              {/* When company selected: show company context toggle and department options */}
              {selectedBusiness && (
                <>
                  {/* Company Context toggle - independent */}
                  <button
                    type="button"
                    className={`context-pill ${useCompanyContext ? 'active' : ''}`}
                    onClick={() => onToggleCompanyContext(!useCompanyContext)}
                    disabled={isLoading}
                    title="Toggle company-wide context (main company knowledge)"
                  >
                    <span className="pill-icon">{useCompanyContext ? '✓' : '○'}</span>
                    <span className="pill-text">Company</span>
                  </button>

                  {/* Project selector with add button */}
                  <div className="project-selector-group">
                    {projects.length > 0 ? (
                      <select
                        id="project-select"
                        value={selectedProject || ''}
                        onChange={(e) => onSelectProject(e.target.value || null)}
                        disabled={isLoading}
                        className="context-select project-select"
                      >
                        <option value="">Company-wide</option>
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="no-projects-hint">No projects</span>
                    )}
                    <button
                      type="button"
                      className="add-project-btn"
                      onClick={onOpenProjectModal}
                      disabled={isLoading}
                      title="Add a new project or client"
                    >
                      +
                    </button>
                  </div>

                  {/* Department selector - always show when company has departments */}
                  {departments.length > 0 && (
                    <>
                      <select
                        id="department-select"
                        value={selectedDepartment || ''}
                        onChange={(e) => onSelectDepartment(e.target.value || null)}
                        disabled={isLoading}
                        className="context-select department-select"
                      >
                        <option value="">General Council</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>

                      {/* Role selector - show when department has roles */}
                      {selectedDepartment && roles.length > 0 && (
                        <select
                          id="role-select"
                          value={selectedRole || ''}
                          onChange={(e) => onSelectRole(e.target.value || null)}
                          disabled={isLoading}
                          className="context-select role-select"
                        >
                          <option value="">All {departments.find(d => d.id === selectedDepartment)?.name || 'Dept'} Roles</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Department Context toggle - only when department is selected */}
                      {selectedDepartment && (
                        <button
                          type="button"
                          className={`context-pill ${useDepartmentContext ? 'active' : ''}`}
                          onClick={() => onToggleDepartmentContext(!useDepartmentContext)}
                          disabled={isLoading}
                          title="Toggle department-specific context (department knowledge)"
                        >
                          <span className="pill-icon">{useDepartmentContext ? '✓' : '○'}</span>
                          <span className="pill-text">Dept</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Channel - only when department has channels */}
                  {selectedDepartment && channels.length > 0 && (
                    <select
                      id="channel-select"
                      value={selectedChannel || ''}
                      onChange={(e) => onSelectChannel(e.target.value || null)}
                      disabled={isLoading}
                      className="context-select channel-select"
                    >
                      <option value="">Any channel</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Style - only when company has styles */}
                  {styles.length > 0 && (
                    <select
                      id="style-select"
                      value={selectedStyle || ''}
                      onChange={(e) => onSelectStyle(e.target.value || null)}
                      disabled={isLoading}
                      className="context-select style-select"
                    >
                      <option value="">Default style</option>
                      {styles.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
          )}

          {/* Mode toggle - only show for follow-up messages (after first exchange) */}
          {conversation.messages.length > 0 && (
            <div className={`mode-toggle-bar ${isLoading ? 'disabled' : ''}`}>
              <span className="mode-label">Continue with:</span>
              <div className="mode-buttons">
                <button
                  type="button"
                  className={`mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
                  onClick={() => !isLoading && setChatMode('chat')}
                  disabled={isLoading}
                  title="Quick follow-up with Claude Opus 4.5 (faster, uses less tokens)"
                >
                  Chat
                </button>
                <button
                  type="button"
                  className={`mode-btn ${chatMode === 'council' ? 'active' : ''}`}
                  onClick={() => !isLoading && setChatMode('council')}
                  disabled={isLoading}
                  title="Full council deliberation with all 5 models"
                >
                  Full Council
                </button>
              </div>

              {/* Department pills - only show when Full Council is selected and company has departments */}
              {chatMode === 'council' && selectedBusiness && departments.length > 0 && (
                <div className="department-pills">
                  <button
                    type="button"
                    className={`dept-pill ${!selectedDepartment ? 'active' : ''}`}
                    onClick={() => !isLoading && onSelectDepartment(null)}
                    disabled={isLoading}
                    title="Consult the general council"
                  >
                    General
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      type="button"
                      className={`dept-pill ${selectedDepartment === dept.id ? 'active' : ''}`}
                      onClick={() => !isLoading && onSelectDepartment(dept.id)}
                      disabled={isLoading}
                      title={`Consult the ${dept.name} council`}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Role pills - only show when Full Council, department is selected, and department has roles */}
              {chatMode === 'council' && selectedDepartment && roles.length > 0 && (
                <div className="role-pills">
                  <button
                    type="button"
                    className={`role-pill ${!selectedRole ? 'active' : ''}`}
                    onClick={() => !isLoading && onSelectRole(null)}
                    disabled={isLoading}
                    title={`Consult all ${departments.find(d => d.id === selectedDepartment)?.name || 'department'} roles`}
                  >
                    All Roles
                  </button>
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={`role-pill ${selectedRole === role.id ? 'active' : ''}`}
                      onClick={() => !isLoading && onSelectRole(role.id)}
                      disabled={isLoading}
                      title={`Consult the ${role.name} council`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Context toggles - show when Full Council mode is selected and a business is selected */}
              {chatMode === 'council' && selectedBusiness && (
                <div className="context-toggles-row">
                  <span className="context-label">Context:</span>
                  <button
                    type="button"
                    className={`context-toggle-btn ${useCompanyContext ? 'active' : ''}`}
                    onClick={() => !isLoading && onToggleCompanyContext(!useCompanyContext)}
                    disabled={isLoading}
                    title="Toggle company-wide context (main company knowledge)"
                  >
                    <span className="toggle-icon">{useCompanyContext ? '✓' : '○'}</span>
                    Company
                  </button>
                  {selectedDepartment && (
                    <button
                      type="button"
                      className={`context-toggle-btn ${useDepartmentContext ? 'active' : ''}`}
                      onClick={() => !isLoading && onToggleDepartmentContext(!useDepartmentContext)}
                      disabled={isLoading}
                      title="Toggle department-specific context (department knowledge)"
                    >
                      <span className="toggle-icon">{useDepartmentContext ? '✓' : '○'}</span>
                      {departments.find(d => d.id === selectedDepartment)?.name || 'Dept'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Image error display */}
          {imageUpload.errorDisplay}

          {/* Image previews */}
          {imageUpload.previews}

          <div className="input-row">
            <div className="textarea-wrapper">
              <textarea
                className="message-input"
                placeholder={
                  conversation.messages.length === 0
                    ? "Ask the council... (Ctrl+V to paste images)"
                    : chatMode === 'chat'
                    ? "Follow-up question..."
                    : "Ask the full council..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={imageUpload.handlePaste}
                disabled={isLoading}
                rows={2}
              />
              {/* Image attach button - inside textarea */}
              <button
                type="button"
                className="attach-image-btn-inline"
                onClick={imageUpload.openFilePicker}
                disabled={isLoading}
                title="Attach images (drag & drop, paste, or click)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
            </div>
            {isLoading ? (
              <button
                type="button"
                className="stop-button"
                onClick={onStopGeneration}
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() && attachedImages.length === 0}
              >
                {conversation.messages.length === 0 ? 'Send' : chatMode === 'chat' ? 'Chat' : 'Council'}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Progress Capsule - ALWAYS shows what stage the council is on */}
      {(() => {
        const lastMsg = conversation?.messages?.[conversation.messages.length - 1];
        if (lastMsg?.role !== 'assistant') return null;

        const loading = lastMsg?.loading;
        const isAnyLoading = loading?.stage1 || loading?.stage2 || loading?.stage3;
        const isComplete = lastMsg?.stage3 && !loading?.stage3;
        const isStopped = lastMsg?.stopped;

        // Show if loading, complete, stopped, OR uploading
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
    </div>
  );
}
