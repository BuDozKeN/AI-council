import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Spinner } from './ui/Spinner';
import { CopyButton } from './ui/CopyButton';
import { Activity, CheckCircle2, AlertCircle, StopCircle, ChevronDown, X, Check } from 'lucide-react';
import { getModelPersona } from '../config/modelPersonas';
import { hapticLight } from '../lib/haptics';
import './Stage1.css';

// Map provider to icon file path
const PROVIDER_ICON_PATH = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  xai: '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
};

// Get icon path for a model - with fallback pattern matching
function getModelIconPath(modelId) {
  if (!modelId) return null;

  const persona = getModelPersona(modelId);
  if (persona.provider && PROVIDER_ICON_PATH[persona.provider]) {
    return PROVIDER_ICON_PATH[persona.provider];
  }

  // Fallback: match common model name patterns
  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('gpt') || lowerModel.includes('o1')) return '/icons/openai.svg';
  if (lowerModel.includes('claude') || lowerModel.includes('opus') || lowerModel.includes('sonnet') || lowerModel.includes('haiku')) return '/icons/anthropic.svg';
  if (lowerModel.includes('gemini')) return '/icons/gemini.svg';
  if (lowerModel.includes('grok')) return '/icons/grok.svg';
  if (lowerModel.includes('deepseek')) return '/icons/deepseek.svg';

  return null;
}

