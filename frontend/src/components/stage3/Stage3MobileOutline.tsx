import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface Stage3MobileOutlineProps {
  contentRef: React.RefObject<HTMLElement | null>;
  isStreamingComplete?: boolean;
}

export function Stage3MobileOutline({ contentRef, isStreamingComplete = true }: Stage3MobileOutlineProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!contentRef.current || !isStreamingComplete) return;

    const elements = Array.from(
      contentRef.current.querySelectorAll('h2, h3')
    );

    const items: Heading[] = elements.map((el) => {
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
        level: el.tagName === 'H2' ? 2 : 3,
      };
    });

    if (items.length < 2) {
      setHeadings([]);
    } else {
      setHeadings(items);
      // Set first heading as active by default
      if (items.length > 0) {
        setActiveId(items[0].id);
      }
    }
  }, [contentRef, isStreamingComplete]);

  // Scroll spy to track active section
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
      { rootMargin: '-20% 0px -70% 0px' }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings, contentRef]);

  const handleClick = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  if (headings.length === 0) return null;

  // Get current section name for the trigger
  const currentSection = headings.find(h => h.id === activeId)?.text || headings[0]?.text || 'Contents';
  // Truncate if too long
  const displaySection = currentSection.length > 28
    ? currentSection.slice(0, 25) + '...'
    : currentSection;

  // Calculate progress through document
  const activeIndex = headings.findIndex(h => h.id === activeId);
  const progressPercent = headings.length > 1
    ? Math.round(((activeIndex + 1) / headings.length) * 100)
    : 0;

  return (
    <>
      {/* Floating pill trigger - shows progress and current section */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="stage3-mobile-toc-trigger"
        aria-label="Open table of contents"
      >
        <div className="stage3-mobile-toc-progress">
          <div
            className="stage3-mobile-toc-progress-fill"
            style={{ height: `${progressPercent}%` }}
          />
        </div>
        <span className="stage3-mobile-toc-label">{displaySection}</span>
        <ChevronDown className="stage3-mobile-toc-icon" />
      </button>

      {/* Bottom sheet drawer */}
      {open && (
        <div
          className="stage3-mobile-outline-overlay"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Table of contents"
        >
          <div
            className="stage3-mobile-outline-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="stage3-mobile-sheet-handle" />

            <div className="stage3-mobile-outline-header">
              <span className="stage3-mobile-outline-title">On this page</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
        </div>
      )}
    </>
  );
}

export default Stage3MobileOutline;
