/**
 * StickyHeader - Self-contained sticky header wrapper
 *
 * Manages its own positioning to cover scrolling content.
 * Uses a full-width background layer that extends beyond the content area.
 */

import { ReactNode } from 'react';
import './StickyHeader.css';

interface StickyHeaderProps {
  children: ReactNode;
  className?: string;
}

export function StickyHeader({ children, className = '' }: StickyHeaderProps) {
  return (
    <div className={`sticky-header ${className}`}>
      {/* Background layer - extends full width to cover scrolling content */}
      <div className="sticky-header-bg" aria-hidden="true" />
      {/* Content layer - matches reading column width */}
      <div className="sticky-header-content">{children}</div>
    </div>
  );
}
