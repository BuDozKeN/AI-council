import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { hapticImpact, hapticLight } from '../../lib/haptics';
import './SwipeableRow.css';

/**
 * SwipeableRow - A row component that reveals actions on swipe
 *
 * Swipe left to reveal action buttons (like iOS Mail)
 * Supports multiple actions with different colors
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Row content
 * @param {Array} props.actions - Array of action objects: { label, icon, onClick, variant }
 * @param {Function} props.onClick - Click handler for the row
 * @param {string} props.className - Additional class name
 * @param {boolean} props.disabled - Whether swipe is disabled
 */
export function SwipeableRow({
  children,
  actions = [],
  onClick,
  className = '',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef(null);
  const x = useMotionValue(0);

  // Calculate action area width based on number of actions
  const actionWidth = actions.length * 70; // 70px per action button
  const threshold = actionWidth * 0.5; // 50% of action width to snap open

  // Transform for action button opacity
  const actionOpacity = useTransform(x, [-actionWidth, -threshold, 0], [1, 0.8, 0]);

  // Handle drag end
  const handleDragEnd = useCallback((_, info) => {
    setIsSwiping(false);
    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;

    // Snap open if dragged past threshold or with velocity
    if (offsetX < -threshold || velocityX < -500) {
      animate(x, -actionWidth, { type: 'spring', stiffness: 500, damping: 30 });
      setIsOpen(true);
      hapticImpact();
    } else {
      // Snap closed
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
      setIsOpen(false);
    }
  }, [actionWidth, threshold, x]);

  // Handle drag start
  const handleDragStart = useCallback(() => {
    setIsSwiping(true);
    hapticLight();
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
        setIsOpen(false);
      }
    };

    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, x]);

  // Close on action click
  const handleActionClick = useCallback((action) => {
    hapticLight();
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    setIsOpen(false);
    action.onClick?.();
  }, [x]);

  // Handle row click (only if not swiping)
  const handleRowClick = useCallback((e) => {
    if (isSwiping || isOpen) {
      if (isOpen) {
        animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
        setIsOpen(false);
      }
      return;
    }
    onClick?.(e);
  }, [isSwiping, isOpen, onClick, x]);

  if (disabled || actions.length === 0) {
    // No swipe behavior if disabled or no actions
    return (
      <div className={`swipeable-row ${className}`} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`swipeable-row-container ${className}`}>
      {/* Action buttons (behind the content) */}
      <motion.div
        className="swipeable-row-actions"
        style={{ opacity: actionOpacity, width: actionWidth }}
      >
        {actions.map((action, index) => (
          <button
            key={index}
            className={`swipeable-action ${action.variant || 'default'}`}
            onClick={() => handleActionClick(action)}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Draggable content */}
      <motion.div
        className="swipeable-row-content"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleRowClick}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default SwipeableRow;
