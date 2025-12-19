import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import Triage from './Triage';
import ImageUpload from './ImageUpload';
import CouncilProgressCapsule from './CouncilProgressCapsule';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Spinner } from './ui/Spinner';
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
  // Decision navigation
  onViewDecision,
  // Scroll to Stage 3 when navigating from decision source
  scrollToStage3,
  scrollToResponseIndex,  // Specific response index for multi-turn conversations
  onScrollToStage3Complete,
  // Return to My Company (after viewing source)
  returnToMyCompanyTab,
  onReturnToMyCompany,
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
    if (!userHasScrolledUp.current && !scrollToStage3) {
      scrollToBottom();
    }
  }, [conversation, scrollToStage3]);

  // Scroll to Stage 3 when navigating from decision source
  useEffect(() => {
    if (scrollToStage3 && conversation?.messages?.length > 0) {
      // Prevent auto-scroll to bottom from interfering
      userHasScrolledUp.current = true;

      // Longer delay to ensure DOM is fully rendered after conversation loads
      const timer = setTimeout(() => {
        let targetElement = null;

        // If we have a specific response index, find the message group at that index
        // response_index is the index in the full messages array (including user messages and chat responses)
        if (scrollToResponseIndex !== null && scrollToResponseIndex !== undefined) {
          // Find all message groups (each message is in a .message-group div)
          const allMessageGroups = messagesContainerRef.current?.querySelectorAll('.message-group');
          if (allMessageGroups && allMessageGroups.length > scrollToResponseIndex) {
            // Found the message group at this index
            const messageGroup = allMessageGroups[scrollToResponseIndex];
            // Try to find a stage3 or chat-response within this group
            targetElement = messageGroup?.querySelector('.stage3') ||
                           messageGroup?.querySelector('.chat-response') ||
                           messageGroup;
          } else {
            // Fallback: try to find any stage3 element
            const allStage3Elements = messagesContainerRef.current?.querySelectorAll('.stage3');
            if (allStage3Elements && allStage3Elements.length > 0) {
              targetElement = allStage3Elements[allStage3Elements.length - 1];
            }
          }
        } else {
          // No specific index - scroll to first stage3
          targetElement = messagesContainerRef.current?.querySelector('.stage3');
        }

        if (targetElement) {
          // Scroll to TOP of the target Stage 3 so user can read from the beginning
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Clear the flag after scroll completes
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

  return (
    <main id="main-content" className="chat-interface" aria-label="Chat interface">
      {/* Back to My Company floating button - shows when navigating from Source */}
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
        {/* Persistent Context Indicator - shows current context during conversation */}
        {selectedBusiness && conversation.messages.length > 0 && (
          <div className="context-indicator">
            <span className="context-indicator-label">Context:</span>
            <span className="context-indicator-item company">
              {businesses.find(b => b.id === selectedBusiness)?.name || 'Company'}
            </span>
            {selectedProject && (
              <span className="context-indicator-item project">
                {projects.find(p => p.id === selectedProject)?.name || 'Project'}
              </span>
            )}
            {selectedDepartment && (
              <span className="context-indicator-item department">
                {departments.find(d => d.id === selectedDepartment)?.name || 'Department'}
              </span>
            )}
            {selectedRole && (
              <span className="context-indicator-item role">
                {roles.find(r => r.id === selectedRole)?.name || 'Role'}
              </span>
            )}
          </div>
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

        {/* Show empty state only when no triage and no messages */}
        {conversation.messages.length === 0 && !triageState ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <h2>Ask the Council</h2>
            <p>Get insights from 5 AI models who debate and synthesize the best answer</p>
            <div className="empty-state-hints">
              <span className="hint-item">💡 Try: "What's the best approach to..."</span>
              <span className="hint-item">📎 Paste images with Ctrl+V</span>
            </div>
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
                          responseIndex={index}  // Unique index for this response within the conversation
                          userQuestion={
                            // Get the user message that immediately preceded THIS specific response
                            // This ensures each decision has its own unique question context
                            (() => {
                              // Look backwards from this index to find the nearest user message
                              for (let i = index - 1; i >= 0; i--) {
                                if (conversation.messages[i]?.role === 'user') {
                                  return conversation.messages[i].content;
                                }
                              }
                              return null;
                            })()
                          }
                          projects={projects}
                          currentProjectId={selectedProject}
                          onSelectProject={onSelectProject}
                          onCreateProject={onOpenProjectModal}
                          onProjectCreated={onProjectCreated}
                          onViewDecision={onViewDecision}
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
              <Spinner size="md" />
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
              {/* Company selector as styled dropdown */}
              <Select value={selectedBusiness || '__none__'} onValueChange={(v) => onSelectBusiness(v === '__none__' ? null : v)} disabled={isLoading}>
                <SelectTrigger className="context-select-trigger company-select-trigger">
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No company</SelectItem>
                  {businesses.map((biz) => (
                    <SelectItem key={biz.id} value={biz.id}>
                      {biz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                      <Select value={selectedProject || '__none__'} onValueChange={(v) => onSelectProject(v === '__none__' ? null : v)} disabled={isLoading}>
                        <SelectTrigger className="context-select-trigger project-select-trigger">
                          <SelectValue placeholder="Company-wide" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Company-wide</SelectItem>
                          {projects.map((proj) => (
                            <SelectItem key={proj.id} value={proj.id}>
                              {proj.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Select value={selectedDepartment || '__none__'} onValueChange={(v) => onSelectDepartment(v === '__none__' ? null : v)} disabled={isLoading}>
                        <SelectTrigger className="context-select-trigger department-select-trigger">
                          <SelectValue placeholder="General Council" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">General Council</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Role selector - show when department has roles */}
                      {selectedDepartment && roles.length > 0 && (
                        <Select value={selectedRole || '__none__'} onValueChange={(v) => onSelectRole(v === '__none__' ? null : v)} disabled={isLoading}>
                          <SelectTrigger className="context-select-trigger role-select-trigger">
                            <SelectValue placeholder={`All ${departments.find(d => d.id === selectedDepartment)?.name || 'Department'} Roles`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">All {departments.find(d => d.id === selectedDepartment)?.name || 'Department'} Roles</SelectItem>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <span className="pill-text">Department</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Channel - only when department has channels */}
                  {selectedDepartment && channels.length > 0 && (
                    <Select value={selectedChannel || '__none__'} onValueChange={(v) => onSelectChannel(v === '__none__' ? null : v)} disabled={isLoading}>
                      <SelectTrigger className="context-select-trigger channel-select-trigger">
                        <SelectValue placeholder="Any channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Any channel</SelectItem>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Style - only when company has styles */}
                  {styles.length > 0 && (
                    <Select value={selectedStyle || '__none__'} onValueChange={(v) => onSelectStyle(v === '__none__' ? null : v)} disabled={isLoading}>
                      <SelectTrigger className="context-select-trigger style-select-trigger">
                        <SelectValue placeholder="Default style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Default style</SelectItem>
                        {styles.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
            </div>
          )}

          {/* Mode toggle - only show for follow-up messages (after first exchange) */}
          {conversation.messages.length > 0 && (
            <div className={`mode-toggle-bar ${isLoading ? 'disabled' : ''}`}>
              <span className="mode-label">Reply mode:</span>
              <div className="mode-buttons">
                <button
                  type="button"
                  className={`mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
                  onClick={() => !isLoading && setChatMode('chat')}
                  disabled={isLoading}
                  title="Quick follow-up with the Chairman (faster)"
                >
                  <span className="mode-btn-icon">💬</span>
                  Quick Chat
                </button>
                <button
                  type="button"
                  className={`mode-btn ${chatMode === 'council' ? 'active' : ''}`}
                  onClick={() => !isLoading && setChatMode('council')}
                  disabled={isLoading}
                  title="Full council deliberation with all 5 AI models"
                >
                  <span className="mode-btn-icon">👥</span>
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
                      {departments.find(d => d.id === selectedDepartment)?.name || 'Department'}
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
                    ? "Ask a question... (Enter to send, Shift+Enter for new line)"
                    : chatMode === 'chat'
                    ? "Quick follow-up with the Chairman..."
                    : "Send to the full council for deliberation..."
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
    </main>
  );
}
