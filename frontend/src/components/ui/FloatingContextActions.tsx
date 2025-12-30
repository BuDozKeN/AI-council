/**
 * FloatingContextActions - Copy and scroll-to-top buttons for scrollable content areas
 *
 * Wraps any scrollable content (like .mc-content-preview) and provides:
 * - Copy button (sticky top-right, inside scroll area) - appears always when copyText provided
 * - Scroll-to-top button (fixed bottom-right of container) - appears after scrolling down
 * - Optional stickyHeader slot for rendering TOC/controls alongside copy button
 *
 * For modal contexts (className="no-border"):
 * - The parent (.mc-modal-body) handles scrolling, not this component
 * - Scroll detection uses IntersectionObserver on a sentinel element
 * - Scroll-to-top scrolls the nearest scrollable parent
 *
 * Usage:
 * <FloatingContextActions copyText={content} stickyHeader={<TableOfContents />}>
 *   <MarkdownViewer content={content} />
 * </FloatingContextActions>
 */

import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if this is a "no-border" variant (parent handles scrolling)
  const isParentScrollContext = className.includes('no-border');

  // For self-scrolling context: listen to scroll events on content
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!isParentScrollContext) {
      setShowScrollTop(e.currentTarget.scrollTop > scrollThreshold);
    }
  }, [scrollThreshold, isParentScrollContext]);

  // For parent-scrolling context: use IntersectionObserver on sentinel
  useEffect(() => {
    if (!isParentScrollContext || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          // When sentinel is NOT visible, show scroll-to-top button
          setShowScrollTop(!entry.isIntersecting);
        }
      },
      { threshold: 0 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isParentScrollContext]);

  // Find the nearest scrollable parent for scroll-to-top
  const findScrollParent = useCallback((element: HTMLElement | null): HTMLElement | null => {
    if (!element) return null;
    let parent = element.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }, []);

  const scrollToTop = useCallback(() => {
    if (isParentScrollContext) {
      // Scroll the parent container (e.g., modal body)
      const scrollParent = findScrollParent(contentRef.current);
      scrollParent?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Scroll self
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isParentScrollContext, findScrollParent]);

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

  // Determine layout:
  // - If stickyHeader exists: full sticky row with header + copy button
  // - If only copy button: sticky button floated to right
  const hasStickyHeader = Boolean(stickyHeader);

  return (
    <div className={`floating-context-wrapper ${className}`}>
      <div
        ref={contentRef}
        className="floating-context-content"
        onScroll={handleScroll}
      >
        {/* Sentinel for IntersectionObserver - detects when scrolled past top */}
        {isParentScrollContext && <div ref={sentinelRef} className="floating-scroll-sentinel" />}

        {/* Sticky copy button wrapper - sticks to top, button aligned right */}
        {copyText && !hasStickyHeader && (
          <div className="floating-copy-sticky-wrapper">
            <button
              className={`floating-copy-btn-sticky ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy content'}
              aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {/* Sticky row - when there's a stickyHeader (TOC etc) */}
        {hasStickyHeader && (
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

        {/* Scroll to top - inside content for no-border (sticky), outside for self-scroll (absolute) */}
        {isParentScrollContext && showScrollTop && (
          <div className="floating-scroll-top-sticky-wrapper">
            <button
              className="floating-scroll-top-btn"
              onClick={scrollToTop}
              aria-label="Scroll to top"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Scroll to top - absolute to wrapper for self-scrolling contexts */}
      {!isParentScrollContext && showScrollTop && (
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
