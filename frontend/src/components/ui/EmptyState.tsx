import * as React from 'react';
import { Inbox, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import './EmptyState.css';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon component (default: Inbox) */
  icon?: LucideIcon;
  /** Custom icon element - use this for non-Lucide icons (overrides icon prop) */
  customIcon?: React.ReactNode;
  /** Main heading text */
  title?: string;
  /** Secondary descriptive text */
  message?: React.ReactNode;
  /** Optional action button/element */
  action?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Size variant: 'default' for subtle, 'large' for prominent (chat welcome) */
  variant?: 'default' | 'large';
  /** Optional hints displayed below the message */
  hints?: string[];
}

/**
 * Unified EmptyState component for consistent empty UI across the app.
 *
 * Supports two variants:
 * - 'default': Subtle empty state for lists, panels (smaller icon, text)
 * - 'large': Prominent empty state for welcome screens (larger icon, text)
 *
 * @example
 * // Default variant (for lists/panels)
 * <EmptyState
 *   icon={FileText}
 *   title="No documents"
 *   message="Upload your first document"
 * />
 *
 * @example
 * // Large variant with hints
 * <EmptyState
 *   variant="large"
 *   icon={Clock}
 *   title="No data yet"
 *   message="Get started by creating your first item"
 *   hints={["Click the + button above", "Or drag and drop a file"]}
 * />
 *
 * @example
 * // Custom icon (for branded welcome)
 * <EmptyState
 *   variant="large"
 *   customIcon={<div className="branded-icon">AX</div>}
 *   title="Welcome to AxCouncil"
 * />
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon: Icon = Inbox,
      customIcon,
      title,
      message,
      action,
      className,
      variant = 'default',
      hints,
      ...props
    },
    ref
  ) => {
    // Premium entrance animation - fade + slide up with stagger
    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.08,
          delayChildren: 0.05,
        },
      },
    };

    const itemVariants = {
      hidden: { opacity: 0, y: 12 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          type: 'spring' as const,
          stiffness: 300,
          damping: 24,
        },
      },
    };

    return (
      <motion.div
        ref={ref}
        className={cn('empty-state', variant === 'large' && 'empty-state-large', className)}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        {...(props as any)}
      >
        <motion.div variants={itemVariants}>
          {customIcon ? (
            <div className="empty-state-icon empty-state-icon-custom">{customIcon}</div>
          ) : (
            <div className="empty-state-icon">
              <Icon size={variant === 'large' ? 32 : 24} strokeWidth={1.5} />
            </div>
          )}
        </motion.div>

        {title && (
          <motion.h3 className="empty-state-title" variants={itemVariants}>
            {title}
          </motion.h3>
        )}

        {message && (
          <motion.p className="empty-state-message" variants={itemVariants}>
            {message}
          </motion.p>
        )}

        {hints && hints.length > 0 && (
          <motion.div className="empty-state-hints" variants={itemVariants}>
            {hints.map((hint, i) => (
              <span key={i} className="empty-state-hint">
                {hint}
              </span>
            ))}
          </motion.div>
        )}

        {action && (
          <motion.div className="empty-state-action" variants={itemVariants}>
            {action}
          </motion.div>
        )}
      </motion.div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState };
export type { EmptyStateProps };
