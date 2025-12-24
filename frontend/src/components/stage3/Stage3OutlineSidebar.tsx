import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
}

interface Stage3OutlineSidebarProps {
  contentRef: React.RefObject<HTMLElement | HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLElement | HTMLDivElement | null>;
  isStreamingComplete?: boolean;
  title?: string;
}

export function Stage3OutlineSidebar({ contentRef, containerRef, isStreamingComplete = true, title }: Stage3OutlineSidebarProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const tocRef = useRef<HTMLElement>(null);

  // Extract H2 headings only once content is rendered and streaming is complete
  useEffect(() => {
    if (!contentRef.current || !isStreamingComplete) return;

    // Small delay to ensure markdown has rendered
    const timer = setTimeout(() => {
      if (!contentRef.current) return;

      // Only get H2 headings for minimal TOC
      const elements = Array.from(
        contentRef.current.querySelectorAll('h2')
      );

      const items: Heading[] = elements.map((el) => {
        // Ensure each heading has an ID
        if (!el.id) {
          const slug = el.textContent
            ?.toLowerCase()
            .replace(/[^\w]+/g, '-')
            .replace(/^-+|-+$/g, '');
          el.id = slug || `section-${Math.random().toString(36).slice(2, 8)}`;
        }

        return {
          id: el.id,
          text: el.textContent || '',
        };
      });

      // Show outline if there's at least 1 heading
      setHeadings(items);
    }, 100);

    return () => clearTimeout(timer);
  }, [contentRef, isStreamingComplete]);

  // Scroll-spy using IntersectionObserver
  useEffect(() => {
    if (!contentRef.current || headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '0px 0px -70% 0px' } // Activates when heading enters top 30%
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings, contentRef]);

  // Visibility observer - only show TOC when this Stage 3 is in viewport
  useEffect(() => {
    if (!containerRef.current || headings.length === 0) {
      setIsVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Show TOC when Stage 3 container is even partially visible
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0 } // Trigger as soon as any part is visible
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, headings.length]);

  const handleClick = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    setActiveId(id);
  }, []);

  // Handle container click - expand if collapsed
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only expand when collapsed and clicking on container (not toggle button)
    if (isCollapsed && !(e.target as HTMLElement).closest('.stage3-toc-toggle')) {
      setIsCollapsed(false);
    }
  }, [isCollapsed]);

  // Don't render if no headings or Stage 3 not visible
  if (headings.length === 0) return null;
  if (!isVisible) return null;

  return (
    <nav
      ref={tocRef}
      className={`stage3-floating-toc ${isCollapsed ? 'collapsed' : ''}`}
      aria-label="Table of contents"
      onClick={handleContainerClick}
    >
      {/* Collapse toggle button */}
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

      {/* Title header - shows Stage 3 title */}
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

export default Stage3OutlineSidebar;
