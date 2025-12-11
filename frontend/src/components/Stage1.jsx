import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Stage1.css';

// Copy button component
function CopyButton({ text }) {
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
    <button className="copy-btn" onClick={handleCopy} title="Copy response">
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

  // Only show header with copy button for actual code blocks
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

export default function Stage1({ responses, streaming, isLoading, stopped, isComplete, defaultCollapsed = false, conversationTitle, imageAnalysis }) {
  const [activeTab, setActiveTab] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Build display data from either streaming or final responses
  const displayData = [];

  if (streaming && Object.keys(streaming).length > 0) {
    // Use streaming data
    Object.entries(streaming).forEach(([model, data]) => {
      // If stopped, models that weren't complete become "stopped" not "streaming"
      const wasStopped = stopped && !data.complete;
      displayData.push({
        model,
        response: data.text,
        isStreaming: !data.complete && !stopped, // Only streaming if not stopped
        isComplete: data.complete && !data.error,
        hasError: data.error,
        isEmpty: data.complete && !data.text && !data.error,
        isStopped: wasStopped, // New: mark as stopped
      });
    });
  } else if (responses && responses.length > 0) {
    // Use final responses
    responses.forEach((resp) => {
      displayData.push({
        model: resp.model,
        response: resp.response,
        isStreaming: false,
        isComplete: true,
        hasError: false,
        isEmpty: !resp.response,
        isStopped: false,
      });
    });
  }

  // Check if all models are complete (for collapsible state)
  const allComplete = displayData.length > 0 && displayData.every(d => d.isComplete || d.isStopped || d.hasError);

  // Auto-select first tab with content
  useEffect(() => {
    if (displayData.length > 0 && activeTab >= displayData.length) {
      setActiveTab(0);
    }
  }, [displayData.length, activeTab]);

  // Track if user has manually toggled
  const [userToggled, setUserToggled] = useState(false);

  // Auto-collapse when complete (only if user hasn't manually toggled)
  // IMPORTANT: This hook must be before any early returns to maintain consistent hook order
  useEffect(() => {
    if (isComplete && allComplete && !isCollapsed && !userToggled) {
      setIsCollapsed(true);
    }
  }, [isComplete, allComplete, isCollapsed, userToggled]);

  if (displayData.length === 0 && !isLoading) {
    return null;
  }

  // Show loading state if stage1 is loading but no streaming data yet
  if (displayData.length === 0 && isLoading) {
    return (
      <div className="stage stage1">
        <h3 className="stage-title">
          Stage 1: Individual Responses
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>

        {/* Show image analysis even during loading state */}
        {imageAnalysis && (
          <div className="image-analysis-section">
            <details className="image-analysis-details" open>
              <summary className="image-analysis-summary">
                <span className="image-icon">🖼️</span>
                Image Analysis by GPT-4o
                <span className="expand-hint">(click to collapse)</span>
              </summary>
              <div className="image-analysis-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {imageAnalysis}
                </ReactMarkdown>
              </div>
            </details>
          </div>
        )}

        <div className="stage-loading">
          <div className="loading-spinner"></div>
          <span>Waiting for models to respond...</span>
        </div>
      </div>
    );
  }

  const activeData = displayData[activeTab] || displayData[0];

  const toggleCollapsed = () => {
    setUserToggled(true);
    setIsCollapsed(!isCollapsed);
  };

  // Summary for collapsed state
  const completedCount = displayData.filter(d => d.isComplete && !d.isEmpty).length;
  const totalCount = displayData.length;

  return (
    <div className={`stage stage1 ${isCollapsed ? 'collapsed' : ''}`}>
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        Stage 1: Individual Responses
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        {isCollapsed && (
          <span className="collapsed-summary">
            {completedCount}/{totalCount} models responded
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <>
          {/* Show image analysis if present */}
          {imageAnalysis && (
            <div className="image-analysis-section">
              <details className="image-analysis-details">
                <summary className="image-analysis-summary">
                  <span className="image-icon">🖼️</span>
                  Image Analysis by GPT-4o
                  <span className="expand-hint">(click to expand)</span>
                </summary>
                <div className="image-analysis-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {imageAnalysis}
                  </ReactMarkdown>
                </div>
              </details>
            </div>
          )}

          <div className="tabs">
            {displayData.map((data, index) => (
              <button
                key={data.model}
                className={`tab ${activeTab === index ? 'active' : ''} ${data.isStreaming ? 'streaming' : ''} ${data.hasError || data.isEmpty ? 'error' : ''} ${data.isComplete && !data.isEmpty ? 'complete' : ''} ${data.isStopped ? 'stopped' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                {data.isStreaming && <span className="status-icon streaming-dot" title="Generating..."></span>}
                {data.isStopped && <span className="status-icon stopped-icon" title="Stopped">■</span>}
                {data.isComplete && !data.isEmpty && <span className="status-icon complete-icon" title="Complete">✓</span>}
                {(data.hasError || data.isEmpty) && <span className="status-icon error-icon" title={data.hasError ? 'Error' : 'No response'}>⚠</span>}
                {data.model.split('/')[1] || data.model}
              </button>
            ))}
          </div>

          <div className="tab-content">
            <div className="model-name">
              <span className="model-info">
                {activeData.model}
                {activeData.isStreaming && <span className="typing-indicator">●</span>}
                {activeData.isStopped && <span className="stopped-badge">Stopped</span>}
                {activeData.isComplete && !activeData.isEmpty && <span className="complete-badge">Complete</span>}
                {activeData.isEmpty && <span className="error-badge">No Response</span>}
                {activeData.hasError && <span className="error-badge">Error</span>}
              </span>
              {activeData.isComplete && !activeData.isEmpty && activeData.response && (
                <CopyButton text={activeData.response} />
              )}
            </div>
            <div className={`response-text markdown-content ${activeData.hasError || activeData.isEmpty ? 'error-text' : ''}`}>
              {activeData.isEmpty ? (
                <p className="empty-message">This model did not return a response.</p>
              ) : activeData.hasError ? (
                <p className="empty-message">{activeData.response || 'An error occurred while generating the response.'}</p>
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
                    {activeData.response || ''}
                  </ReactMarkdown>
                  {activeData.isStreaming && <span className="cursor">▊</span>}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
