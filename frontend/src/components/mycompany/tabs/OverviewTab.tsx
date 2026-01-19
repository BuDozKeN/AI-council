/**
 * OverviewTab - Company overview with stats and business context
 *
 * Shows:
 * - Company hero section with title and description
 * - Business context document preview with sticky TOC
 *
 * Layout pattern:
 * - .mc-overview is the single scroll container (flex: 1, overflow-y: auto)
 * - Hero and context card flow naturally inside and scroll together
 * - Sticky toolbar inside context card for TOC + copy button
 */

import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Pencil, ChevronUp, Sparkles } from 'lucide-react';
import MarkdownViewer from '../../MarkdownViewer';
import { TableOfContents } from '../../ui/TableOfContents';
import { CopyButton } from '../../ui/CopyButton';
import { Button } from '../../ui/button';
import { formatDate } from '../../../lib/dateUtils';

interface CompanyOverview {
  company?: {
    id?: string;
    context_md?: string;
    [key: string]: unknown;
  };
  stats?: {
    departments?: number;
    roles?: number;
    playbooks?: number;
    decisions?: number;
    conversations?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface OverviewTabProps {
  overview?: CompanyOverview | null | undefined;
  companyName?: string | undefined;
  onEditContext?: ((data: Record<string, unknown>) => void) | undefined;
  onViewContext?: ((data: Record<string, unknown>) => void) | undefined;
  onGenerateContext?: (() => void) | undefined;
}

// Parse metadata from context markdown (Last Updated, Version)
function parseContextMetadata(contextMd: string | undefined): {
  lastUpdated: string | null;
  version: string | null;
} {
  if (!contextMd) return { lastUpdated: null, version: null };

  const lastUpdatedMatch = contextMd.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  const versionMatch = contextMd.match(/\*\*Version:\*\*\s*([\d.]+)/);

  return {
    lastUpdated: lastUpdatedMatch?.[1] ? formatDate(lastUpdatedMatch[1] + 'T00:00:00') : null,
    version: versionMatch?.[1] ?? null,
  };
}

export function OverviewTab({
  overview,
  companyName,
  onEditContext,
  onGenerateContext,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track scroll position to show/hide scroll-to-top button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 200);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!overview) {
    return (
      <div className="mc-empty">
        <Building2 size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">{t('mycompany.noCompanyData')}</p>
        <p className="mc-empty-hint">{t('mycompany.companyInfoAppear')}</p>
      </div>
    );
  }

  const contextMd = overview.company?.context_md || '';
  const { lastUpdated, version } = parseContextMetadata(contextMd);

  return (
    <div ref={scrollContainerRef} className="mc-overview" onScroll={handleScroll}>
      {/* Hero section - scrolls with content */}
      <div className="mc-overview-hero">
        <div className="mc-overview-hero-content">
          <h2 className="mc-overview-title">
            {t('mycompany.businessContext', { name: companyName })}
          </h2>
          <p className="mc-overview-description">{t('mycompany.businessContextDesc')}</p>
        </div>
        <div className="mc-overview-hero-right">
          <div className="mc-overview-meta">
            {lastUpdated && (
              <div className="mc-meta-item">
                <span className="mc-meta-label">{t('mycompany.lastUpdated')}</span>
                <span className="mc-meta-value">{lastUpdated}</span>
              </div>
            )}
            {version && (
              <div className="mc-meta-item">
                <span className="mc-meta-label">{t('mycompany.version')}</span>
                <span className="mc-meta-value">{version}</span>
              </div>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              onEditContext &&
              onEditContext({
                id: overview.company?.id,
                context_md: contextMd,
              })
            }
          >
            <Pencil size={16} />
            {t('mycompany.edit')}
          </Button>
        </div>
      </div>

      {/* Context card - scrolls with content */}
      <div className="mc-context-card">
        {/* Sticky toolbar - sticks to top when scrolling */}
        {contextMd && (
          <div className="mc-context-sticky-toolbar">
            <TableOfContents
              variant="sheet"
              contentRef={contentRef}
              containerRef={scrollContainerRef}
              title={`${companyName} Context`}
              headingLevels={['h2']}
              minHeadings={2}
              className="mc-mobile-toc"
            />
            <TableOfContents
              variant="sticky"
              contentRef={contentRef}
              containerRef={scrollContainerRef}
              title={`${companyName} Context`}
              headingLevels={['h2']}
              minHeadings={2}
              className="mc-desktop-toc"
            />
            <CopyButton
              text={contextMd}
              size="sm"
              className="mc-context-copy-btn"
              tooltip={t('mycompany.copyBusinessContext', 'Copy business context')}
            />
          </div>
        )}

        {/* Content */}
        <div ref={contentRef} className="mc-context-content">
          {contextMd ? (
            <MarkdownViewer content={contextMd} />
          ) : (
            <div className="mc-empty-context">
              <Sparkles size={32} className="mc-empty-context-icon" />
              <p className="mc-empty-context-title">{t('mycompany.noContextYet')}</p>
              <p className="mc-empty-context-hint">{t('mycompany.noContextHint')}</p>
              {onGenerateContext && (
                <Button
                  variant="default"
                  size="default"
                  onClick={onGenerateContext}
                  className="mc-generate-context-btn"
                >
                  <Sparkles size={16} />
                  {t('mycompany.generateWithAI', 'Generate with AI')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll to top button - bottom right, vertically aligned with copy button */}
      {showScrollTop && (
        <button
          className="mc-scroll-top-fab"
          onClick={scrollToTop}
          aria-label={t('mycompany.scrollToTop')}
        >
          <ChevronUp size={16} />
        </button>
      )}
    </div>
  );
}
