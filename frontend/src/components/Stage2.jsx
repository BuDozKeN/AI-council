import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Stage2.css';

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

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text;

  let result = text;
  // Replace each "Response X" with the actual model name
  Object.entries(labelToModel).forEach(([label, model]) => {
    const modelShortName = model.split('/')[1] || model;
    result = result.replace(new RegExp(label, 'g'), `**${modelShortName}**`);
  });
  return result;
}

export default function Stage2({ rankings, streaming, labelToModel, aggregateRankings, isLoading, isComplete, defaultCollapsed = false, conversationTitle }) {
  const [activeTab, setActiveTab] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [userToggled, setUserToggled] = useState(false);

  // Build display data from either streaming or final rankings
  const displayData = [];

  if (streaming && Object.keys(streaming).length > 0) {
    // Use streaming data
    Object.entries(streaming).forEach(([model, data]) => {
      displayData.push({
        model,
        ranking: data.text,
        isStreaming: !data.complete,
        isComplete: data.complete && !data.error,
        hasError: data.error,
        isEmpty: data.complete && !data.text && !data.error,
        parsed_ranking: null, // Can't parse until complete
      });
    });
  } else if (rankings && rankings.length > 0) {
    // Use final rankings
    rankings.forEach((rank) => {
      displayData.push({
        model: rank.model,
        ranking: rank.ranking,
        isStreaming: false,
        isComplete: true,
        hasError: false,
        isEmpty: !rank.ranking,
        parsed_ranking: rank.parsed_ranking,
      });
    });
  }

  // Check if all models are complete (for collapsible state)
  const allComplete = displayData.every(d => d.isComplete || d.hasError);

  // Auto-select first tab with content
  useEffect(() => {
    if (displayData.length > 0 && activeTab >= displayData.length) {
      setActiveTab(0);
    }
  }, [displayData.length, activeTab]);

  // Auto-collapse when complete (only if user hasn't manually toggled)
  // This hook MUST be called before any early returns to maintain consistent hook order
  useEffect(() => {
    if (isComplete && allComplete && !isCollapsed && !userToggled) {
      setIsCollapsed(true);
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
          Stage 2: Peer Rankings
          {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        </h3>
        <div className="stage-loading">
          <div className="loading-spinner"></div>
          <span>Waiting for peer evaluations...</span>
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

  // Get winner from aggregate rankings (first item is the winner)
  const winner = aggregateRankings && aggregateRankings.length > 0
    ? (aggregateRankings[0].model.split('/')[1] || aggregateRankings[0].model)
    : null;
  const winnerAvg = aggregateRankings && aggregateRankings.length > 0
    ? aggregateRankings[0].average_rank.toFixed(1)
    : null;

  return (
    <div className={`stage stage2 ${isCollapsed ? 'collapsed' : ''}`}>
      <h3 className="stage-title clickable" onClick={toggleCollapsed}>
        <span className="collapse-arrow">{isCollapsed ? '▶' : '▼'}</span>
        Stage 2: Peer Rankings
        {conversationTitle && <span className="stage-topic">({conversationTitle})</span>}
        {isCollapsed && (
          <span className="collapsed-summary">
            {completedCount}/{totalCount} reviews
            {winner && <span className="winner-badge">Winner: {winner} (avg: {winnerAvg})</span>}
          </span>
        )}
      </h3>

      {!isCollapsed && (
        <>
          <h4>Raw Evaluations</h4>
          <p className="stage-description">
            Each model evaluated all responses (anonymized as Response A, B, C, etc.) and provided rankings.
            Below, model names are shown in <strong>bold</strong> for readability, but the original evaluation used anonymous labels.
          </p>

          <div className="tabs">
            {displayData.map((data, index) => (
              <button
                key={data.model}
                className={`tab ${activeTab === index ? 'active' : ''} ${data.isStreaming ? 'streaming' : ''} ${data.hasError || data.isEmpty ? 'error' : ''} ${data.isComplete && !data.isEmpty ? 'complete' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                {data.isStreaming && <span className="status-icon streaming-dot" title="Generating..."></span>}
                {data.isComplete && !data.isEmpty && <span className="status-icon complete-icon" title="Complete">✓</span>}
                {(data.hasError || data.isEmpty) && <span className="status-icon error-icon" title={data.hasError ? 'Error' : 'No response'}>⚠</span>}
                {data.model.split('/')[1] || data.model}
              </button>
            ))}
          </div>

          <div className="tab-content">
            <div className="ranking-model">
              <span className="model-info">
                {activeData.model}
                {activeData.isStreaming && <span className="typing-indicator">●</span>}
                {activeData.isComplete && !activeData.isEmpty && <span className="complete-badge">Complete</span>}
                {activeData.isEmpty && <span className="error-badge">No Response</span>}
                {activeData.hasError && <span className="error-badge">Error</span>}
              </span>
              {activeData.isComplete && !activeData.isEmpty && activeData.ranking && (
                <CopyButton text={activeData.ranking} />
              )}
            </div>
            <div className={`ranking-content markdown-content ${activeData.hasError || activeData.isEmpty ? 'error-text' : ''}`}>
              {activeData.isEmpty ? (
                <p className="empty-message">This model did not return an evaluation.</p>
              ) : activeData.hasError ? (
                <p className="empty-message">{activeData.ranking || 'An error occurred while generating the evaluation.'}</p>
              ) : (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {deAnonymizeText(activeData.ranking || '', labelToModel)}
                  </ReactMarkdown>
                  {activeData.isStreaming && <span className="cursor">▊</span>}
                </>
              )}
            </div>

            {activeData.parsed_ranking &&
             activeData.parsed_ranking.length > 0 && (
              <div className="parsed-ranking">
                <strong>Extracted Ranking:</strong>
                <ol>
                  {activeData.parsed_ranking.map((label, i) => (
                    <li key={i}>
                      {labelToModel && labelToModel[label]
                        ? labelToModel[label].split('/')[1] || labelToModel[label]
                        : label}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {aggregateRankings && aggregateRankings.length > 0 && (
            <div className="aggregate-rankings">
              <h4>Aggregate Rankings (Street Cred)</h4>
              <p className="stage-description">
                Combined results across all peer evaluations (lower score is better):
              </p>
              <div className="aggregate-list">
                {aggregateRankings.map((agg, index) => (
                  <div key={index} className="aggregate-item">
                    <span className="rank-position">#{index + 1}</span>
                    <span className="rank-model">
                      {agg.model.split('/')[1] || agg.model}
                    </span>
                    <span className="rank-score">
                      Avg: {agg.average_rank.toFixed(2)}
                    </span>
                    <span className="rank-count">
                      (by {agg.rankings_count}/{aggregateRankings.length} judges)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
