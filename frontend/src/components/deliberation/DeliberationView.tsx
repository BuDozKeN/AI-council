import { Sparkles, Clock, Square } from 'lucide-react';
import { CouncilCircle } from './CouncilCircle';
import { ThinkingStream } from './ThinkingStream';
import { InsightsPanel } from './InsightsPanel';
import { StageProgress } from './StageProgress';
import { StageTransition } from './StageTransition';
import './DeliberationView.css';

/**
 * DeliberationView - Main container for the "AxCouncil in Session" view
 *
 * Displays the council visualization, thinking stream, progress bar,
 * and insights panel during AI deliberation.
 */
export function DeliberationView({
  question,
  currentStage = 'drafting',
  modelStates = {},
  streamingContent = '',
  activeModel = null,
  insights = [],
  estimatedTimeRemaining = 0,
  completedModels = 0,
  totalModels = 0,
  onAddContext,
  onStop,
  showTransition = false,
  previousStage = null,
  companyName = '',
  departments = []
}) {
  const modelIds = Object.keys(modelStates);
  const isStreaming = activeModel && modelStates[activeModel] === 'thinking';

  return (
    <div className="deliberation-view">
      {/* Header with question and time estimate */}
      <div className="deliberation-header">
        <div className="deliberation-badge">
          <Sparkles className="badge-icon" size={14} />
          <span className="badge-text">AxCouncil in Session</span>
        </div>
        <h2 className="deliberation-question">{question}</h2>
        {estimatedTimeRemaining > 0 && (
          <span className="deliberation-time">
            <Clock className="time-icon" size={12} />
            About {Math.ceil(estimatedTimeRemaining / 1000)}s remaining
          </span>
        )}
      </div>

      {/* Stage Progress Bar */}
      <StageProgress
        currentStage={currentStage}
        completedModels={completedModels}
        totalModels={totalModels}
      />

      {/* Main content grid */}
      <div className="deliberation-content">
        {/* Left panel - Council visualization and thinking stream */}
        <div className="deliberation-left">
          <CouncilCircle
            modelStates={modelStates}
            stage={currentStage}
            modelIds={modelIds}
          />

          <ThinkingStream
            content={streamingContent}
            activeModel={activeModel}
            isStreaming={isStreaming}
          />
        </div>

        {/* Right panel - Insights */}
        <div className="deliberation-right">
          <InsightsPanel
            insights={insights}
            onAddContext={onAddContext}
            companyName={companyName}
            departments={departments}
          />
        </div>
      </div>

      {/* Stage transition overlay */}
      <StageTransition
        show={showTransition}
        fromStage={previousStage}
        toStage={currentStage}
      />

      {/* Footer with stop button */}
      {onStop && (
        <div className="deliberation-footer">
          <button className="stop-council-btn" onClick={onStop}>
            <Square className="stop-icon" size={12} />
            Stop AxCouncil
          </button>
        </div>
      )}
    </div>
  );
}

export default DeliberationView;
