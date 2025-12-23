/* eslint-disable react-hooks/static-components -- Provider icons are retrieved from static map, not created dynamically */
import { memo } from 'react';
import { getModelPersona } from '../../config/modelPersonas';
import { getProviderIcon } from '../icons';
import { MODEL_STATES } from './types';
import './CouncilCircle.css';

/**
 * Avatar positions for semi-circle formation
 * Positions are arranged like seats around a table
 */
const AVATAR_POSITIONS = [
  'council-avatar-top',
  'council-avatar-left-top',
  'council-avatar-right-top',
  'council-avatar-left-bottom',
  'council-avatar-right-bottom'
];

/**
 * Get CSS class for avatar state
 */
function getStateClass(state) {
  switch (state) {
    case MODEL_STATES.WAITING:
      return 'avatar-waiting';
    case MODEL_STATES.THINKING:
      return 'avatar-thinking';
    case MODEL_STATES.COMPLETE:
      return 'avatar-complete';
    case MODEL_STATES.REVIEWING:
      return 'avatar-reviewing';
    case MODEL_STATES.ERROR:
      return 'avatar-error';
    default:
      return 'avatar-waiting';
  }
}

/**
 * Get status indicator for avatar
 */
function getStatusIndicator(state) {
  switch (state) {
    case MODEL_STATES.THINKING:
      return <span className="status-dot thinking-dot" />;
    case MODEL_STATES.REVIEWING:
      return <span className="status-dot reviewing-dot" />;
    case MODEL_STATES.COMPLETE:
      return <span className="status-check">✓</span>;
    case MODEL_STATES.ERROR:
      return <span className="status-error">!</span>;
    default:
      return null;
  }
}

/**
 * Individual council avatar - memoized to prevent unnecessary re-renders
 */
const CouncilAvatar = memo(function CouncilAvatar({ modelId, state, position }) {
  const persona = getModelPersona(modelId);
  const ProviderIcon = getProviderIcon(persona.provider);
  const stateClass = getStateClass(state);
  const statusIndicator = getStatusIndicator(state);

  return (
    <div
      className={`council-avatar ${position} ${stateClass}`}
      style={{ '--model-color': persona.color }}
      title={`${persona.fullName} - ${persona.tagline}`}
    >
      <span className="avatar-icon-container">
        {ProviderIcon ? (
          <ProviderIcon size={28} className="avatar-brand-icon" />
        ) : (
          <span className="avatar-initials-fallback">{persona.shortName.charAt(0)}</span>
        )}
      </span>
      <span className="avatar-name">{persona.shortName}</span>
      {statusIndicator && (
        <span className="avatar-status">{statusIndicator}</span>
      )}
    </div>
  );
});

/**
 * Chairman avatar (appears in Stage 3)
 */
function ChairmanAvatar() {
  const persona = getModelPersona('chairman');
  const ChairmanIcon = getProviderIcon('council');

  return (
    <div className="council-circle-chairman">
      <div className="chairman-avatar" style={{ '--model-color': persona.color }}>
        <span className="chairman-icon-container">
          {ChairmanIcon ? (
            <ChairmanIcon size={36} className="chairman-brand-icon" />
          ) : (
            <span className="chairman-initials-fallback">C</span>
          )}
        </span>
        <span className="chairman-label">Chairman</span>
      </div>
    </div>
  );
}

/**
 * CouncilCircle - Semi-circle visualization of AI council members
 *
 * Displays model avatars arranged in a semi-circle formation,
 * with state-based styling to show who is thinking, reviewing, etc.
 */
export function CouncilCircle({ modelStates = {}, stage, modelIds = [] }) {
  const showChairman = stage === 'synthesising';
  // Filter out chairman from the semi-circle - it's shown separately in the center
  const councilModelIds = modelIds.filter(id => id !== 'chairman');
  const hasModels = councilModelIds.length > 0;

  if (!hasModels && !showChairman) {
    return (
      <div className="council-circle-empty">
        <p>Awaiting council members...</p>
      </div>
    );
  }

  return (
    <div className="council-circle-container">
      <div className="council-circle">
        {/* Model avatars in semi-circle (excluding chairman) */}
        {councilModelIds.slice(0, 5).map((modelId, index) => (
          <CouncilAvatar
            key={modelId}
            modelId={modelId}
            state={modelStates[modelId] || MODEL_STATES.WAITING}
            position={AVATAR_POSITIONS[index]}
          />
        ))}

        {/* Chairman appears during synthesis */}
        {showChairman && <ChairmanAvatar />}
      </div>

      {/* Connection lines (optional visual enhancement) */}
      {hasModels && (
        <svg className="council-connections" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-border)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="var(--color-border)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--color-border)" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Semi-circle arc connecting avatars */}
          <path
            d="M 80 220 Q 200 20 320 220"
            fill="none"
            stroke="url(#connection-gradient)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
      )}
    </div>
  );
}
