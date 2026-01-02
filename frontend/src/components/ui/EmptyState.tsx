import * as React from "react"
import { Inbox, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import "./EmptyState.css"

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
 * // Large variant with hints (for chat welcome)
 * <EmptyState
 *   variant="large"
 *   icon={Clock}
 *   title="Ask the Council"
 *   message="5 AI advisors will debate your question"
 *   hints={["Try: 'What's the best approach to...'", "Paste images with Ctrl+V"]}
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
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(({
  icon: Icon = Inbox,
  customIcon,
  title,
  message,
  action,
  className,
  variant = 'default',
  hints,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("empty-state", variant === 'large' && "empty-state-large", className)}
      {...props}
    >
      {customIcon ? (
        <div className="empty-state-icon empty-state-icon-custom">
          {customIcon}
        </div>
      ) : (
        <div className="empty-state-icon">
          <Icon size={variant === 'large' ? 32 : 24} strokeWidth={1.5} />
        </div>
      )}
      {title && (
        <h3 className="empty-state-title">{title}</h3>
      )}
      {message && (
        <p className="empty-state-message">{message}</p>
      )}
      {hints && hints.length > 0 && (
        <div className="empty-state-hints">
          {hints.map((hint, i) => (
            <span key={i} className="empty-state-hint">{hint}</span>
          ))}
        </div>
      )}
      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}
    </div>
  )
})

EmptyState.displayName = "EmptyState"

export { EmptyState }
export type { EmptyStateProps }
