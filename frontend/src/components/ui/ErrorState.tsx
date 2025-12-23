import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import "./ErrorState.css"

/**
 * Unified ErrorState component for consistent error UI across the app.
 *
 * @param {string} title - Error heading (default: "Something went wrong")
 * @param {string} message - Error description or message
 * @param {function} onRetry - Optional retry callback
 * @param {string} retryLabel - Retry button text (default: "Try again")
 * @param {string} className - Additional CSS classes
 */
const ErrorState = React.forwardRef(({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("error-state", className)}
      role="alert"
      {...props}
    >
      <div className="error-state-icon">
        <AlertCircle size={24} strokeWidth={1.5} />
      </div>
      <h3 className="error-state-title">{title}</h3>
      {message && (
        <p className="error-state-message">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          className="error-state-retry"
          onClick={onRetry}
        >
          <RefreshCw size={14} />
          {retryLabel}
        </button>
      )}
    </div>
  )
})

ErrorState.displayName = "ErrorState"

export { ErrorState }
