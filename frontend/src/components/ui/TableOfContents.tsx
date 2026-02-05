/**
 * TableOfContents - Standardized TOC component with multiple variants
 *
 * Future-proof, reusable component for any markdown content area.
 *
 * Variants:
 * - 'floating': Fixed position sidebar (desktop, right edge)
 * - 'sticky': Sticky capsule at top of content (recommended for embedded content)
 * - 'sheet': Mobile bottom sheet (pill trigger + slide-up modal)
 * - 'inline': Static inline list (for sidebars or panels)
 *
 * Features:
 * - Auto-extracts H2/H3 headings from content
 * - Scroll-spy tracks active section
 * - Click-to-navigate with smooth scrolling
 * - Progress indicator
 * - Collapsible states
 * - Responsive (hides on small screens for floating variant)
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * const contentRef = useRef<HTMLDivElement>(null);
 * const containerRef = useRef<HTMLDivElement>(null);
 *
 * <div ref={containerRef}>
 *   <TableOfContents
 *     variant="sticky"
 *     contentRef={contentRef}
 *     containerRef={containerRef}
 *     title="My Document"
 *   />
 *   <div ref={contentRef}>
 *     <MarkdownViewer content={markdown} />
 *   </div>
 * </div>
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X } from 'lucide-react';
import './table-of-contents/toc-base.css';
import './table-of-contents/toc-mobile.css';
import './table-of-contents/toc-variants.css';

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface TableOfContentsProps {
  /** Ref to the content element containing headings */
  contentRef: React.RefObject<HTMLElement | HTMLDivElement | null>;
  /** Ref to the container element (for visibility detection) */
  containerRef?: React.RefObject<HTMLElement | HTMLDivElement | null>;
  /** Whether content is fully loaded (for streaming content) */
  isStreamingComplete?: boolean;
  /** Title shown in TOC header */
  title?: string;
  /** Display variant */
  variant?: 'floating' | 'sticky' | 'sheet' | 'inline';
  /** Heading levels to include */
  headingLevels?: ('h2' | 'h3')[];
  /** Minimum headings required to show TOC */
  minHeadings?: number;
  /** Custom class name */
  className?: string;
}

