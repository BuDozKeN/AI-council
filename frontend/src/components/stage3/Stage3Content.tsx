import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyButton } from '../ui/CopyButton';
import { CheckCircle2 } from 'lucide-react';

// Custom code block renderer with copy button
function CodeBlock({ children, className }) {
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  const isActualCodeBlock = language || code.includes('\n') || code.length > 60;

  if (!isActualCodeBlock) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block-wrapper">
      {language && <span className="code-language">{language}</span>}
      <CopyButton text={code} size="sm" position="absolute" />
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * Stage3Content - Renders the markdown content and header row
 */
function Stage3Content({
  displayText,
  hasError,
  isStreaming,
  isComplete,
  chairmanIconPath,
}) {
  return (
    <>
      {/* Header row: Chairman LLM icon + status + copy button */}
      <div className="stage3-header-row">
        <div className="chairman-indicator">
          {chairmanIconPath && (
            <img src={chairmanIconPath} alt="" className="chairman-icon" />
          )}
          {isStreaming && <span className="typing-indicator">●</span>}
          {isComplete && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {hasError && <span className="error-badge">Error</span>}
        </div>
      </div>

      {/* Content wrapper */}
      <div className="final-content-wrapper">
        <div className={`final-text ${hasError ? 'error-text' : ''}`}>
          {hasError ? (
            <p className="empty-message">{displayText || 'An error occurred while generating the synthesis.'}</p>
          ) : (
            <>
              <article className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:my-1 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-700 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre({ children: _children, node }) {
                      const codeElement = node?.children?.[0];
                      const className = codeElement?.properties?.className?.[0] || '';
                      const codeContent = codeElement?.children?.[0]?.value || '';
                      return <CodeBlock className={className}>{codeContent}</CodeBlock>;
                    },
                    code({ node: _node, className, children, ...props }) {
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
              {isStreaming && <span className="cursor">▊</span>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(Stage3Content);
