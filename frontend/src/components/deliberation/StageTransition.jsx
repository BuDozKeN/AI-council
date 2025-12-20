import { Search, Sparkles } from 'lucide-react';
import './StageTransition.css';

/**
 * Stage transition messages
 */
const TRANSITION_MESSAGES = {
  'drafting_to_reviewing': {
    message: 'Responses anonymized. Peer review beginning...',
    Icon: Search
  },
  'reviewing_to_synthesising': {
    message: 'Chairman synthesizing final answer...',
    Icon: Sparkles
  }
};

/**
 * StageTransition - Overlay shown during stage transitions
 *
 * Provides visual feedback when transitioning between deliberation stages.
 */
export function StageTransition({ show, fromStage, toStage }) {
  if (!show || !fromStage || !toStage) return null;

  const messageKey = `${fromStage}_to_${toStage}`;
  const transition = TRANSITION_MESSAGES[messageKey];

  if (!transition) return null;

  const { Icon } = transition;

  return (
    <div className="stage-transition-overlay">
      <div className="transition-content">
        <Icon className="transition-icon" size={32} />
        <div className="transition-spinner" />
        <p className="transition-message">{transition.message}</p>
      </div>
    </div>
  );
}
