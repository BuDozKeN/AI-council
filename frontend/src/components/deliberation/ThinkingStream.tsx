/* eslint-disable react-hooks/static-components -- Icon lookup via getProviderIcon is stable per provider */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Copy, Check, ChevronUp } from 'lucide-react';
import { getModelPersona } from '../../config/modelPersonas';
import { getProviderIcon } from '../icons';
import { logger } from '../../utils/logger';
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
  // Memoize the icon component to avoid recreating on each render
  const ProviderIcon = useMemo(
    () => (persona ? getProviderIcon(persona.provider) : null),
    [persona]
  );
  const [copied, setCopied] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const SCROLL_THRESHOLD = 150;

  // Copy handler
  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      logger.error('Failed to copy');
    }
  }, [content]);

  // Scroll to top handler
  const scrollToTop = useCallback(() => {
    streamRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle scroll for scroll-to-top button visibility
  const handleScroll = useCallback((e) => {
    setShowScrollTop(e.target.scrollTop > SCROLL_THRESHOLD);
  }, []);

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

      <div ref={streamRef} className="thinking-stream-content" onScroll={handleScroll}>
        {/* Copy button - sticky top-right inside content */}
        {content && (
          <button
            className={`thinking-stream-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy thinking content'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        <pre className="thinking-text">{content}</pre>
        {isStreaming && <span className="thinking-cursor">█</span>}
      </div>

      {/* Progress bar for visual feedback */}
      {isStreaming && (
        <div className="thinking-progress">
          <div className="thinking-progress-bar" />
        </div>
      )}

      {/* Scroll to top - absolute bottom-right */}
      {showScrollTop && (
        <button
          className="thinking-stream-scroll-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ChevronUp size={18} />
        </button>
      )}
    </div>
  );
}
