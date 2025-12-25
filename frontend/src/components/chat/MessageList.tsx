/**
 * MessageList - Renders user/assistant messages with stages
 *
 * Handles rendering of the message history including Stage1, Stage2, Stage3
 * components for council responses and chat-only responses.
 * Extracted from ChatInterface.jsx for better maintainability.
 *
 * Uses framer-motion spring animations for smooth message appearance.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Stage1 from '../Stage1';
import Stage2 from '../Stage2';
import Stage3 from '../stage3';

/**
 * CouncilStages - Wrapper that connects Stage1 and Stage2 with shared expanded model state
 * When user clicks a ranking in Stage2, it expands the corresponding card in Stage1
 */
function CouncilStages({ msg, conversation }) {
  const [expandedModel, setExpandedModel] = useState(null);

  const handleRankingClick = (model) => {
    setExpandedModel(model);
  };

  // Get aggregate rankings for showing rank badges in Stage1
  const aggregateRankings = msg.metadata?.aggregate_rankings || msg.aggregate_rankings;

  return (
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
          expandedModel={expandedModel}
          onExpandedModelChange={setExpandedModel}
          aggregateRankings={aggregateRankings}
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
          onModelClick={handleRankingClick}
        />
      )}
    </>
  );
}

// Spring animation config for message bubbles
const messageVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

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
    <AnimatePresence mode="popLayout">
      {messages.map((msg, index) => (
        <motion.div
          key={msg.id || `msg-${index}-${msg.role}`}
          className="message-group"
          variants={messageVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          layout
        >
          {msg.role === 'user' ? (
            <motion.div
              className="user-message"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            >
              <div className="message-label">You</div>
              <div className="message-content">
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="assistant-message"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35, delay: 0.05 }}
            >
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
                  {/* Stage 1 & 2 - wrapped together for click-to-navigate from rankings */}
                  <CouncilStages msg={msg} conversation={conversation} />

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
            </motion.div>
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
