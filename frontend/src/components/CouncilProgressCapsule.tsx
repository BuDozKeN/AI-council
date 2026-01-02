import { getModelPersona } from '../config/modelPersonas';
import './CouncilProgressCapsule.css';

interface StreamingData {
  complete?: boolean;
  text?: string;
  [key: string]: unknown;
}

// StreamingState matches Record<string, StreamingState> from conversation.ts
type StreamingStateRecord = Record<string, StreamingData>;

interface LoadingState {
  stage1?: boolean;
  stage2?: boolean;
  stage3?: boolean;
}

interface StatusResult {
  text: string;
  isStopped?: boolean;
  isUploading?: boolean;
}

interface CouncilProgressCapsuleProps {
  stage1Streaming?: StreamingStateRecord | null | undefined;
  stage2Streaming?: StreamingStateRecord | null | undefined;
  loading?: LoadingState | null | undefined;
  isComplete?: boolean | undefined;
  stopped?: boolean | undefined;
  isUploading?: boolean | undefined;
}

/**
 * Shows what the council is doing in plain, friendly language.
 * A user should be able to tell their friend "Gemini and Claude are thinking" not "Stage 1 in progress"
 */

// Get friendly display name from centralized model personas
const getFriendlyName = (modelId: string): string => {
  const persona = getModelPersona(modelId);
  return persona.providerLabel || persona.shortName;
};

export default function CouncilProgressCapsule({
  stage1Streaming,
  stage2Streaming,
  loading,
  isComplete,
  stopped,
  isUploading,
}: CouncilProgressCapsuleProps) {
  const getStatus = (): StatusResult | null => {
    // If stopped, show stopped message
    if (stopped) {
      return { text: 'Stopped', isStopped: true };
    }

    // If uploading images, show analysis status (more informative than just "uploading")
    if (isUploading) {
      return { text: 'Analysing your image...', isUploading: true };
    }

    if (!loading) return null;

    // Stage 1: Models are thinking/responding
    if (loading.stage1) {
      const models = stage1Streaming ? Object.keys(stage1Streaming) : [];

      if (models.length === 0) {
        return { text: 'Waking up the council...' };
      }

      // Find which models are still thinking (not complete)
      const thinkingModels = models.filter((model: string) => {
        const data = stage1Streaming?.[model];
        return data && !data.complete;
      });

      const completedModels = models.filter((model: string) => {
        const data = stage1Streaming?.[model];
        return data && data.complete;
      });

      if (thinkingModels.length === 0 && completedModels.length > 0) {
        return { text: "Everyone's ready, moving on..." };
      }

      // Get friendly names for thinking models
      const thinkingNames = thinkingModels.map(getFriendlyName);

      if (thinkingNames.length === 1) {
        return { text: `${thinkingNames[0]} is thinking...` };
      } else if (thinkingNames.length === 2) {
        return { text: `${thinkingNames[0]} and ${thinkingNames[1]} are thinking...` };
      } else if (thinkingNames.length <= 3) {
        const last = thinkingNames.pop();
        return { text: `${thinkingNames.join(', ')} and ${last} are thinking...` };
      } else {
        return { text: `${thinkingNames.length} council members are thinking...` };
      }
    }

    // Stage 2: Peer review - models reviewing each other
    if (loading.stage2) {
      const models = stage2Streaming ? Object.keys(stage2Streaming) : [];

      if (models.length === 0) {
        return { text: "Council members are reviewing each other's answers..." };
      }

      const reviewingModels = models.filter((model: string) => {
        const data = stage2Streaming?.[model];
        return data && !data.complete;
      });

      if (reviewingModels.length === 0) {
        return { text: 'Reviews complete, tallying votes...' };
      }

      const reviewingNames = reviewingModels.map(getFriendlyName);

      if (reviewingNames.length === 1) {
        return { text: `${reviewingNames[0]} is reviewing the answers...` };
      } else if (reviewingNames.length === 2) {
        return { text: `${reviewingNames[0]} and ${reviewingNames[1]} are discussing...` };
      } else {
        return { text: 'Council is debating the best answer...' };
      }
    }

    // Stage 3: Chairman making final decision
    if (loading.stage3) {
      return { text: 'Chairman is writing the final answer...' };
    }

    return null;
  };

  const status = getStatus();

  // Show if we have a status (uploading always shows, even if complete)
  if (!status || (isComplete && !status.isUploading)) return null;

  return (
    <div
      className={`council-progress-capsule fade-in ${status.isStopped ? 'stopped' : ''} ${status.isUploading ? 'uploading' : ''}`}
    >
      <div className="capsule-inner">
        {/* Pulsing dot - like the "typing" indicator in chat apps */}
        {/* For stopped state: show static gray square instead of pulsing green dot */}
        {/* For uploading state: show upload icon */}
        {status.isStopped ? (
          <div className="stopped-indicator">
            <span className="stopped-square"></span>
          </div>
        ) : status.isUploading ? (
          <div className="upload-indicator">
            <span className="upload-icon">⬆</span>
          </div>
        ) : (
          <div className="pulse-container">
            <span className="pulse-ring"></span>
            <span className="pulse-dot"></span>
          </div>
        )}

        <span className="capsule-text">{status.text}</span>
      </div>
    </div>
  );
}
