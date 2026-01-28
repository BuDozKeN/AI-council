/**
 * MessageList - Renders user/assistant messages with stages
 *
 * Handles rendering of the message history including Stage1, Stage2, Stage3
 * components for council responses and chat-only responses.
 * Extracted from ChatInterface.jsx for better maintainability.
 *
 * Uses framer-motion spring animations for smooth message appearance.
 */

import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import ReactMarkdown, { ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { ChevronDown, ChevronRight } from 'lucide-react';
// Import prose styles for consistent markdown rendering (fixes streaming vs saved state mismatch)
import '../MarkdownViewer.css';
import { CouncilLoader } from '../ui/CouncilLoader';

// Performance: Lazy-load Stage components to split CSS into separate chunks
// This reduces initial ChatInterface bundle by ~69KB
const Stage1 = lazy(() => import('../Stage1'));
const Stage2 = lazy(() => import('../Stage2'));
const Stage3 = lazy(() => import('../stage3'));
import { TokenUsageDisplay, type UsageData } from '../ui/TokenUsageDisplay';
import { CopyButton } from '../ui/CopyButton';
import { makeClickable } from '../../utils/a11y';
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
  usage?: UsageData;
}

interface CouncilStagesProps {
  msg: Message;
  conversation: Conversation | null | undefined;
}

interface CreateProjectContext {
  userQuestion: string;
  councilResponse: string;
  departmentIds: string[];
}

interface MessageListProps {
  messages?: Message[] | undefined;
  conversation?: Conversation | null | undefined;
  selectedBusiness?: string | undefined;
  selectedDepartment?: string | undefined;
  selectedProject?: string | null | undefined;
  projects?: Project[] | undefined;
  onSelectProject?: ((projectId: string | null) => void) | undefined;
  onOpenProjectModal?: ((context?: CreateProjectContext) => void) | undefined;
  onProjectCreated?: ((project: Project) => void) | undefined;
  onViewDecision?:
    | ((decisionId: string | null, viewType?: string, contextId?: string) => void)
    | undefined;
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
      {/* Stage 1 - show with streaming or final responses (collapsed by default) */}
      {(msg.loading?.stage1 ||
        msg.stage1 ||
        (msg.stage1Streaming && Object.keys(msg.stage1Streaming).length > 0)) && (
        <Suspense fallback={<CouncilLoader text="Loading stage..." />}>
          <Stage1
            {...(msg.stage1 ? { responses: msg.stage1 } : {})}
            {...(msg.stage1Streaming ? { streaming: msg.stage1Streaming } : {})}
            isLoading={msg.loading?.stage1 ?? false}
            {...(msg.stopped !== undefined ? { stopped: msg.stopped } : {})}
            isComplete={isStageComplete}
            defaultCollapsed={true}
            {...(conversation?.title ? { conversationTitle: conversation.title } : {})}
            {...(msg.imageAnalysis ? { imageAnalysis: msg.imageAnalysis } : {})}
            expandedModel={expandedModel}
            onExpandedModelChange={setExpandedModel}
            {...(aggregateRankings ? { aggregateRankings } : {})}
          />
        </Suspense>
      )}

      {/* Stage 2 - show with streaming or final rankings */}
      {(msg.loading?.stage2 ||
        msg.stage2 ||
        (msg.stage2Streaming && Object.keys(msg.stage2Streaming).length > 0)) &&
        (() => {
          const labelToModel = msg.metadata?.label_to_model ?? msg.label_to_model;
          const stage2Rankings = msg.metadata?.aggregate_rankings ?? msg.aggregate_rankings;
          return (
            <Suspense fallback={<CouncilLoader text="Loading stage..." />}>
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
            </Suspense>
          );
        })()}
    </>
  );
}

/**
 * CodeBlock - Custom code block renderer with copy button
 * Matches Stage3Content styling for consistent markdown rendering
 */
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  const isActualCodeBlock = language || code.includes('\n') || code.length > 60;

  if (!isActualCodeBlock) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block-wrapper copyable">
      {language && <span className="code-language">{language}</span>}
      <CopyButton text={code} size="sm" />
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * UserMessage - Collapsible user message for archival reference
 * Shows the original question asked, collapsed by default
 * Important for reviewing past conversations
 */
