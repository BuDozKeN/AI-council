import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from './ui/Spinner';
import { CopyButton } from './ui/CopyButton';
import { getModelPersona } from '../config/modelPersonas';
import { useCompletionCelebration } from '../hooks/useCelebration';
import { CELEBRATION } from '../lib/animation-constants';
import { makeClickable } from '../utils/a11y';
import type { Provider, ProviderIconPaths, Stage2Props, Stage2DisplayData } from '../types/stages';
import './stage2/Stage2.css';

// Provider icon paths (same as Stage1)
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

function deAnonymizeText(text: string, labelToModel?: Record<string, string>): string {
  if (!labelToModel) return text;

  let result = text;
  // Replace each "Response X" with the friendly brand name (e.g., "Gemini", "Claude")
  Object.entries(labelToModel).forEach(([label, model]) => {
    const persona = getModelPersona(model);
    const displayName = persona.providerLabel || persona.shortName;
    result = result.replace(new RegExp(label, 'g'), `**${displayName}**`);
  });
  return result;
}

// Rank label helper - medal emojis for top 3, numbers for rest
// Returns object with emoji/text and accessible label
function getRankLabel(position: number): { label: string; ariaLabel: string } {
  if (position === 1) return { label: '🥇', ariaLabel: 'Ranked #1' };
  if (position === 2) return { label: '🥈', ariaLabel: 'Ranked #2' };
  if (position === 3) return { label: '🥉', ariaLabel: 'Ranked #3' };
  return { label: `#${position}`, ariaLabel: `Ranked #${position}` };
}

