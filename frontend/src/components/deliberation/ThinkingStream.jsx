import { useEffect, useRef } from 'react';
import { getModelPersona } from '../../config/modelPersonas';
import { getProviderIcon } from '../icons';
import './ThinkingStream.css';

/**
 * ThinkingStream - Real-time AI thinking process visualization
 *
 * Displays streaming text from the active model with auto-scroll,
 * monospace font styling, and a blinking cursor for active streaming.
 */
export function ThinkingStream({ content, activeModel, isStreaming }) {
  const streamRef = useRef(null);
  const persona = activeModel ? getModelPersona(activeModel) : null;
  const ProviderIcon = persona ? getProviderIcon(persona.provider) : null;

  // Auto-scroll to bottom as new content streams in
  useEffect(() => {
    if (streamRef.current && isStreaming) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  if (!content && !isStreaming) {
    return (
      <div className="thinking-stream-empty">
        <div className="empty-icon-placeholder" />
        <p>Waiting for council members to begin...</p>
      </div>
    );
  }

  return (
    <div className="thinking-stream-container">
      {activeModel && persona && (
        <div className="thinking-stream-header">
          <span className="thinking-icon-container" style={{ background: persona.color }}>
            {ProviderIcon ? (
              <ProviderIcon size={16} className="thinking-brand-icon" />
            ) : (
              <span className="thinking-initials-fallback">{persona.shortName.charAt(0)}</span>
            )}
          </span>
          <span className="thinking-model" style={{ color: persona.color }}>
            {persona.shortName}
          </span>
          <span className="thinking-label">is analyzing...</span>
          {isStreaming && <span className="thinking-status-dot" />}
        </div>
      )}

      <div ref={streamRef} className="thinking-stream-content">
        <pre className="thinking-text">{content}</pre>
        {isStreaming && <span className="thinking-cursor">█</span>}
      </div>

      {/* Progress bar for visual feedback */}
      {isStreaming && (
        <div className="thinking-progress">
          <div className="thinking-progress-bar" />
        </div>
      )}
    </div>
  );
}