function UserMessage({ content }: { content: string }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Truncate content for collapsed preview (first 120 chars)
  const previewText = content.length > 120 ? content.substring(0, 120).trim() + '...' : content;

  return (
    <div className="user-message-wrapper">
      <div className="message-label">You</div>
      <motion.div
        className="stage stage-user copyable"
        data-stage="user"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Sticky copy button - stays visible when scrolling long content */}
        <CopyButton text={content} size="sm" className="user-copy-btn no-touch-target" />

        <div className="user-collapse-row" {...makeClickable(() => setIsCollapsed(!isCollapsed))}>
          {isCollapsed ? (
            <ChevronRight size={16} className="collapse-arrow" aria-hidden="true" />
          ) : (
            <ChevronDown size={16} className="collapse-arrow" aria-hidden="true" />
          )}
          {/* Collapsed preview */}
          {isCollapsed && <span className="user-preview-inline">{previewText}</span>}
        </div>

        {/* Expanded content - no extra wrapper box */}
        {!isCollapsed && (
          <div
            className="markdown-content user-expanded"
            {...makeClickable(() => setIsCollapsed(true))}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Spring animation config for message bubbles
// Reduced y offset and scale to minimize jitter on follow-up messages
const messageVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 35,
      mass: 0.6,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.1 },
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
  onViewDecision,
}: MessageListProps) {
  return (
    <AnimatePresence mode="sync">
      {messages.map((msg, index) => (
        <motion.div
          key={msg.id || `msg-${index}-${msg.role}`}
          className="message-group"
          variants={messageVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {msg.role === 'user' ? (
            <UserMessage content={msg.content ?? ''} />
          ) : (
            <motion.div
              className="assistant-message"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            >
              <div className="message-label">
                {msg.isChat ? (
                  'AI Advisor'
                ) : (
                  <span className="axcouncil-wordmark">
                    <img src="/favicon.svg" alt="" className="axcouncil-icon" />
                    <span>AxCouncil</span>
                  </span>
                )}
              </div>

              {/* For chat-only messages, show a simpler response */}
              {msg.isChat ? (
                /* Chat-only response - uses same prose styling as Stage3 for consistency */
                <div
                  className="chat-response"
                  aria-busy={msg.loading?.stage3 || !!msg.stage3Streaming}
                  aria-live="polite"
                >
                  <div className="chat-label">Response</div>
                  {msg.stage3Streaming ? (
                    <article
                      className="prose prose-slate max-w-none dark:prose-invert"
                      aria-label="Streaming response"
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSlug]}
                        components={{
                          pre(
                            props: React.ClassAttributes<HTMLPreElement> &
                              React.HTMLAttributes<HTMLPreElement> &
                              ExtraProps
                          ) {
                            const { node } = props;
                            const codeElement = node?.children?.[0] as
                              | {
                                  properties?: { className?: string[] };
                                  children?: Array<{ value?: string }>;
                                }
                              | undefined;
                            const className = codeElement?.properties?.className?.[0] || '';
                            const codeContent = codeElement?.children?.[0]?.value || '';
                            return <CodeBlock className={className}>{codeContent}</CodeBlock>;
                          },
                          code({
                            className,
                            children,
                            ...props
                          }: React.ComponentPropsWithoutRef<'code'>) {
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                          table({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) {
                            return (
                              <div className="table-scroll-wrapper">
                                <table {...props}>{children}</table>
                              </div>
                            );
                          },
                        }}
                      >
                        {msg.stage3Streaming.text || ''}
                      </ReactMarkdown>
                      {msg.loading?.stage3 && <span className="cursor-blink">|</span>}
                    </article>
                  ) : msg.stage3 ? (
                    <article className="prose prose-slate max-w-none dark:prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSlug]}
                        components={{
                          pre(
                            props: React.ClassAttributes<HTMLPreElement> &
                              React.HTMLAttributes<HTMLPreElement> &
                              ExtraProps
                          ) {
                            const { node } = props;
                            const codeElement = node?.children?.[0] as
                              | {
                                  properties?: { className?: string[] };
                                  children?: Array<{ value?: string }>;
                                }
                              | undefined;
                            const className = codeElement?.properties?.className?.[0] || '';
                            const codeContent = codeElement?.children?.[0]?.value || '';
                            return <CodeBlock className={className}>{codeContent}</CodeBlock>;
                          },
                          code({
                            className,
                            children,
                            ...props
                          }: React.ComponentPropsWithoutRef<'code'>) {
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                          table({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) {
                            return (
                              <div className="table-scroll-wrapper">
                                <table {...props}>{children}</table>
                              </div>
                            );
                          },
                        }}
                      >
                        {msg.stage3.response || msg.stage3.content || ''}
                      </ReactMarkdown>
                    </article>
                  ) : null}
                </div>
              ) : (
                /* Full council response - show all 3 stages */
                <>
                  {/* Stage 1 & 2 - wrapped together for click-to-navigate from rankings */}
                  <CouncilStages msg={msg} conversation={conversation} />

                  {/* Stage 3 - show with streaming or final response */}
                  {(msg.loading?.stage3 || msg.stage3 || msg.stage3Streaming) &&
                    (() => {
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
                        <Suspense fallback={<CouncilLoader text="Loading stage..." />}>
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
                            {...(msg.usage ? { usage: msg.usage } : {})}
                            {...(projects.length > 0 ? { projects } : {})}
                            {...(selectedProject !== undefined
                              ? { currentProjectId: selectedProject }
                              : {})}
                            {...(onSelectProject ? { onSelectProject } : {})}
                            {...(onOpenProjectModal ? { onCreateProject: onOpenProjectModal } : {})}
                            {...(onViewDecision ? { onViewDecision } : {})}
                          />
                        </Suspense>
                      );
                    })()}

                  {/* Developer: Token Usage Display (only visible when enabled in settings) */}
                  {msg.usage && !msg.loading?.stage3 && (
                    <TokenUsageDisplay usage={msg.usage} stage="complete" />
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
