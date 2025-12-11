import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import './Stage3.css';

// Copy button component
function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button className="copy-btn" onClick={handleCopy} title={label}>
      {copied ? (
        <span className="copy-icon">✓</span>
      ) : (
        <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

// Custom code block renderer with copy button
// Only shows header with copy button for actual code blocks (multi-line or has language)
function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  // Only show header with copy button for actual code blocks:
  // - Has a language specified, OR
  // - Has multiple lines, OR
  // - Is longer than 60 characters
  const isActualCodeBlock = language || code.includes('\n') || code.length > 60;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // For short single-line code without language, render as inline code (not a block)
  if (!isActualCodeBlock) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block-wrapper">
      {language && <span className="code-language">{language}</span>}
      <button className="copy-code-btn" onClick={handleCopy} title="Copy code">
        {copied ? (
          <span className="copy-icon">✓</span>
        ) : (
          <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        )}
      </button>
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function Stage3({
  finalResponse,
  streaming,
  isLoading,
  companyId,
  departmentId,
  conversationId,
  conversationTitle,
  userQuestion,  // The original user question that led to this response
  defaultCollapsed = false,
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [savedCount, setSavedCount] = useState(0);

  // Save as Decision - simple inline save
  const handleSaveDecision = async () => {
    if (!companyId || saveState === 'saving') return;

    setSaveState('saving');
    try {
      // Generate a title from the conversation or first line of response
      const title = conversationTitle ||
        (displayText.split('\n')[0].slice(0, 100)) ||
        'Council Decision';

      await api.createCompanyDecision(companyId, {
        title: title,
        content: displayText,
        department_id: departmentId || null,
        source_conversation_id: conversationId?.startsWith('temp-') ? null : conversationId,
        tags: []
      });

      setSaveState('saved');
      setSavedCount(prev => prev + 1);

      // Reset to allow saving again after 3 seconds
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err) {
      console.error('Failed to save decision:', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  // Determine what to display
  const displayText = finalResponse?.response || streaming?.text || '';
  const isStreaming = streaming && !streaming.complete;
  const hasError = streaming?.error;
  const chairmanModel = finalResponse?.model || streaming?.model || 'google/gemini-3-pro-preview';
  const shortModelName = chairmanModel.split('/')[1] || chairmanModel;
  const isComplete = !isStreaming && !hasError && displayText;

  const toggleCollapsed = () => {
    setUserToggled(true);
    setIsCollapsed(!isCollapsed);
  };

  // Show thinking state if stage3 is loading but no streaming data yet
  if (!displayText && isLoading) {
    return (
      <div className="stage stage3">
        <h3 className="stage-title">
          Stage 3: Final Council Answer
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>
        <div className="final-response">
          <div className="chairman-label">
            Chairman: {shortModelName}
            <span className="thinking-badge">Thinking<span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span></span>
          </div>
          <div className="thinking-container">
            <div className="thinking-message">
              <span className="thinking-icon">🧠</span>
              <span>Analyzing all council responses and peer rankings to synthesize the final answer...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!displayText && !isLoading) {
    return null;
  }

  // Get button text based on save state
  const getSaveButtonText = () => {
    switch (saveState) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved!';
      case 'error': return 'Failed - Try Again';
      default: return savedCount > 0 ? `Save as Decision (${savedCount} saved)` : 'Save as Decision';
    }
  };

  return (
    <div className={`stage stage3 ${isCollapsed ? 'collapsed' : ''}`}>
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        Stage 3: Final Council Answer
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        {isCollapsed && savedCount > 0 && (
          <span className="collapsed-summary">
            <span className="kb-saved-badge">{savedCount} saved</span>
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <div className="final-response">
          {/* Sticky copy button - always visible */}
          {isComplete && (
            <div className="sticky-copy-btn">
              <CopyButton text={displayText} label="Copy full response" />
            </div>
          )}
          <div className="chairman-label">
            <span className="chairman-info">
              Chairman: {shortModelName}
              {isStreaming && <span className="typing-indicator">●</span>}
              {isComplete && <span className="complete-badge">Complete</span>}
              {hasError && <span className="error-badge">Error</span>}
            </span>
          </div>
        <div className={`final-text markdown-content ${hasError ? 'error-text' : ''}`}>
          {hasError ? (
            <p className="empty-message">{displayText || 'An error occurred while generating the synthesis.'}</p>
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    if (inline) {
                      return <code className={className} {...props}>{children}</code>;
                    }
                    return <CodeBlock className={className}>{children}</CodeBlock>;
                  }
                }}
              >
                {displayText}
              </ReactMarkdown>
              {isStreaming && <span className="cursor">▊</span>}
            </>
          )}
        </div>
        {isComplete && companyId && (
          <div className="stage3-actions">
            <button
              className={`save-knowledge-btn ${saveState === 'saved' ? 'saved' : ''} ${saveState === 'error' ? 'error' : ''}`}
              onClick={handleSaveDecision}
              disabled={saveState === 'saving'}
              title="Save this council output to My Company → Decisions"
            >
              <span className="btn-icon">{saveState === 'saved' ? '✓' : '💾'}</span>
              {getSaveButtonText()}
            </button>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
