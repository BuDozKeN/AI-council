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
import { motion, AnimatePresence, Variants } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Stage1 from '../Stage1';
import Stage2 from '../Stage2';
import Stage3 from '../stage3';
import type { Project } from '../../types/business';
import type { Conversation, StreamingState } from '../../types/conversation';
import type { AggregateRanking } from '../../types/stages';

interface MessageMetadata {
  aggregate_rankings?: AggregateRanking[];
  label_to_model?: Record<string, string>;
}

interface LoadingState {
  stage1?: boolean;
  stage2?: boolean;
  stage3?: boolean;
}

interface Stage1ResponseItem {
  model: string;
  response: string;
}

interface Stage2RankingItem {
  model: string;
  ranking: string;
  parsed_ranking?: string[];
}

interface Stage3Response {
  response?: string;
  content?: string;
  model?: string;
}

interface Stage3StreamingState {
  text?: string;
  complete?: boolean;
  error?: boolean;
  model?: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content?: string;
  isChat?: boolean;
  loading?: LoadingState;
  stopped?: boolean;
  stage1?: Stage1ResponseItem[];
  stage1Streaming?: Record<string, StreamingState>;
  stage2?: Stage2RankingItem[];
  stage2Streaming?: Record<string, StreamingState>;
  stage3?: Stage3Response;
  stage3Streaming?: Stage3StreamingState;
  metadata?: MessageMetadata;
  aggregate_rankings?: AggregateRanking[];
  label_to_model?: Record<string, string>;
  imageAnalysis?: string;
}

interface CouncilStagesProps {
  msg: Message;
  conversation: Conversation | null | undefined;
}

interface MessageListProps {
  messages?: Message[] | undefined;
  conversation?: Conversation | null | undefined;
  selectedBusiness?: string | undefined;
  selectedDepartment?: string | undefined;
  selectedProject?: string | null | undefined;
  projects?: Project[] | undefined;
  onSelectProject?: ((projectId: string | null) => void) | undefined;
  onOpenProjectModal?: (() => void) | undefined;
  onProjectCreated?: ((project: Project) => void) | undefined;
  onViewDecision?: ((decisionId: string | null, viewType?: string, contextId?: string) => void) | undefined;
}

/**
 * CouncilStages - Wrapper that connects Stage1 and Stage2 with shared expanded model state
 * When user clicks a ranking in Stage2, it expands the corresponding card in Stage1
 */
function CouncilStages({ msg, conversation }: CouncilStagesProps) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const handleRankingClick = (model: string) => {
    setExpandedModel(model);
  };

  // Get aggregate rankings for showing rank badges in Stage1
  const aggregateRankings = msg.metadata?.aggregate_rankings ?? msg.aggregate_rankings;

  // Determine if stage is complete
  const isStageComplete = Boolean(msg.stage3) && !msg.loading?.stage3;

  return (
    <>
      {/* Stage 1 - show with streaming or final responses */}
      {(msg.loading?.stage1 || msg.stage1 || (msg.stage1Streaming && Object.keys(msg.stage1Streaming).length > 0)) && (
        <Stage1
          {...(msg.stage1 ? { responses: msg.stage1 } : {})}
          {...(msg.stage1Streaming ? { streaming: msg.stage1Streaming } : {})}
          isLoading={msg.loading?.stage1 ?? false}
          {...(msg.stopped !== undefined ? { stopped: msg.stopped } : {})}
          isComplete={isStageComplete}
          {...(conversation?.title ? { conversationTitle: conversation.title } : {})}
          {...(msg.imageAnalysis ? { imageAnalysis: msg.imageAnalysis } : {})}
          expandedModel={expandedModel}
          onExpandedModelChange={setExpandedModel}
          {...(aggregateRankings ? { aggregateRankings } : {})}
        />
      )}

      {/* Stage 2 - show with streaming or final rankings */}
      {(msg.loading?.stage2 || msg.stage2 || (msg.stage2Streaming && Object.keys(msg.stage2Streaming).length > 0)) && (() => {
        const labelToModel = msg.metadata?.label_to_model ?? msg.label_to_model;
        const stage2Rankings = msg.metadata?.aggregate_rankings ?? msg.aggregate_rankings;
        return (
          <Stage2
            {...(msg.stage2 ? { rankings: msg.stage2 } : {})}
            {...(msg.stage2Streaming ? { streaming: msg.stage2Streaming } : {})}
            {...(labelToModel ? { labelToModel } : {})}
            {...(stage2Rankings ? { aggregateRankings: stage2Rankings } : {})}
            isLoading={msg.loading?.stage2 ?? false}
            isComplete={isStageComplete}
            {...(conversation?.title ? { conversationTitle: conversation.title } : {})}
            onModelClick={handleRankingClick}
          />
        );
      })()}
    </>
  );
}

// Spring animation config for message bubbles
const messageVariants: Variants = {
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
  // onProjectCreated is kept in props interface for future use
  onViewDecision
}: MessageListProps) {
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content ?? ''}</ReactMarkdown>
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
                  {(msg.loading?.stage3 || msg.stage3 || msg.stage3Streaming) && (() => {
                    // Get the user message that immediately preceded THIS specific response
                    let userQuestion = '';
                    for (let i = index - 1; i >= 0; i--) {
                      const prevMsg = messages[i];
                      if (prevMsg?.role === 'user') {
                        userQuestion = prevMsg.content ?? '';
                        break;
                      }
                    }
                    return (
                      <Stage3
                        finalResponse={msg.stage3 ?? null}
                        streaming={msg.stage3Streaming ?? null}
                        isLoading={msg.loading?.stage3 ?? false}
                        companyId={selectedBusiness ?? null}
                        departmentId={selectedDepartment ?? null}
                        conversationId={conversation?.id ?? null}
                        conversationTitle={conversation?.title ?? null}
                        responseIndex={index}
                        userQuestion={userQuestion}
                        {...(projects.length > 0 ? { projects } : {})}
                        {...(selectedProject !== undefined ? { currentProjectId: selectedProject } : {})}
                        {...(onSelectProject ? { onSelectProject } : {})}
                        {...(onOpenProjectModal ? { onCreateProject: onOpenProjectModal } : {})}
                        {...(onViewDecision ? { onViewDecision } : {})}
                      />
                    );
                  })()}
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
