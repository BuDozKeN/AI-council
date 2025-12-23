/**
 * Deliberation View Components
 *
 * Exports all components for the "Council in Session" deliberation view.
 */

// Main container
export { DeliberationView, default } from './DeliberationView';

// Sub-components
export { CouncilCircle } from './CouncilCircle';
export { ThinkingStream } from './ThinkingStream';
export { InsightsPanel } from './InsightsPanel';
export { StageProgress } from './StageProgress';
export { StageTransition } from './StageTransition';
export { AddContextModal } from './AddContextModal';

// Demo/testing
export { DeliberationDemo } from './DeliberationDemo';

// Types and constants
export {
  STAGES,
  MODEL_STATES,
  INSIGHT_TYPES,
  getStageById,
  getStageIndex,
  isStageComplete,
  isStageActive
} from './types';
