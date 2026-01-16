import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown, { ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Spinner } from './ui/Spinner';
import { CopyButton } from './ui/CopyButton';
import { Activity, AlertCircle, StopCircle, ChevronDown, X, Check } from 'lucide-react';
import { getModelPersona } from '../config/modelPersonas';
import { hapticLight } from '../lib/haptics';
import { springs, interactionStates } from '../lib/animations';
import { useCompletionCelebration } from '../hooks/useCelebration';
import { CELEBRATION } from '../lib/animation-constants';
import { makeClickable } from '../utils/a11y';
import type {
  Provider,
  ProviderIconPaths,
  Stage1Props,
  Stage1DisplayData,
  ModelCardProps,
  ProviderGroup,
  CodeBlockProps,
  TouchStartData,
} from '../types/stages';
import './stage1/Stage1.css';

// Map provider to icon file path
const PROVIDER_ICON_PATH: ProviderIconPaths = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  xai: '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
  meta: '/icons/meta.svg',
  moonshot: '/icons/moonshot.svg',
};

// Get icon path for a model - with fallback pattern matching
function getModelIconPath(modelId: string): string | null {
  if (!modelId) return null;

  const persona = getModelPersona(modelId);
  if (persona.provider && PROVIDER_ICON_PATH[persona.provider as Provider]) {
    return PROVIDER_ICON_PATH[persona.provider as Provider];
  }

  // Fallback: match common model name patterns
  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes('gpt') || lowerModel.includes('o1')) return '/icons/openai.svg';
  if (
    lowerModel.includes('claude') ||
    lowerModel.includes('opus') ||
    lowerModel.includes('sonnet') ||
    lowerModel.includes('haiku')
  )
    return '/icons/anthropic.svg';
  if (lowerModel.includes('gemini')) return '/icons/gemini.svg';
  if (lowerModel.includes('grok')) return '/icons/grok.svg';
  if (lowerModel.includes('deepseek')) return '/icons/deepseek.svg';
  if (lowerModel.includes('llama') || lowerModel.includes('meta')) return '/icons/meta.svg';
  if (lowerModel.includes('kimi') || lowerModel.includes('moonshot')) return '/icons/moonshot.svg';

  return null;
}

