/**
 * FloatingContextActions - Copy and scroll-to-top buttons for scrollable content areas
 *
 * Wraps any scrollable content (like .mc-content-preview) and provides:
 * - Copy button (sticky top-right, inside scroll area) - appears always when copyText provided
 * - Scroll-to-top button (fixed bottom-right of container) - appears after scrolling down
 * - Optional stickyHeader slot for rendering TOC/controls alongside copy button
 *
 * Usage:
 * <FloatingContextActions copyText={content} stickyHeader={<TableOfContents />}>
 *   <MarkdownViewer content={content} />
 * </FloatingContextActions>
 */

import { useRef, useState, useCallback, ReactNode } from 'react';
import { ChevronUp, Copy, Check } from 'lucide-react';
import { logger } from '../../utils/logger';
import './FloatingContextActions.css';

interface FloatingContextActionsProps {
  children: ReactNode;
  copyText?: string | null | undefined;
  stickyHeader?: ReactNode | null;
  scrollThreshold?: number;
  className?: string;
}

export function FloatingContextActions({
  children,
  copyText = null,
  stickyHeader = null, // Optional: TOC or other controls to show in sticky header row
  scrollThreshold = 100, // px scrolled before scroll-to-top appears
  className = '',
}: FloatingContextActionsProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > scrollThreshold);
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

  const hasStickyRow = copyText || stickyHeader;

  return (
    <div className={`floating-context-wrapper ${className}`}>
      <div
        ref={contentRef}
        className="floating-context-content"
        onScroll={handleScroll}
      >
        {/* Sticky header row - contains TOC and copy button aligned together */}
        {hasStickyRow && (
          <div className="floating-sticky-row">
            <div className="floating-sticky-left">
              {stickyHeader}
            </div>
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
          </div>
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
