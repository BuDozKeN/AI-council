/**
 * ScrollableContent - Wrapper with copy and scroll-to-top buttons
 *
 * Use this to wrap any scrollable content area. Provides:
 * - Copy button (sticky top-right inside content) when copyText is provided
 * - Scroll-to-top button (absolute bottom-right) after scrolling down
 *
 * Both buttons are positioned to NOT cover the scrollbar.
 */

import { useRef, useState, useCallback, ReactNode } from 'react';
import { ChevronUp, Copy, Check } from 'lucide-react';
import { logger } from '../../utils/logger';
import './ScrollableContent.css';

interface ScrollableContentProps {
  children: ReactNode;
  className?: string;
  copyText?: string | null;
  scrollThreshold?: number;
  [key: string]: unknown;
}

export function ScrollableContent({
  children,
  className = '',
  copyText = null, // If provided, shows floating copy button
  scrollThreshold = 150, // px scrolled before scroll-to-top appears
  ...props
}: ScrollableContentProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setShowScrollTop((e.target as HTMLDivElement).scrollTop > scrollThreshold);
    },
    [scrollThreshold]
  );

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <div className={`scrollable-content-wrapper ${className}`} {...props}>
      <div ref={contentRef} className="scrollable-content-inner" onScroll={handleScroll}>
        {/* Copy button - sticky top-right, inside scrollable content */}
        {copyText && (
          <button
            className={`scrollable-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy content'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        {children}
      </div>

      {/* Scroll to top - absolute bottom-right, aligned with copy button */}
      {showScrollTop && (
        <button
          className="scrollable-scroll-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ChevronUp size={16} />
        </button>
      )}
    </div>
  );
}

export default ScrollableContent;
