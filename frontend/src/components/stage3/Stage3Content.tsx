import { memo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { CopyButton } from '../ui/CopyButton';
import { CheckCircle2 } from 'lucide-react';
import { hapticSuccess } from '../../lib/haptics';
import { CELEBRATION } from '../../lib/animation-constants';
import type { Stage3ContentProps, CodeBlockProps } from '../../types/stages';
// Import shared prose styling for consistent rendering with playbooks/SOPs
import '../MarkdownViewer.css';

// Custom code block renderer with hover-reveal copy button
function CodeBlock({ children, className }: CodeBlockProps) {
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
 * Stage3Content - Renders the markdown content and header row
 *
 * Note: Uses custom celebration logic instead of useCelebration hook
 * because it has a multi-stage animation (cursor fade -> celebration).
 */
function Stage3Content({
  displayText,
  hasError,
  isStreaming,
  isComplete,
  chairmanIconPath,
}: Stage3ContentProps) {
  // Track completion celebration
  const [showCompleteCelebration, setShowCompleteCelebration] = useState(false);
  const [cursorFading, setCursorFading] = useState(false);
  const wasStreamingRef = useRef(false);
  const hasCelebratedRef = useRef(false);

  // Trigger celebration when streaming completes (only once per session)
  // Multi-stage: cursor fades out first, then celebration triggers
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && isComplete && displayText && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      // Fade out cursor first
      setCursorFading(true);

      // Then trigger celebration after cursor fades
      const celebrationTimer = setTimeout(() => {
        setShowCompleteCelebration(true);
        hapticSuccess();
      }, CELEBRATION.CURSOR_FADE);

      // Reset celebration after animation
      const resetTimer = setTimeout(() => {
        setShowCompleteCelebration(false);
      }, CELEBRATION.COUNCIL_COMPLETE);

      return () => {
        clearTimeout(celebrationTimer);
        clearTimeout(resetTimer);
      };
    }
    wasStreamingRef.current = isStreaming;
    return undefined;
  }, [isStreaming, isComplete, displayText]);

  return (
    <>
      {/* Header row: Chairman LLM icon + status + copy button */}
      <div className="stage3-header-row">
        <div className={`chairman-indicator ${showCompleteCelebration ? 'celebrating' : ''}`}>
          {chairmanIconPath && (
            <img src={chairmanIconPath} alt="" className="chairman-icon" loading="lazy" decoding="async" />
          )}
          {isStreaming && <span className="typing-indicator">●</span>}
          {isComplete && (
            <CheckCircle2
              className={`h-4 w-4 text-green-600 ${showCompleteCelebration ? 'animate-success-pop' : ''}`}
            />
          )}
          {hasError && <span className="error-badge">Error</span>}
        </div>
      </div>

      {/* Content wrapper */}
      <div className={`final-content-wrapper ${showCompleteCelebration ? 'complete-glow' : ''}`}>
        <div className={`final-text ${hasError ? 'error-text' : ''}`}>
          {hasError ? (
            <p className="empty-message">{displayText || 'An error occurred while generating the synthesis.'}</p>
          ) : (
            <>
              <article className="prose prose-slate max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSlug]}
                  components={{
                    pre({ children: _children, node }) {
                      const codeElement = node?.children?.[0] as { properties?: { className?: string[] }; children?: { value?: string }[] } | undefined;
                      const className = codeElement?.properties?.className?.[0] || '';
                      const codeContent = codeElement?.children?.[0]?.value || '';
                      return <CodeBlock className={className}>{codeContent}</CodeBlock>;
                    },
                    code({ className, children, ...props }) {
                      return <code className={className} {...props}>{children}</code>;
                    },
                    table({ children, ...props }) {
                      return (
                        <div className="table-scroll-wrapper">
                          <table {...props}>{children}</table>
                        </div>
                      );
                    }
                  }}
                >
                  {displayText}
                </ReactMarkdown>
              </article>
              {isStreaming && <span className={`cursor ${cursorFading ? 'animate-cursor-fade' : ''}`}>▊</span>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(Stage3Content);
