/**
 * OverviewTab - Company overview with stats and business context
 *
 * Shows:
 * - Company hero section with title and description
 * - Stats grid (departments, roles, playbooks, decisions)
 * - Business context document preview
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { Building2 } from 'lucide-react';
import MarkdownViewer from '../../MarkdownViewer';
import { formatDate } from '../../../lib/dateUtils';

// Parse metadata from context markdown (Last Updated, Version)
function parseContextMetadata(contextMd) {
  if (!contextMd) return { lastUpdated: null, version: null };

  // Look for patterns like "> **Last Updated:** 2025-12-16" and "> **Version:** 1.2"
  const lastUpdatedMatch = contextMd.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  const versionMatch = contextMd.match(/\*\*Version:\*\*\s*([\d.]+)/);

  return {
    lastUpdated: lastUpdatedMatch ? formatDate(lastUpdatedMatch[1] + 'T00:00:00') : null,
    version: versionMatch ? versionMatch[1] : null
  };
}

export function OverviewTab({
  overview,
  companyName,
  onEditContext,
  onViewContext
}) {
  if (!overview) {
    return (
      <div className="mc-empty">
        <Building2 size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">No company data</p>
        <p className="mc-empty-hint">Company information will appear here</p>
      </div>
    );
  }

  const contextMd = overview.company?.context_md || '';
  const { lastUpdated, version } = parseContextMetadata(contextMd);

  return (
    <div className="mc-overview">
      {/* Hero section - immediately explains what this is */}
      <div className="mc-overview-hero">
        <div className="mc-overview-hero-content">
          <h2 className="mc-overview-title">{companyName} Business Context</h2>
          <p className="mc-overview-description">
            This document defines your company's mission, goals, constraints, and strategic decisions.
            When selected, it's injected into Council conversations to provide relevant, contextual advice.
          </p>
        </div>
        <div className="mc-overview-meta">
          {lastUpdated && (
            <div className="mc-meta-item">
              <span className="mc-meta-label">Last Updated</span>
              <span className="mc-meta-value">{lastUpdated}</span>
            </div>
          )}
          {version && (
            <div className="mc-meta-item">
              <span className="mc-meta-label">Version</span>
              <span className="mc-meta-value">{version}</span>
            </div>
          )}
          <button
            className="mc-btn primary small"
            onClick={() => onEditContext && onEditContext({
              id: overview.company?.id,
              context_md: contextMd
            })}
          >
            Edit Context
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mc-stats-grid">
        <div className="mc-stat-card">
          <div className="mc-stat-value">{overview.stats?.departments || 0}</div>
          <div className="mc-stat-label">Departments</div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value">{overview.stats?.roles || 0}</div>
          <div className="mc-stat-label">Roles</div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value">{overview.stats?.playbooks || 0}</div>
          <div className="mc-stat-label">Playbooks</div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value">{overview.stats?.decisions || 0}</div>
          <div className="mc-stat-label">Decisions</div>
        </div>
      </div>

      {/* Context content */}
      <div className="mc-context-section">
        <div className="mc-context-section-header">
          <h3>Document Preview</h3>
          {contextMd && (
            <button
              className="mc-expand-btn"
              onClick={() => onViewContext && onViewContext({
                id: overview.company?.id,
                context_md: contextMd
              })}
              title="Expand"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5.414l4.293 4.293a1 1 0 01-1.414 1.414L4 6.414V9a1 1 0 01-2 0V4zm9 1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 11-2 0V6.414l-4.293 4.293a1 1 0 01-1.414-1.414L14.586 5H12a1 1 0 01-1-1zm-9 10a1 1 0 011-1h2.586l4.293-4.293a1 1 0 011.414 1.414L8.414 15H11a1 1 0 110 2H4a1 1 0 01-1-1v-5z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <div className="mc-context-content">
          {contextMd ? (
            <MarkdownViewer content={contextMd} />
          ) : (
            <div className="mc-empty-context">
              <p className="mc-empty-title">No business context defined yet</p>
              <p className="mc-empty-hint">Click "Edit Context" above to add your company's mission, goals, strategy, and other important information that the AI Council should know.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
