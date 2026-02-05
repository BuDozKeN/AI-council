/**
 * Admin Shared UI Components
 *
 * Skeleton loading components and pagination used across
 * multiple admin tab components.
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// =============================================================================
// Skeleton Loading Components
// =============================================================================

/** Skeleton cell with icon + text */
export const SkeletonCell = ({ short = false }: { short?: boolean }) => (
  <td>
    <div className="admin-skeleton-cell">
      <div className="admin-table-skeleton admin-table-skeleton--icon" />
      <div
        className={`admin-table-skeleton admin-table-skeleton--text ${short ? 'admin-table-skeleton--short' : ''}`}
      />
    </div>
  </td>
);

/** Skeleton badge (status, role) */
export const SkeletonBadge = () => (
  <td>
    <div className="admin-table-skeleton admin-table-skeleton--badge" />
  </td>
);

/** Skeleton action buttons */
export const SkeletonActions = ({ count = 2 }: { count?: number }) => (
  <td>
    <div className="admin-skeleton-actions">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="admin-table-skeleton admin-table-skeleton--btn" />
      ))}
    </div>
  </td>
);

// =============================================================================
// Pagination Component
// =============================================================================

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        {t(
          'admin.pagination.showing',
          'Showing page {{page}} of {{totalPages}} ({{total}} total)',
          {
            page,
            totalPages,
            total,
          }
        )}
      </span>
      <div className="admin-pagination-buttons">
        <button
          className="admin-pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          {t('admin.pagination.prev', 'Previous')}
        </button>
        <button
          className="admin-pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('admin.pagination.next', 'Next')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
