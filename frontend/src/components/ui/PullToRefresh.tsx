import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import './PullToRefresh.css';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold?: number;
  isRefreshing: boolean;
  progress?: number;
}

/**
 * PullToRefreshIndicator - Visual indicator for pull-to-refresh gesture
 *
 * @param {Object} props
 * @param {number} props.pullDistance - Current pull distance in px
 * @param {number} props.threshold - Distance required to trigger refresh
 * @param {boolean} props.isRefreshing - Whether refresh is in progress
 * @param {number} props.progress - Pull progress from 0 to 1
 */
export function PullToRefreshIndicator({
  pullDistance,
  threshold = 80,
  isRefreshing,
  progress = 0,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const rotation = progress * 180;
  const opacity = Math.min(progress * 1.5, 1);
  const scale = 0.5 + progress * 0.5;
  const isReady = progress >= 1;

  return (
    <motion.div
      className="pull-to-refresh-indicator"
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity,
        y: Math.min(pullDistance, threshold) - 40,
      }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <motion.div
        className={`pull-refresh-icon ${isRefreshing ? 'refreshing' : ''} ${isReady ? 'ready' : ''}`}
        animate={{
          rotate: isRefreshing ? 360 : rotation,
          scale: isRefreshing ? 1 : scale,
        }}
        transition={{
          rotate: isRefreshing
            ? { duration: 1, repeat: Infinity, ease: 'linear' }
            : { type: 'spring', damping: 15 },
          scale: { type: 'spring', damping: 15 },
        }}
      >
        <RefreshCw size={20} />
      </motion.div>
      <span className="pull-refresh-text">
        {isRefreshing ? 'Refreshing...' : isReady ? 'Release to refresh' : 'Pull to refresh'}
      </span>
    </motion.div>
  );
}

export default PullToRefreshIndicator;
