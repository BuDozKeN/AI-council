import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import './PullToRefreshIndicator.css';

interface PullToRefreshIndicatorProps {
  progress?: number;
  isRefreshing?: boolean;
  pullDistance?: number;
}

/**
 * PullToRefreshIndicator - Visual indicator for pull-to-refresh gesture
 *
 * @param {Object} props
 * @param {number} props.progress - Pull progress 0 to 1
 * @param {boolean} props.isRefreshing - Whether refresh is in progress
 * @param {number} props.pullDistance - Current pull distance in px
 */
export function PullToRefreshIndicator({
  progress = 0,
  isRefreshing = false,
  pullDistance = 0,
}: PullToRefreshIndicatorProps) {
  // Don't render if not pulling and not refreshing
  if (progress === 0 && !isRefreshing) {
    return null;
  }

  return (
    <motion.div
      className={`pull-refresh-indicator ${isRefreshing ? 'refreshing' : ''}`}
      style={{
        transform: `translateY(${Math.min(pullDistance - 40, 40)}px)`,
        opacity: Math.min(progress * 1.5, 1),
      }}
    >
      <motion.div
        className="pull-refresh-icon"
        style={isRefreshing ? {} : { rotate: progress * 180 }}
        animate={isRefreshing ? { rotate: 360 } : {}}
        transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
      >
        <RefreshCw size={20} />
      </motion.div>
      <span className="pull-refresh-text">
        {isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
      </span>
    </motion.div>
  );
}

export default PullToRefreshIndicator;
