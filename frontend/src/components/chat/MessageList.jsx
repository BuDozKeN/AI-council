/**
 * MessageList - Renders user/assistant messages with stages
 *
 * Handles rendering of the message history including Stage1, Stage2, Stage3
 * components for council responses and chat-only responses.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Stage1 from '../Stage1';
import Stage2 from '../Stage2';
import Stage3 from '../Stage3';

export function MessageList({
  messages = [],
  conversation,
  selectedBusiness,
  selectedDepartment,
  selectedProject,
  projects = [],
  onSelectProject,
  onOpenProjectModal,
  onProjectCreated,
  onViewDecision
}) {
  return (
    <>
      {messages.map((msg, index) => (
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
                      responseIndex={index}
                      userQuestion={
                        // Get the user message that immediately preceded THIS specific response
                        (() => {
                          for (let i = index - 1; i >= 0; i--) {
                            if (messages[i]?.role === 'user') {
                              return messages[i].content;
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
      ))}
    </>
  );
}
