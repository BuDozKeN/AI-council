import { Search, Sparkles, Users, Brain, MessageSquare } from 'lucide-react';
import { STAGES, getStageIndex } from './types';
import './StageProgress.css';

/**
 * Stage icons
 */
const STAGE_ICONS = {
  drafting: Brain,
  reviewing: Users,
  synthesising: MessageSquare
};

/**
 * StageProgress - Visual progress indicator for deliberation stages
 *
 * Shows a 3-segment progress bar with stage labels,
 * highlighting active and completed stages.
 */
export function StageProgress({ currentStage, completedModels = 0, totalModels = 0 }) {
  const currentStageIndex = getStageIndex(currentStage);

  return (
    <div className="stage-progress-container">
      <div className="stage-progress-bar">
        {STAGES.map((stage, index) => {
          const isActive = index === currentStageIndex;
          const isComplete = index < currentStageIndex;
          const StageIcon = STAGE_ICONS[stage.id];

          return (
            <div
              key={stage.id}
              className={`stage-segment ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
            >
              <div
                className="segment-bar"
                style={{ '--stage-color': stage.color }}
              >
                {isActive && <div className="segment-bar-progress" />}
              </div>
              <div className="segment-label">
                <span className="segment-icon-container">
                  {StageIcon && <StageIcon size={12} className="segment-icon" />}
                </span>
                <span className="segment-text">{stage.description}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage 1: Show how many advisors have responded */}
      {currentStage === 'drafting' && totalModels > 0 && (
        <div className="progress-status">
          <span className="progress-count">{completedModels}</span>
          <span className="progress-separator">of</span>
          <span className="progress-total">{totalModels}</span>
          <span className="progress-label">advisors have responded</span>
        </div>
      )}

      {/* Stage 2: Advisors are checking each other's work */}
      {currentStage === 'reviewing' && (
        <div className="progress-status reviewing">
          <Search className="progress-icon" size={14} />
          <span className="progress-label">Your advisors are peer-reviewing each other...</span>
        </div>
      )}

      {/* Stage 3: Creating the final answer */}
      {currentStage === 'synthesising' && (
        <div className="progress-status synthesising">
          <Sparkles className="progress-icon" size={14} />
          <span className="progress-label">Synthesizing the best insights for you...</span>
        </div>
      )}
    </div>
  );
}