export function TableOfContents({
  contentRef,
  containerRef,
  isStreamingComplete = true,
  title,
  variant = 'sticky',
  headingLevels = ['h2'],
  minHeadings = 1,
  className = '',
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(variant === 'sticky');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const stickyWrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(variant !== 'floating');
  const tocRef = useRef<HTMLElement>(null);

  // Extract headings from content
  useEffect(() => {
    if (!contentRef.current || !isStreamingComplete) return;

    const timer = setTimeout(() => {
      if (!contentRef.current) return;

      const selector = headingLevels.join(', ');
      const elements = Array.from(contentRef.current.querySelectorAll(selector));

      // Filter out common TOC/navigation headings that shouldn't appear in TOC
      const excludedHeadings = [
        'table of contents',
        'contents',
        'toc',
        'navigation',
        'on this page',
      ];

      const items: Heading[] = elements
        .map((el: Element) => {
          if (!el.id) {
            const slug = el.textContent
              ?.toLowerCase()
              .replace(/[^\w]+/g, '-')
              .replace(/^-+|-+$/g, '');
            el.id = slug ?? `section-${Math.random().toString(36).slice(2, 8)}`;
          }

          return {
            id: el.id,
            text: el.textContent ?? '',
            level: (el.tagName === 'H2' ? 2 : 3) as 2 | 3,
          };
        })
        .filter((h: Heading) => {
          // Exclude common TOC headings
          const normalizedText = h.text.toLowerCase().trim();
          return !excludedHeadings.includes(normalizedText);
        });

      setHeadings(items);
      if (items.length > 0 && items[0]) {
        setActiveId(items[0].id);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [contentRef, isStreamingComplete, headingLevels]);

  // Scroll-spy using IntersectionObserver
  // For content inside scrollable containers, we use a scroll event listener as fallback
  useEffect(() => {
    if (!contentRef.current || headings.length === 0) return;

    // Find the scrollable parent (could be the content itself or a parent)
    const findScrollableParent = (element: HTMLElement | null): HTMLElement | Window => {
      if (!element) return window;
      const style = getComputedStyle(element);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return element;
      }
      return findScrollableParent(element.parentElement);
    };

    const scrollContainer = findScrollableParent(contentRef.current);

    const handleScroll = () => {
      if (!contentRef.current) return;

      // Get scroll position relative to container
      const containerRect =
        scrollContainer === window
          ? { top: 0 }
          : (scrollContainer as HTMLElement).getBoundingClientRect();

      let currentHeading: string | null = null;

      // Find the heading that's currently at or above the top of the visible area
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        // If heading is at or above the top 20% of the container, it's the current one
        if (relativeTop <= 100) {
          currentHeading = h.id;
        }
      }

      // Default to first heading if none found
      if (currentHeading) {
        setActiveId(currentHeading);
      } else if (headings.length > 0 && headings[0]) {
        setActiveId(headings[0].id);
      }
    };

    // Initial check
    handleScroll();

    // Listen to scroll events
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [headings, contentRef]);

  // Visibility observer for floating variant
  useEffect(() => {
    if (variant !== 'floating' || !containerRef?.current || headings.length === 0) {
      if (variant !== 'floating') {
        // Defer state update to avoid synchronous setState in effect
        const frameId = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(frameId);
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, headings.length, variant]);

  // Click outside to close dropdown (sticky variant)
  useEffect(() => {
    if (variant !== 'sticky' || isCollapsed) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (stickyWrapperRef.current && !stickyWrapperRef.current.contains(e.target as Node)) {
        setIsCollapsed(true);
      }
    };

    // Use mousedown for immediate response
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant, isCollapsed]);

  // Escape key to close dropdown (sticky variant)
  useEffect(() => {
    if (variant !== 'sticky' || isCollapsed) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCollapsed(true);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [variant, isCollapsed]);

  // Escape key to close sheet (sheet variant)
  useEffect(() => {
    if (variant !== 'sheet' || !isSheetOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSheetOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [variant, isSheetOpen]);

  const handleClick = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (!el) return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Close sheet first, then scroll after animation
      if (variant === 'sheet') {
        setIsSheetOpen(false);
        setTimeout(() => {
          // Use containerRef for scrolling when available - scrollIntoView doesn't work
          // properly when the scroll container is a custom element (not document)
          if (containerRef?.current) {
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            const elementRect = el.getBoundingClientRect();
            const offsetTop = elementRect.top - containerRect.top + container.scrollTop;
            container.scrollTo({
              top: Math.max(0, offsetTop - 16), // 16px padding from top
              behavior: prefersReducedMotion ? 'auto' : 'smooth',
            });
          } else {
            // Fallback to scrollIntoView when no containerRef
            el.scrollIntoView({
              behavior: prefersReducedMotion ? 'auto' : 'smooth',
              block: 'start',
            });
          }
        }, 150);
      } else {
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }

      setActiveId(id);

      // Collapse sticky variant after navigation
      if (variant === 'sticky') {
        setIsCollapsed(true);
      }
    },
    [variant, containerRef]
  );

  // Don't render if not enough headings
  if (headings.length < minHeadings) return null;
  if (variant === 'floating' && !isVisible) return null;

  // Progress calculation
  const activeIndex = headings.findIndex((h) => h.id === activeId);
  const progressPercent =
    headings.length > 1 ? Math.round(((activeIndex + 1) / headings.length) * 100) : 100;

  // Current section for sticky trigger
  const currentSection =
    headings.find((h) => h.id === activeId)?.text || headings[0]?.text || 'Contents';
  const displaySection =
    currentSection.length > 24 ? currentSection.slice(0, 21) + '...' : currentSection;

  // ============================================================================
  // STICKY VARIANT - Capsule at top of content
  // ============================================================================
  if (variant === 'sticky') {
    return (
      <div ref={stickyWrapperRef} className={`toc-sticky-wrapper ${className}`}>
        {/* Collapsed state - pill trigger showing current section */}
        <button
          type="button"
          className={`toc-sticky-trigger ${isCollapsed ? '' : 'expanded'}`}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand table of contents' : 'Collapse table of contents'}
        >
          <div className="toc-sticky-progress">
            <div className="toc-sticky-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="toc-sticky-label">{displaySection}</span>
          {isCollapsed ? (
            <ChevronDown className="toc-sticky-icon" />
          ) : (
            <ChevronUp className="toc-sticky-icon" />
          )}
        </button>

        {/* Expanded dropdown */}
        {!isCollapsed && (
          <nav className="toc-sticky-dropdown" aria-label="Table of contents">
            {title && (
              <div className="toc-sticky-header">
                <span className="toc-sticky-title">{title}</span>
              </div>
            )}
            <ul className="toc-sticky-list">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    onClick={handleClick(h.id)}
                    className={`toc-sticky-link ${h.level === 3 ? 'level-3' : ''} ${activeId === h.id ? 'active' : ''}`}
                  >
                    <span className="toc-sticky-dot" />
                    <span className="toc-sticky-text">{h.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    );
  }

  // ============================================================================
  // SHEET VARIANT - Mobile bottom sheet (pill trigger + slide-up modal)
  // ============================================================================
  if (variant === 'sheet') {
    // Longer truncation for mobile
    const sheetDisplaySection =
      currentSection.length > 28 ? currentSection.slice(0, 25) + '...' : currentSection;

    return (
      <>
        {/* Floating pill trigger - shows progress and current section */}
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className={`stage3-mobile-toc-trigger ${className}`}
          aria-label="Open table of contents"
        >
          <div className="stage3-mobile-toc-progress">
            <div
              className="stage3-mobile-toc-progress-fill"
              style={{ height: `${progressPercent}%` }}
            />
          </div>
          <span className="stage3-mobile-toc-label">{sheetDisplaySection}</span>
          <ChevronDown className="stage3-mobile-toc-icon" />
        </button>

        {/* Bottom sheet drawer - rendered via portal to escape parent stacking contexts */}
        {isSheetOpen &&
          createPortal(
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
            <div
              className="stage3-mobile-outline-overlay"
              onClick={() => setIsSheetOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Table of contents"
            >
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div
                className="stage3-mobile-outline-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="stage3-mobile-sheet-handle" />

                <div className="stage3-mobile-outline-header">
                  <span className="stage3-mobile-outline-title">{title || 'On this page'}</span>
                  <button
                    type="button"
                    onClick={() => setIsSheetOpen(false)}
                    className="stage3-mobile-outline-close"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <ul className="stage3-mobile-outline-list">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        onClick={handleClick(h.id)}
                        className={`stage3-mobile-outline-link ${h.level === 3 ? 'level-3' : ''} ${activeId === h.id ? 'active' : ''}`}
                      >
                        <span className="stage3-mobile-link-indicator" />
                        <span className="stage3-mobile-link-text">{h.text}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  // ============================================================================
  // FLOATING VARIANT - Fixed sidebar (desktop, right edge)
  // ============================================================================
  if (variant === 'floating') {
    return (
      <nav
        ref={tocRef}
        className={`stage3-floating-toc ${isCollapsed ? 'collapsed' : ''} ${className}`}
        aria-label="Table of contents"
      >
        <button
          type="button"
          className="stage3-toc-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          aria-label={isCollapsed ? 'Expand table of contents' : 'Collapse table of contents'}
        >
          {isCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {!isCollapsed && title && (
          <div className="stage3-toc-header">
            <span className="stage3-toc-title">{title}</span>
          </div>
        )}

        <ul className="stage3-toc-list">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={handleClick(h.id)}
                className={`stage3-toc-link ${activeId === h.id ? 'active' : ''}`}
                aria-current={activeId === h.id ? 'location' : undefined}
                title={h.text}
              >
                <span className="stage3-toc-dot" />
                {!isCollapsed && <span className="stage3-toc-text">{h.text}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // ============================================================================
  // INLINE VARIANT - Static list
  // ============================================================================
  return (
    <nav className={`toc-inline ${className}`} aria-label="Table of contents">
      {title && (
        <div className="toc-inline-header">
          <span className="toc-inline-title">{title}</span>
        </div>
      )}
      <ul className="toc-inline-list">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={handleClick(h.id)}
              className={`toc-inline-link ${h.level === 3 ? 'level-3' : ''} ${activeId === h.id ? 'active' : ''}`}
            >
              <span className="toc-inline-dot" />
              <span className="toc-inline-text">{h.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default TableOfContents;
