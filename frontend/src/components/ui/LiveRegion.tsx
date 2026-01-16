/**
 * LiveRegion - Accessible announcements for screen readers
 *
 * Use this component to announce dynamic content changes to screen reader users.
 * The content is visually hidden but announced by assistive technology.
 *
 * @example
 * // Polite announcement (non-urgent)
 * <LiveRegion>{isLoading ? 'Loading responses...' : `${count} responses received`}</LiveRegion>
 *
 * // Assertive announcement (urgent, like errors)
 * <LiveRegion politeness="assertive">{error}</LiveRegion>
 *
 * // Atomic announcement (announce whole region, not just changes)
 * <LiveRegion atomic>{`Stage ${stage}: ${status}`}</LiveRegion>
 */

import './LiveRegion.css';

interface LiveRegionProps {
  children: React.ReactNode;
  /**
   * How assertive the announcement should be:
   * - "polite" (default): Waits for pause in speech, good for status updates
   * - "assertive": Interrupts current speech, use for errors/urgent messages
   * - "off": Don't announce (useful for conditional announcements)
   */
  politeness?: 'polite' | 'assertive' | 'off';
  /**
   * Whether to announce the entire region (true) or just the changed part (false).
   * Use true for status messages that need full context.
   */
  atomic?: boolean;
  /**
   * Optional CSS class for styling (though content is visually hidden)
   */
  className?: string;
}

export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = false,
  className = '',
}: LiveRegionProps) {
  return (
    <div
      className={`live-region ${className}`}
      aria-live={politeness}
      aria-atomic={atomic}
      role="status"
    >
      {children}
    </div>
  );
}
