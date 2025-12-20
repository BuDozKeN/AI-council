/**
 * Deliberation View Type Definitions
 *
 * Defines the stages, states, and insight types for the council deliberation process.
 */

/**
 * Deliberation stages with visual configuration
 */
export const STAGES = [
  {
    id: 'drafting',
    label: '1',
    description: 'Each advisor thinks',
    shortDescription: 'Thinking',
    color: 'var(--stage1-border)',
    bgGradient: 'linear-gradient(135deg, var(--stage1-bg-gradient-start), var(--stage1-bg-gradient-end))'
  },
  {
    id: 'reviewing',
    label: '2',
    description: 'They review each other',
    shortDescription: 'Reviewing',
    color: 'var(--stage2-border)',
    bgGradient: 'linear-gradient(135deg, var(--stage2-bg-gradient-start), var(--stage2-bg-gradient-end))'
  },
  {
    id: 'synthesising',
    label: '3',
    description: 'Creating your answer',
    shortDescription: 'Finishing',
    color: 'var(--stage3-border)',
    bgGradient: 'linear-gradient(135deg, var(--stage3-bg-gradient-start), var(--stage3-bg-gradient-end))'
  }
];

/**
 * Model states during deliberation
 */
export const MODEL_STATES = {
  WAITING: 'waiting',
  THINKING: 'thinking',
  COMPLETE: 'complete',
  REVIEWING: 'reviewing',
  ERROR: 'error'
};

/**
 * Insight types for the insights panel
 */
export const INSIGHT_TYPES = {
  KNOWLEDGE_GAP: 'knowledge_gap',
  CONSENSUS: 'consensus',
  TENSION: 'tension',
  CONTEXT_REFERENCE: 'context_reference'
};

/**
 * Get stage configuration by ID
 * @param {string} stageId - Stage identifier
 * @returns {Object|null} Stage configuration or null
 */
export function getStageById(stageId) {
  return STAGES.find(s => s.id === stageId) || null;
}

/**
 * Get stage index (0-based)
 * @param {string} stageId - Stage identifier
 * @returns {number} Index or -1 if not found
 */
export function getStageIndex(stageId) {
  return STAGES.findIndex(s => s.id === stageId);
}

/**
 * Check if a stage is complete relative to current stage
 * @param {string} stageId - Stage to check
 * @param {string} currentStageId - Current active stage
 * @returns {boolean} True if stage is complete
 */
export function isStageComplete(stageId, currentStageId) {
  const stageIndex = getStageIndex(stageId);
  const currentIndex = getStageIndex(currentStageId);
  return stageIndex < currentIndex;
}

/**
 * Check if a stage is active
 * @param {string} stageId - Stage to check
 * @param {string} currentStageId - Current active stage
 * @returns {boolean} True if stage is active
 */
export function isStageActive(stageId, currentStageId) {
  return stageId === currentStageId;
}
