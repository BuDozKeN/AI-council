import * as React from "react"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import "./EmptyState.css"

/**
 * Unified EmptyState component for consistent empty UI across the app.
 *
 * @param {React.ComponentType} icon - Lucide icon component (default: Inbox)
 * @param {string} title - Main heading text
 * @param {string} message - Secondary descriptive text
 * @param {React.ReactNode} action - Optional action button/element
 * @param {string} className - Additional CSS classes
 */
const EmptyState = React.forwardRef(({
  icon: Icon = Inbox,
  title,
  message,
  action,
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("empty-state", className)}
      {...props}
    >
      <div className="empty-state-icon">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      {title && (
        <h3 className="empty-state-title">{title}</h3>
      )}
      {message && (
        <p className="empty-state-message">{message}</p>
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
