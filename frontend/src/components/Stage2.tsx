import { useState, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Spinner } from './ui/Spinner';
import { CopyButton } from './ui/CopyButton';
import { Users, Trophy, CheckCircle2 } from 'lucide-react';
import { getModelPersona } from '../config/modelPersonas';
import './Stage2.css';

// Provider icon paths (same as Stage1)
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

function deAnonymizeText(text, labelToModel) {
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

function Stage2({ rankings, streaming, labelToModel, aggregateRankings, isLoading, isComplete, defaultCollapsed = true, conversationTitle }) {
  const [activeTab, setActiveTab] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [userToggled, setUserToggled] = useState(false);

  // Build display data from either streaming or final rankings
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
    // Use streaming data
    Object.entries(streaming).forEach(([model, data]) => {
      const hasTextError = textLooksLikeError(data.text);
      displayData.push({
        model,
        ranking: data.text,
        isStreaming: !data.complete,
        isComplete: data.complete && !data.error && !hasTextError,
        hasError: data.error || hasTextError,
        isEmpty: data.complete && !data.text && !data.error,
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
        parsed_ranking: rank.parsed_ranking,
      });
    });
  }

  // Check if all models are complete
  const allComplete = displayData.every(d => d.isComplete || d.hasError);
  const streamingCount = displayData.filter(d => d.isStreaming).length;

  // Auto-select first tab with content (deferred to avoid cascading renders)
  useEffect(() => {
    if (displayData.length > 0 && activeTab >= displayData.length) {
      const timeoutId = setTimeout(() => setActiveTab(0), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [displayData.length, activeTab]);

  // Auto-collapse when all complete (if user hasn't manually toggled, deferred)
  useEffect(() => {
    if (isComplete && allComplete && !isCollapsed && !userToggled) {
      const timeoutId = setTimeout(() => setIsCollapsed(true), 0);
      return () => clearTimeout(timeoutId);
    }
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
          <Users className="h-5 w-5 text-violet-500 flex-shrink-0" />
          <span className="font-semibold tracking-tight">Step 2: Cross-checking Answers</span>
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>
        <div className="stage-loading">
          <Spinner size="md" />
          <span>Experts are reviewing each other's answers...</span>
        </div>
      </div>
    );
  }

  const activeData = displayData[activeTab] || displayData[0];

  // Get winner from aggregate rankings
  const winnerModel = aggregateRankings && aggregateRankings.length > 0
    ? aggregateRankings[0].model
    : null;
  const winnerIconPath = winnerModel ? getModelIconPath(winnerModel) : null;
  const winnerPersona = winnerModel ? getModelPersona(winnerModel) : null;
  const winnerAvg = aggregateRankings && aggregateRankings.length > 0
    ? aggregateRankings[0].average_rank.toFixed(1)
    : null;

  const toggleCollapsed = () => {
    setUserToggled(true);
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`stage stage2 ${isCollapsed ? 'collapsed' : ''}`} data-stage="stage2">
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        {streamingCount > 0 ? (
          <Users className="h-5 w-5 text-violet-500 animate-pulse flex-shrink-0" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-violet-600 flex-shrink-0" />
        )}
        <span className="font-semibold tracking-tight">Step 2: Cross-checking Answers</span>
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}

        {/* Winner badge - just trophy + icon, details on hover */}
        {winnerModel && (
          <span
            className="stage2-winner"
            title={`Winner: ${winnerPersona?.fullName || winnerPersona?.shortName || 'Unknown'} — Voted #1 by ${aggregateRankings?.length || 5} AI experts with avg score ${winnerAvg} (1 = best)`}
          >
            <Trophy style={{ width: 14, height: 14 }} />
            {winnerIconPath && (
              <img
                src={winnerIconPath}
                alt=""
                className="winner-model-icon"
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
                  className={`tab ${activeTab === index ? 'active' : ''} ${data.isStreaming ? 'streaming' : ''} ${data.hasError || data.isEmpty ? 'error' : ''} ${data.isComplete && !data.isEmpty ? 'complete' : ''}`}
                  onClick={() => setActiveTab(index)}
                  title={persona.fullName}
                >
                  {/* Icon with status badge overlay - matches Stage 1 */}
                  <span className="tab-icon-wrapper">
                    {iconPath && <img src={iconPath} alt="" className="tab-model-icon" />}
                    {data.isStreaming && <span className="tab-status-badge streaming"><span className="tab-status-ping"></span></span>}
                    {data.isComplete && !data.isEmpty && !data.hasError && <span className="tab-status-badge complete">✓</span>}
                    {(data.hasError || data.isEmpty) && <span className="tab-status-badge error">✕</span>}
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
                      {iconPath && <img src={iconPath} alt="" className="model-info-icon" />}
                      {displayName}
                    </>
                  );
                })()}
                {activeData.isStreaming && <span className="typing-indicator">●</span>}
                {activeData.isComplete && !activeData.isEmpty && <span className="complete-badge">Done</span>}
                {activeData.isEmpty && <span className="error-badge">No Response</span>}
                {activeData.hasError && <span className="error-badge">Error</span>}
              </span>
              {activeData.isComplete && !activeData.isEmpty && activeData.ranking && (
                <CopyButton text={activeData.ranking} size="sm" />
              )}
            </div>
            <div className={`ranking-content markdown-content ${activeData.hasError || activeData.isEmpty ? 'error-text' : ''}`}>
              {activeData.isEmpty ? (
                <p className="empty-message">This model did not return an evaluation.</p>
              ) : activeData.hasError ? (
                <p className="empty-message">{activeData.ranking || 'An error occurred while generating the evaluation.'}</p>
              ) : (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Wrap tables in scrollable container for mobile
                      table({ children, ...props }) {
                        return (
                          <div className="table-scroll-wrapper">
                            <table {...props}>{children}</table>
                          </div>
                        );
                      }
                    }}
                  >
                    {deAnonymizeText(activeData.ranking || '', labelToModel)}
                  </ReactMarkdown>
                  {activeData.isStreaming && <span className="cursor">▊</span>}
                </>
              )}
            </div>

            {activeData.parsed_ranking &&
             activeData.parsed_ranking.length > 0 && (
              <div className="parsed-ranking">
                <strong>Ranking order:</strong>
                <ol>
                  {activeData.parsed_ranking.map((label, i) => {
                    const model = labelToModel && labelToModel[label];
                    const persona = model ? getModelPersona(model) : null;
                    const displayName = persona ? (persona.providerLabel || persona.shortName) : label;
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
              <h4 className="stage2-section-title">Final Rankings</h4>
              <div className="aggregate-list">
                {aggregateRankings.map((agg, index) => {
                  const persona = getModelPersona(agg.model);
                  const iconPath = getModelIconPath(agg.model);
                  const displayName = persona.providerLabel || persona.shortName;
                  const totalVoters = aggregateRankings.length;
                  return (
                    <div
                      key={index}
                      className="aggregate-item"
                      title={`${persona.fullName} - Average rank: ${agg.average_rank.toFixed(1)} (${agg.rankings_count} of ${totalVoters} experts voted). Lower is better - #1 is the top answer.`}
                    >
                      <span className="rank-position">#{index + 1}</span>
                      <span className="rank-model">
                        {iconPath && <img src={iconPath} alt="" className="rank-model-icon" />}
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