// Strip markdown formatting for clean preview text
function stripMarkdown(text: string): string {
  if (!text) return '';

  let result = text
    // Remove code blocks first (before other processing) ```code```
    .replace(/```[\s\S]*?```/g, '')
    // Remove bold **text** or __text__ (use [\s\S] to match across newlines)
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    // Remove italic *text* or _text_ (single asterisk/underscore)
    // Be careful not to match list items or horizontal rules
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
    // Remove inline code `code`
    .replace(/`([^`]+)`/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove blockquotes >
    .replace(/^>\s*/gm, '')
    // Remove horizontal rules --- or ***
    .replace(/^[-*]{3,}$/gm, '')
    // Remove bullet points - or * at start of line
    .replace(/^[-*+]\s+/gm, '')
    // Remove numbered lists 1. 2. etc
    .replace(/^\d+\.\s+/gm, '');

  // Remove headers (# ## ### etc) - run multiple times to catch nested/consecutive headers
  // This handles cases like "# Title ## Subtitle" after newlines are collapsed
  for (let i = 0; i < 3; i++) {
    result = result.replace(/^#{1,6}\s+/gm, '').replace(/\s#{1,6}\s+/g, ' ');
  }

  return (
    result
      // Remove any remaining standalone asterisks or hash symbols
      .replace(/\*+/g, '')
      .replace(/(?<=\s)#+(?=\s|$)/g, '')
      // Remove extra whitespace/newlines
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Custom code block renderer with copy button
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

// Individual model card in the grid - memoized to prevent re-renders when other cards update
const ModelCard = memo(function ModelCard({
  data,
  isComplete: _isComplete,
  onExpand,
  isExpanded,
  rankData,
}: ModelCardProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchStartData | null>(null);

  // Get model persona and icon path
  const persona = getModelPersona(data.model);
  const iconPath = getModelIconPath(data.model);
  const modelColor = persona.color;
  // Display friendly brand name, show specific model on hover
  const displayName = persona.providerLabel || persona.shortName;
  const tooltipName = persona.fullName;

  // Rank display helper
  const getRankLabel = (position: number): string => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  };

  // Build informative tooltip for rank badge
  const getRankTooltip = () => {
    if (!rankData) return '';
    const { average_rank, rankings_count, totalVoters } = rankData;
    return t('stages.rankTooltip', {
      avg: average_rank.toFixed(1),
      votesReceived: rankings_count,
      totalVoters,
    });
  };

  // Clean preview text - strip markdown and truncate
  const cleanText = stripMarkdown(data.response || '');
  const previewText = cleanText.slice(0, 200);
  const hasMore = cleanText.length > 200;

  // Scroll into view when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [isExpanded]);

  // Swipe-to-dismiss for expanded cards on mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isExpanded) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    },
    [isExpanded]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isExpanded || !touchStartRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Swipe down to dismiss (>80px, mostly vertical, <400ms)
      if (deltaY > 80 && deltaY > deltaX && deltaTime < 400) {
        e.stopPropagation();
        onExpand(null);
      }
      touchStartRef.current = null;
    },
    [isExpanded, onExpand]
  );

  // Build CSS class list
  const cardClasses = [
    'model-card',
    data.isStreaming && 'streaming',
    (data.hasError || data.isEmpty) && 'error',
    isExpanded && 'expanded',
  ]
    .filter(Boolean)
    .join(' ');

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpand(isExpanded ? null : data.model);
    }
    if (e.key === 'Escape' && isExpanded) {
      e.preventDefault();
      onExpand(null);
    }
  };

  // Motion props - only apply hover/tap when not expanded
  const motionProps = !isExpanded
    ? {
        whileHover: interactionStates.cardHover,
        whileTap: interactionStates.cardTap,
      }
    : {};

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.smooth}
      {...motionProps}
      className={cardClasses}
      onClick={() => {
        hapticLight();
        onExpand(isExpanded ? null : data.model);
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="article"
      aria-label={`${displayName} response${data.isStreaming ? ', generating' : data.isComplete ? ', complete' : ''}`}
    >
      {/* Header */}
      <div className="model-card-header">
        <div className="model-card-header-left">
          {/* LLM Icon with status indicator */}
          <div
            className="llm-icon-wrapper"
            style={{ '--model-color': modelColor } as React.CSSProperties}
            title={tooltipName}
          >
            {iconPath ? (
              <img
                src={iconPath}
                alt={displayName}
                className="llm-icon"
                loading="lazy"
                decoding="async"
              />
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

          <span className="model-card-name" title={tooltipName}>
            {displayName}
          </span>

          {/* Rank badge - shows position after rankings are complete */}
          {rankData && (
            <span className={`model-card-rank rank-${rankData.position}`} title={getRankTooltip()}>
              {getRankLabel(rankData.position)}
            </span>
          )}
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
              {isExpanded ? <X className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
          <p className="model-card-empty">{t('stages.noResponse')}</p>
        ) : data.hasError ? (
          <p className="model-card-error">{data.response || t('stages.errorOccurred')}</p>
        ) : isExpanded ? (
          // Full content when expanded
          <article className="prose prose-slate prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-700 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
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
                code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
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

function Stage1({
  responses,
  streaming,
  isLoading,
  stopped,
  isComplete,
  defaultCollapsed = false,
  conversationTitle: _conversationTitle,
  imageAnalysis,
  expandedModel: externalExpandedModel,
  onExpandedModelChange,
  aggregateRankings,
}: Stage1Props) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [internalExpandedModel, setInternalExpandedModel] = useState<string | null>(null);
  const [userToggled, setUserToggled] = useState(false);

  // Use external control if provided, otherwise use internal state
  const expandedModel =
    externalExpandedModel !== undefined ? externalExpandedModel : internalExpandedModel;
  const setExpandedModel = onExpandedModelChange || setInternalExpandedModel;

  // Auto-expand Stage1 when a model is selected from external control (e.g., clicking ranking)
  useEffect(() => {
    if (externalExpandedModel && isCollapsed) {
      // Defer state update to avoid synchronous setState in effect
      const frameId = requestAnimationFrame(() => {
        setIsCollapsed(false);
        setUserToggled(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalExpandedModel]);

  // Build display data from either streaming or final responses
  const displayData: Stage1DisplayData[] = [];

  // Helper to detect if response text looks like an error message
  // IMPORTANT: Only match actual error message patterns from backend, not content
  // that discusses these topics. Backend errors use formats like "[Error: ...]"
  // or "Model timeout after Xs". See backend/council.py for error formats.
  const textLooksLikeError = (text: string): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('[error:') || // Backend error wrapper format
      lower.includes('[error]') || // Alternative error wrapper
      lower.includes('status 429') || // HTTP 429 (specific enough)
      lower.includes('rate limit exceeded') || // Full phrase, not just "rate limit"
      lower.includes('model timeout') || // Our specific timeout format
      lower.includes('timeout after') || // "timeout after 60s" pattern
      lower.includes('503 service') || // HTTP 503 error
      lower.includes('api request failed') // Explicit failure message
    );
  };

  if (streaming && Object.keys(streaming).length > 0) {
    Object.entries(streaming).forEach(([model, data]) => {
      const wasStopped = stopped && !data.complete;
      const textContent = data.text ?? '';
      const isComplete = data.complete ?? false;
      const hasError = data.error ?? false;
      const hasTextError = textLooksLikeError(textContent);
      displayData.push({
        model,
        response: textContent,
        isStreaming: !isComplete && !stopped,
        isComplete: isComplete && !hasError && !hasTextError,
        hasError: hasError || hasTextError,
        isEmpty: isComplete && !textContent && !hasError,
        isStopped: Boolean(wasStopped),
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

  // Sort by ranking position when rankings are available (winner first)
  if (aggregateRankings && aggregateRankings.length > 0) {
    displayData.sort((a, b) => {
      const rankA = aggregateRankings.findIndex((r) => r.model === a.model);
      const rankB = aggregateRankings.findIndex((r) => r.model === b.model);
      // Models not in rankings go to the end
      const posA = rankA >= 0 ? rankA : Infinity;
      const posB = rankB >= 0 ? rankB : Infinity;
      return posA - posB;
    });
  }

  // Check if all models are complete
  const allComplete =
    displayData.length > 0 && displayData.every((d) => d.isComplete || d.isStopped || d.hasError);

  // Use the reusable celebration hook for stage completion
  const { isCelebrating: showCompleteCelebration } = useCompletionCelebration(
    allComplete && displayData.length > 0,
    { duration: CELEBRATION.STAGE_COMPLETE }
  );

  // Auto-collapse when complete (only if user hasn't manually toggled)
  // Deferred with slight delay to allow celebration animation
  useEffect(() => {
    if (isComplete && allComplete && !isCollapsed && !userToggled) {
      const timeoutId = setTimeout(() => setIsCollapsed(true), 600);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isComplete, allComplete, isCollapsed, userToggled]);

  if (displayData.length === 0 && !isLoading) {
    return null;
  }

  // Calculate expert count dynamically
  const expertCount = displayData.length || (streaming ? Object.keys(streaming).length : 0);

  // Show loading state if stage1 is loading but no streaming data yet
  if (displayData.length === 0 && isLoading) {
    return (
      <div className="stage stage1">
        <h3 className="stage-title flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
          <span className="font-semibold tracking-tight">{t('stages.expertsRespond')}</span>
        </h3>

        {imageAnalysis && (
          <div className="image-analysis-section">
            <details className="image-analysis-details" open>
              <summary className="image-analysis-summary">
                <span className="image-icon">🖼️</span>
                {t('stages.imageAnalysis')}
                <span className="expand-hint">({t('stages.clickToCollapse')})</span>
              </summary>
              <div className="image-analysis-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{imageAnalysis}</ReactMarkdown>
              </div>
            </details>
          </div>
        )}

        <div className="stage-loading">
          <Spinner size="md" />
          <span>{t('stages.councilGathering')}</span>
        </div>
      </div>
    );
  }

  const toggleCollapsed = () => {
    setUserToggled(true);
    setIsCollapsed(!isCollapsed);
  };

  // Group models by provider for collapsed summary
  const providerGroups = displayData.reduce<Record<string, ProviderGroup>>((acc, data) => {
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
    <div
      className={`stage stage1 ${isCollapsed ? 'collapsed' : ''} ${showCompleteCelebration ? 'celebrating' : ''}`}
      data-stage="stage1"
    >
      <h3 className="stage-title clickable" {...makeClickable(toggleCollapsed)}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        <span className="font-semibold tracking-tight">
          {t('stages.expertsRespondCount', { count: expertCount })}
        </span>
        {/* Hint for first-time users - shows what this stage does */}
        {!isCollapsed && (
          <span className="stage-hint" title={t('stages.stage1Full')}>
            {t('stages.stage1Hint')}
          </span>
        )}
      </h3>

      {/* Collapsed model summary - provider pills */}
      {isCollapsed && displayData.length > 0 && (
        <div className="model-summary-pills">
          {Object.entries(providerGroups).map(([provider, group]) => (
            <span
              key={provider}
              className={`model-summary-pill ${group.allComplete ? 'complete' : ''} ${group.hasStreaming ? 'streaming' : ''} ${group.hasError ? 'error' : ''}`}
              title={
                group.hasError
                  ? `${group.label} encountered an error`
                  : group.allComplete
                    ? `${group.label} completed`
                    : `${group.label} in progress`
              }
            >
              {/* Streaming indicator - pulsing blue dot to show "thinking" */}
              {group.hasStreaming && (
                <span className="pill-thinking-indicator">
                  <span className="pill-thinking-dot" />
                </span>
              )}
              {/* Only show error indicator - success is the expected state, no visual noise */}
              {group.hasError && <span className="pill-error">✕</span>}
              {group.iconPath && (
                <img
                  src={group.iconPath}
                  alt=""
                  className="pill-icon"
                  loading="lazy"
                  decoding="async"
                />
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
                  {t('stages.imageAnalysis')}
                  <span className="expand-hint">({t('stages.clickToExpand')})</span>
                </summary>
                <div className="image-analysis-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{imageAnalysis}</ReactMarkdown>
                </div>
              </details>
            </div>
          )}

          {/* Living Feed Grid - shows all models simultaneously */}
          <div className="model-grid">
            <AnimatePresence mode="popLayout">
              {displayData.map((data) => {
                // Find ranking data for this model (includes position, avg_rank, rankings_count)
                const rankIndex = aggregateRankings?.findIndex((r) => r.model === data.model) ?? -1;
                const aggRanking = aggregateRankings?.[rankIndex];
                const rankData =
                  rankIndex >= 0 && aggRanking
                    ? {
                        position: rankIndex + 1,
                        average_rank: aggRanking.average_rank,
                        rankings_count: aggRanking.rankings_count,
                        totalVoters: aggregateRankings?.length ?? 0,
                      }
                    : null;
                return (
                  <ModelCard
                    key={data.model}
                    data={data}
                    isComplete={isComplete}
                    isExpanded={expandedModel === data.model}
                    onExpand={setExpandedModel}
                    rankData={rankData}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes but Stage1 props don't
export default memo(Stage1);