// Strip markdown formatting for clean preview text
function stripMarkdown(text) {
  if (!text) return '';

  return text
    // Remove headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic *text* or _text_
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks ```code```
    .replace(/```[\s\S]*?```/g, '')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove blockquotes >
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules ---
    .replace(/^-{3,}$/gm, '')
    // Remove bullet points - or * at start
    .replace(/^[-*]\s+/gm, '')
    // Remove numbered lists 1. 2. etc
    .replace(/^\d+\.\s+/gm, '')
    // Remove extra whitespace/newlines
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Custom code block renderer with copy button
function CodeBlock({ children, className }) {
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

// Individual model card in the grid - memoized to prevent re-renders when other cards update
const ModelCard = memo(function ModelCard({ data, isComplete: _isComplete, onExpand, isExpanded }) {
  const cardRef = useRef(null);
  const touchStartRef = useRef(null);

  // Get model persona and icon path
  const persona = getModelPersona(data.model);
  const iconPath = getModelIconPath(data.model);
  const modelColor = persona.color;
  // Display friendly brand name, show specific model on hover
  const displayName = persona.providerLabel || persona.shortName;
  const tooltipName = persona.fullName;

  // Clean preview text - strip markdown and truncate
  const cleanText = stripMarkdown(data.response || '');
  const previewText = cleanText.slice(0, 200);
  const hasMore = cleanText.length > 200;

  // Scroll into view when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [isExpanded]);

  // Swipe-to-dismiss for expanded cards on mobile
  const handleTouchStart = useCallback((e) => {
    if (!isExpanded) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, [isExpanded]);

  const handleTouchEnd = useCallback((e) => {
    if (!isExpanded || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Swipe down to dismiss (>80px, mostly vertical, <400ms)
    if (deltaY > 80 && deltaY > deltaX && deltaTime < 400) {
      e.stopPropagation();
      onExpand(null);
    }
    touchStartRef.current = null;
  }, [isExpanded, onExpand]);

  // Build CSS class list
  const cardClasses = [
    'model-card',
    data.isStreaming && 'streaming',
    (data.hasError || data.isEmpty) && 'error',
    isExpanded && 'expanded',
  ].filter(Boolean).join(' ');

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpand(isExpanded ? null : data.model);
    }
    if (e.key === 'Escape' && isExpanded) {
      e.preventDefault();
      onExpand(null);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cardClasses}
      onClick={() => { hapticLight(); onExpand(isExpanded ? null : data.model); }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="article"
      aria-expanded={isExpanded}
      aria-label={`${displayName} response${data.isStreaming ? ', generating' : data.isComplete ? ', complete' : ''}`}
    >
      {/* Header */}
      <div className="model-card-header">
        <div className="model-card-header-left">
          {/* LLM Icon with status indicator */}
          <div className="llm-icon-wrapper" style={{ '--model-color': modelColor }} title={tooltipName}>
            {iconPath ? (
              <img src={iconPath} alt={displayName} className="llm-icon" loading="lazy" decoding="async" />
            ) : (
              <span className="llm-icon-fallback" style={{ background: modelColor }}>
                {displayName.charAt(0)}
              </span>
            )}
            {/* Status badge overlay */}
            {data.isStreaming && (
              <span className="llm-status-badge streaming">
                <span className="llm-status-ping"></span>
              </span>
            )}
            {data.isComplete && !data.isEmpty && !data.isStreaming && (
              <span className="llm-status-badge complete">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
            {data.isStopped && (
              <span className="llm-status-badge stopped">
                <StopCircle size={8} />
              </span>
            )}
            {(data.hasError || data.isEmpty) && (
              <span className="llm-status-badge error">
                <AlertCircle size={8} />
              </span>
            )}
          </div>

          <span className="model-card-name" title={tooltipName}>{displayName}</span>
        </div>

        {/* Copy button (when expanded) + Expand/collapse */}
        <div className="model-card-header-right">
          {isExpanded && data.isComplete && !data.isEmpty && data.response && (
            <CopyButton text={data.response} size="sm" />
          )}
          {data.response && (
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                onExpand(isExpanded ? null : data.model);
              }}
              aria-label={isExpanded ? 'Collapse response' : 'Expand response'}
            >
              {isExpanded ? (
                <X className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Swipe indicator for mobile - only when expanded */}
        {isExpanded && (
          <div className="swipe-indicator" aria-hidden="true">
            <div className="swipe-handle" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`model-card-content ${isExpanded ? '' : 'truncated'}`}>
        {data.isEmpty ? (
          <p className="model-card-empty">No response</p>
        ) : data.hasError ? (
          <p className="model-card-error">{data.response || 'Error occurred'}</p>
        ) : isExpanded ? (
          // Full content when expanded
          <article className="prose prose-slate prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-700 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200">
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
              {data.response || ''}
            </ReactMarkdown>
          </article>
        ) : (
          // Preview text when collapsed
          <div className="model-card-preview">
            {previewText}
            {hasMore && <span className="text-slate-400">...</span>}
            {data.isStreaming && <span className="model-card-cursor" />}
          </div>
        )}
      </div>

    </motion.div>
  );
});

function Stage1({ responses, streaming, isLoading, stopped, isComplete, defaultCollapsed = false, conversationTitle, imageAnalysis }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedModel, setExpandedModel] = useState(null);

  // Build display data from either streaming or final responses
  const displayData = [];

  // Helper to detect if response text looks like an error message
  const textLooksLikeError = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('[error:') ||
           lower.includes('status 429') ||
           lower.includes('rate limit') ||
           lower.includes('api error') ||
           lower.includes('timeout') ||
           lower.includes('service unavailable');
  };

  if (streaming && Object.keys(streaming).length > 0) {
    Object.entries(streaming).forEach(([model, data]) => {
      const wasStopped = stopped && !data.complete;
      const hasTextError = textLooksLikeError(data.text);
      displayData.push({
        model,
        response: data.text,
        isStreaming: !data.complete && !stopped,
        isComplete: data.complete && !data.error && !hasTextError,
        hasError: data.error || hasTextError,
        isEmpty: data.complete && !data.text && !data.error,
        isStopped: wasStopped,
      });
    });
  } else if (responses && responses.length > 0) {
    responses.forEach((resp) => {
      const hasTextError = textLooksLikeError(resp.response);
      displayData.push({
        model: resp.model,
        response: resp.response,
        isStreaming: false,
        isComplete: !hasTextError,
        hasError: hasTextError,
        isEmpty: !resp.response,
        isStopped: false,
      });
    });
  }

  // Check if all models are complete
  const allComplete = displayData.length > 0 && displayData.every(d => d.isComplete || d.isStopped || d.hasError);
  const streamingCount = displayData.filter(d => d.isStreaming).length;

  // Track if user has manually toggled
  const [userToggled, setUserToggled] = useState(false);

  // Auto-collapse when complete (only if user hasn't manually toggled)
  // Deferred to avoid cascading renders warning
  useEffect(() => {
    if (isComplete && allComplete && !isCollapsed && !userToggled) {
      const timeoutId = setTimeout(() => setIsCollapsed(true), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isComplete, allComplete, isCollapsed, userToggled]);

  if (displayData.length === 0 && !isLoading) {
    return null;
  }

  // Show loading state if stage1 is loading but no streaming data yet
  if (displayData.length === 0 && isLoading) {
    return (
      <div className="stage stage1">
        <h3 className="stage-title flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
          <span className="font-semibold tracking-tight">Step 1: Gathering Expert Opinions</span>
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>

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
          <Spinner size="md" />
          <span>Your council is gathering their thoughts...</span>
        </div>
      </div>
    );
  }

  const toggleCollapsed = () => {
    setUserToggled(true);
    setIsCollapsed(!isCollapsed);
  };

  // Group models by provider for collapsed summary
  const providerGroups = displayData.reduce((acc, data) => {
    const persona = getModelPersona(data.model);
    const provider = persona.provider || 'other';
    if (!acc[provider]) {
      acc[provider] = {
        label: persona.providerLabel || provider.toUpperCase(),
        iconPath: getModelIconPath(data.model),
        models: [],
        allComplete: true,
        hasStreaming: false,
        hasError: false,
      };
    }
    acc[provider].models.push(data);
    if (data.isStreaming) acc[provider].hasStreaming = true;
    if (data.hasError || data.isEmpty) acc[provider].hasError = true;
    if (!data.isComplete || data.isEmpty) acc[provider].allComplete = false;
    return acc;
  }, {});

  return (
    <div className={`stage stage1 ${isCollapsed ? 'collapsed' : ''}`} data-stage="stage1">
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        {streamingCount > 0 ? (
          <Activity className="h-5 w-5 text-blue-500 animate-pulse flex-shrink-0" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        )}
        <span className="font-semibold tracking-tight">Step 1: Gathering Expert Opinions</span>
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
      </h3>

      {/* Collapsed model summary - provider pills */}
      {isCollapsed && displayData.length > 0 && (
        <div className="model-summary-pills">
          {Object.entries(providerGroups).map(([provider, group]) => (
            <span
              key={provider}
              className={`model-summary-pill ${group.allComplete ? 'complete' : ''} ${group.hasStreaming ? 'streaming' : ''} ${group.hasError ? 'error' : ''}`}
              title={group.hasError ? `${group.label} encountered an error` : group.allComplete ? `${group.label} completed` : `${group.label} in progress`}
            >
              {group.allComplete && !group.hasError && (
                <span className="pill-check">✓</span>
              )}
              {group.hasError && (
                <span className="pill-error">✕</span>
              )}
              {group.iconPath && (
                <img src={group.iconPath} alt="" className="pill-icon" loading="lazy" decoding="async" />
              )}
              <span className="pill-label">{group.label}</span>
            </span>
          ))}
        </div>
      )}

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

          {/* Living Feed Grid - shows all models simultaneously */}
          <div className="model-grid">
            <AnimatePresence mode="popLayout">
              {displayData.map((data) => (
                <ModelCard
                  key={data.model}
                  data={data}
                  isComplete={isComplete}
                  isExpanded={expandedModel === data.model}
                  onExpand={setExpandedModel}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes but Stage1 props don't
export default memo(Stage1);