function Stage2({
  rankings,
  streaming,
  labelToModel,
  aggregateRankings,
  isLoading,
  isComplete,
  defaultCollapsed = true,
  onModelClick,
}: Stage2Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [userToggled, setUserToggled] = useState(false);

  // Build display data from either streaming or final rankings
  const displayData: Stage2DisplayData[] = [];

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
    // Use streaming data
    Object.entries(streaming).forEach(([model, data]) => {
      const textValue = data.text ?? '';
      const isComplete = data.complete ?? false;
      const hasError = data.error ?? false;
      const hasTextError = textLooksLikeError(textValue);
      displayData.push({
        model,
        ranking: textValue,
        isStreaming: !isComplete,
        isComplete: isComplete && !hasError && !hasTextError,
        hasError: hasError || hasTextError,
        isEmpty: isComplete && !textValue && !hasError,
        parsed_ranking: null,
      });
    });
  } else if (rankings && rankings.length > 0) {
    // Use final rankings
    rankings.forEach((rank) => {
      const hasTextError = textLooksLikeError(rank.ranking);
      displayData.push({
        model: rank.model,
        ranking: rank.ranking,
        isStreaming: false,
        isComplete: !hasTextError,
        hasError: hasTextError,
        isEmpty: !rank.ranking,
        parsed_ranking: rank.parsed_ranking ?? null,
      });
    });
  }

  // Check if all models are complete
  const allComplete = displayData.every((d) => d.isComplete || d.hasError);

  // Use the reusable celebration hook for stage completion
  const { isCelebrating: showCompleteCelebration } = useCompletionCelebration(
    allComplete && displayData.length > 0,
    { duration: CELEBRATION.STAGE_COMPLETE, confetti: 'winner' }
  );

  // Auto-select first tab with content (deferred to avoid cascading renders)
  useEffect(() => {
    if (displayData.length > 0 && activeTab >= displayData.length) {
      const timeoutId = setTimeout(() => setActiveTab(0), 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [displayData.length, activeTab]);

  // Auto-collapse when all complete (if user hasn't manually toggled, deferred with delay for celebration)
  useEffect(() => {
    if (isComplete && allComplete && !isCollapsed && !userToggled) {
      const timeoutId = setTimeout(() => setIsCollapsed(true), 600);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isComplete, allComplete, isCollapsed, userToggled]);

  // Early returns AFTER all hooks have been called
  if (displayData.length === 0 && !isLoading) {
    return null;
  }

  // Show loading state if stage2 is loading but no streaming data yet
  if (displayData.length === 0 && isLoading) {
    return (
      <div className="stage stage2">
        <h3 className="stage-title">
          <span className="font-semibold tracking-tight">{t('stages.expertsReview')}</span>
        </h3>
        <div className="stage-loading">
          <Spinner size="md" />
          <span>{t('stages.expertsReviewing')}</span>
        </div>
      </div>
    );
  }

  // Get active data - guaranteed to exist since we return null above if displayData is empty
  const activeData = displayData[activeTab] ?? displayData[0]!;

  // Get winner from aggregate rankings
  const firstRanking = aggregateRankings?.[0];
  const winnerModel = firstRanking?.model ?? null;
  const winnerIconPath = winnerModel ? getModelIconPath(winnerModel) : null;
  const winnerPersona = winnerModel ? getModelPersona(winnerModel) : null;
  const winnerAvg = firstRanking?.average_rank?.toFixed(1) ?? null;

  const toggleCollapsed = () => {
    setUserToggled(true);
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`stage stage2 ${isCollapsed ? 'collapsed' : ''} ${showCompleteCelebration ? 'celebrating' : ''}`}
      data-stage="stage2"
    >
      <h3 className="stage-title clickable" {...makeClickable(toggleCollapsed)}>
        {isCollapsed ? (
          <ChevronRight size={16} className="collapse-arrow" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="collapse-arrow" aria-hidden="true" />
        )}
        <span className="font-semibold tracking-tight">{t('stages.expertsReview')}</span>
        {/* Hint for first-time users - shows what this stage does */}
        {!isCollapsed && (
          <span className="stage-hint" title={t('stages.stage2Full')}>
            {t('stages.stage2Hint')}
          </span>
        )}

        {/* Winner badge - medal emoji with icon, modern clean style */}
        {/* ISS-255: Added role="img" and aria-label for screen reader accessibility */}
        {winnerModel && (
          <span
            className={`stage2-winner ${showCompleteCelebration ? 'animate-winner-reveal' : ''}`}
            role="img"
            aria-label={t('stages.winnerBadgeLabel', {
              model: winnerPersona?.fullName || winnerPersona?.shortName || t('common.unknown'),
              defaultValue: `Winner: ${winnerPersona?.fullName || winnerPersona?.shortName || 'Unknown'}`,
            })}
            title={t('stages.winnerTooltip', {
              model: winnerPersona?.fullName || winnerPersona?.shortName || t('common.unknown'),
              count: displayData.length,
              avg: winnerAvg,
            })}
          >
            <span className="winner-medal" aria-hidden="true">🥇</span>
            {winnerIconPath && (
              <img
                src={winnerIconPath}
                alt=""
                className="winner-model-icon"
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <div className="stage2-content">
          <div className="tabs">
            {displayData.map((data, index) => {
              const persona = getModelPersona(data.model);
              const iconPath = getModelIconPath(data.model);
              const displayName = persona.providerLabel || persona.shortName;
              return (
                <button
                  key={data.model}
                  className={`tab no-touch-target ${activeTab === index ? 'active' : ''} ${data.isStreaming ? 'streaming' : ''} ${data.hasError || data.isEmpty ? 'error' : ''} ${data.isComplete && !data.isEmpty ? 'complete' : ''}`}
                  onClick={() => setActiveTab(index)}
                  title={persona.fullName}
                >
                  {/* Icon with status badge overlay - matches Stage 1 */}
                  <span className="tab-icon-wrapper">
                    {iconPath && (
                      <img
                        src={iconPath}
                        alt=""
                        className="tab-model-icon"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {data.isStreaming && (
                      <span className="tab-status-badge streaming">
                        <span className="tab-status-ping"></span>
                      </span>
                    )}
                    {data.isComplete && !data.isEmpty && !data.hasError && (
                      <span className="tab-status-badge complete">✓</span>
                    )}
                    {(data.hasError || data.isEmpty) && (
                      <span className="tab-status-badge error">✕</span>
                    )}
                  </span>
                  {displayName}
                </button>
              );
            })}
          </div>

          <div className="tab-content">
            <div className="ranking-model">
              <span className="model-info" title={getModelPersona(activeData.model).fullName}>
                {(() => {
                  const iconPath = getModelIconPath(activeData.model);
                  const persona = getModelPersona(activeData.model);
                  const displayName = persona.providerLabel || persona.shortName;
                  return (
                    <>
                      {iconPath && (
                        <img
                          src={iconPath}
                          alt=""
                          className="model-info-icon"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      {displayName}
                    </>
                  );
                })()}
                {activeData.isStreaming && <span className="typing-indicator">●</span>}
                {activeData.isComplete && !activeData.isEmpty && (
                  <span className="complete-badge">{t('common.done')}</span>
                )}
                {activeData.isEmpty && (
                  <span className="error-badge">{t('stages.noResponse')}</span>
                )}
                {activeData.hasError && <span className="error-badge">{t('common.error')}</span>}
              </span>
              {activeData.isComplete && !activeData.isEmpty && activeData.ranking && (
                <CopyButton text={activeData.ranking} size="sm" />
              )}
            </div>
            <div
              className={`ranking-content ${activeData.hasError || activeData.isEmpty ? 'error-text' : ''}`}
              role="status"
              aria-live="polite"
              aria-busy={activeData.isStreaming}
            >
              {activeData.isEmpty ? (
                <p className="empty-message">{t('stages.noEvaluation')}</p>
              ) : activeData.hasError ? (
                <p className="empty-message">{activeData.ranking || t('stages.evaluationError')}</p>
              ) : (
                <>
                  <article className="prose prose-slate prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-700 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Wrap tables in scrollable container for mobile
                        table({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) {
                          return (
                            <div className="table-scroll-wrapper">
                              <table {...props}>{children}</table>
                            </div>
                          );
                        },
                      }}
                    >
                      {deAnonymizeText(activeData.ranking || '', labelToModel)}
                    </ReactMarkdown>
                  </article>
                  {activeData.isStreaming && <span className="cursor">▊</span>}
                </>
              )}
            </div>

            {activeData.parsed_ranking && activeData.parsed_ranking.length > 0 && (
              <div className="parsed-ranking">
                <strong>{t('stages.rankingOrder')}:</strong>
                <ol>
                  {activeData.parsed_ranking.map((label: string, i: number) => {
                    const model = labelToModel && labelToModel[label];
                    const persona = model ? getModelPersona(model) : null;
                    const displayName = persona
                      ? persona.providerLabel || persona.shortName
                      : label;
                    return (
                      <li key={i} title={persona?.fullName}>
                        {displayName}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          {aggregateRankings && aggregateRankings.length > 0 && (
            <div className="aggregate-rankings">
              <h4 className="stage2-section-title">{t('stages.finalRanking')}</h4>
              <div className="aggregate-list animate-stagger">
                {aggregateRankings.map((agg, index: number) => {
                  const persona = getModelPersona(agg.model);
                  const iconPath = getModelIconPath(agg.model);
                  const displayName = persona.providerLabel || persona.shortName;
                  const totalVoters = displayData.length;
                  const isClickable = !!onModelClick;
                  return (
                    <div
                      key={index}
                      className={`aggregate-item rank-${index + 1} ${isClickable ? 'clickable' : ''}`}
                      title={
                        t('stages.rankTooltipFull', {
                          fullName: persona.fullName,
                          avg: agg.average_rank.toFixed(1),
                          votesReceived: agg.rankings_count,
                          totalVoters,
                        }) + (isClickable ? ` ${t('stages.clickToViewResponse')}` : '')
                      }
                      {...(isClickable && onModelClick
                        ? makeClickable(() => onModelClick(agg.model))
                        : {})}
                    >
                      <span
                        className="rank-position"
                        role="img"
                        aria-label={getRankLabel(index + 1).ariaLabel}
                      >
                        {getRankLabel(index + 1).label}
                      </span>
                      <span className="rank-model">
                        {iconPath && (
                          <img
                            src={iconPath}
                            alt=""
                            className="rank-model-icon"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        {displayName}
                      </span>
                      <span className="rank-score">{agg.average_rank.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes but Stage2 props don't
export default memo(Stage2);
