/* eslint-disable react-hooks/static-components -- Provider icons are retrieved from static map, not created dynamically */
import { useState } from 'react';
import { Check, Zap, FileText, Lightbulb, TrendingUp, Eye, Sparkles } from 'lucide-react';
import { INSIGHT_TYPES } from './types';
import { getProviderIcon } from '../icons';
import { getModelPersona } from '../../config/modelPersonas';
import { AddContextModal } from './AddContextModal';
import './InsightsPanel.css';

/**
 * Map source name to model ID for icon lookup
 */
function getModelIdFromSource(source) {
  if (!source) return null;
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('gpt') || sourceLower.includes('openai')) return 'gpt-4';
  if (sourceLower.includes('claude') || sourceLower.includes('anthropic')) return 'claude-3-opus';
  if (sourceLower.includes('gemini') || sourceLower.includes('google')) return 'gemini-pro';
  if (sourceLower.includes('grok') || sourceLower.includes('xai')) return 'grok-2';
  if (sourceLower.includes('deepseek')) return 'deepseek-chat';
  return null;
}

/**
 * Configuration for insight card types
 */
const INSIGHT_CONFIGS = {
  [INSIGHT_TYPES.KNOWLEDGE_GAP]: {
    Icon: Lightbulb,
    label: 'WE CAN DO BETTER',
    className: 'insight-gap'
  },
  [INSIGHT_TYPES.CONSENSUS]: {
    Icon: Check,
    label: 'ALL ADVISORS AGREE',
    className: 'insight-consensus'
  },
  [INSIGHT_TYPES.TENSION]: {
    Icon: Zap,
    label: 'DIFFERENT VIEWS',
    className: 'insight-tension'
  },
  [INSIGHT_TYPES.CONTEXT_REFERENCE]: {
    Icon: FileText,
    label: 'USING YOUR INFO',
    className: 'insight-context'
  }
};

/**
 * Individual insight card - Knowledge Gap variant
 * Frames as helping the user get better results, not asking for their time
 */
function KnowledgeGapCard({ insight, onAddContext, companyName, departments }) {
  const [showModal, setShowModal] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  // Get the brand icon for the model that detected this gap
  const modelId = getModelIdFromSource(insight.source);
  const ProviderIcon = modelId ? getProviderIcon(getModelPersona(modelId)?.provider) : null;
  const persona = modelId ? getModelPersona(modelId) : null;

  const handleOpenModal = () => {
    if (!isAdded) {
      setShowModal(true);
    }
  };

  const handleSaveContext = async ({ response, scope, departmentId }) => {
    if (!onAddContext) return;

    // Pass all context info to parent
    await onAddContext({
      suggestedField: insight.suggestedContext,
      question: insight.content,
      response,
      scope,
      departmentId
    });
    setIsAdded(true);
  };

  return (
    <>
      <div className="insight-card insight-gap">
        {/* Header with model icon that detected the gap */}
        <div className="insight-header">
          {ProviderIcon && (
            <span
              className="insight-model-icon"
              style={{ '--model-color': persona?.color || '#6366f1' }}
              title={persona?.fullName}
            >
              <ProviderIcon size={16} />
            </span>
          )}
          <span className="insight-label">WE CAN DO BETTER</span>
        </div>

        {/* Explain the situation - framed as helping them */}
        <p className="insight-explanation">
          We noticed we could give you better advice if we knew:
        </p>

        {/* The actual question/gap */}
        <p className="insight-question">"{insight.content}"</p>

        {/* The benefit - what THEY get */}
        {insight.suggestedContext && !isAdded && (
          <div className="insight-benefit">
            <TrendingUp size={14} className="benefit-icon" />
            <span>Tell us once and get better advice forever</span>
          </div>
        )}

        {/* Action button - framed as improving their experience */}
        {insight.suggestedContext && (
          <button
            className={`insight-action-btn ${isAdded ? 'added' : ''}`}
            onClick={handleOpenModal}
            disabled={isAdded}
          >
            {isAdded ? (
              <>✓ Got it! We'll use this next time</>
            ) : (
              <>Improve my advice</>
            )}
          </button>
        )}
      </div>

      {/* Modal for collecting the answer */}
      <AddContextModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        question={insight.content}
        suggestedField={insight.suggestedContext}
        companyName={companyName}
        departments={departments}
        onSave={handleSaveContext}
      />
    </>
  );
}

/**
 * Individual insight card - for non-gap types
 */
function InsightCard({ insight }) {
  const config = INSIGHT_CONFIGS[insight.type] || INSIGHT_CONFIGS[INSIGHT_TYPES.CONSENSUS];
  const { Icon } = config;

  return (
    <div className={`insight-card ${config.className}`}>
      <div className="insight-header">
        <Icon className="insight-icon" size={14} />
        <span className="insight-label">{config.label}</span>
      </div>

      <p className="insight-content">"{insight.content}"</p>
    </div>
  );
}

/**
 * InsightsPanel - Live insights during deliberation
 *
 * Displays knowledge gaps, consensus points, tensions,
 * and context references detected during council deliberation.
 */
export function InsightsPanel({ insights = [], onAddContext, companyName, departments = [] }) {
  if (!insights || insights.length === 0) {
    return (
      <div className="insights-panel-empty">
        <Eye className="empty-icon" size={32} />
        <p className="empty-text">Your council is deliberating...</p>
        <p className="empty-subtext">We'll surface anything that needs your input</p>
      </div>
    );
  }

  // Group insights by type for better organization
  const gapInsights = insights.filter(i => i.type === INSIGHT_TYPES.KNOWLEDGE_GAP);
  const otherInsights = insights.filter(i => i.type !== INSIGHT_TYPES.KNOWLEDGE_GAP);

  return (
    <div className="insights-panel">
      <h3 className="insights-title">
        <Sparkles className="insights-title-icon" size={16} />
        {gapInsights.length > 0 ? 'Ways to Improve' : 'What We Found'}
        {insights.length > 1 && <span className="insights-count">{insights.length}</span>}
      </h3>

      <div className="insights-list">
        {/* Knowledge gaps first (most actionable) - use special card */}
        {gapInsights.map((insight, index) => (
          <KnowledgeGapCard
            key={`gap-${insight.content?.substring(0, 30) || index}`}
            insight={insight}
            onAddContext={onAddContext}
            companyName={companyName}
            departments={departments}
          />
        ))}

        {/* Other insights use generic card */}
        {otherInsights.map((insight, index) => (
          <InsightCard
            key={`other-${index}`}
            insight={insight}
          />
        ))}
      </div>
    </div>
  );
}
