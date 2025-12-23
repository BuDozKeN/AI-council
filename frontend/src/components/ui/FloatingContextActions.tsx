/**
 * FloatingContextActions - Copy and scroll-to-top buttons for scrollable content areas
 *
 * Wraps any scrollable content (like .mc-content-preview) and provides:
 * - Copy button (sticky top-right, follows scroll) - appears always when copyText provided
 * - Scroll-to-top button (fixed bottom-right of container) - appears after scrolling down
 *
 * Usage:
 * <FloatingContextActions copyText={content}>
 *   <MarkdownViewer content={content} />
 * </FloatingContextActions>
 */

import { useRef, useState, useCallback } from 'react';
import { ChevronUp, Copy, Check } from 'lucide-react';
import { logger } from '../../utils/logger';
import './FloatingContextActions.css';

export function FloatingContextActions({
  children,
  copyText = null,
  scrollThreshold = 100, // px scrolled before scroll-to-top appears
  className = '',
  ...props
}) {
  const contentRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleScroll = useCallback((e) => {
    setShowScrollTop(e.target.scrollTop > scrollThreshold);
  }, [scrollThreshold]);

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCopy = useCallback(async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  }, [copyText]);

  return (
    <div className={`floating-context-wrapper ${className}`} {...props}>
      <div
        ref={contentRef}
        className="floating-context-content"
        onScroll={handleScroll}
      >
        {/* Copy button - sticky inside scrollable area */}
        {copyText && (
          <button
            className={`floating-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy content'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        {children}
      </div>

      {/* Scroll to top - absolute to wrapper, bottom-right */}
      {showScrollTop && (
        <button
          className="floating-scroll-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ChevronUp size={16} />
        </button>
      )}
    </div>
  );
}

export default FloatingContextActions;