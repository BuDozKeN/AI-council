import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import "./ErrorState.css"

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Unified ErrorState component for consistent error UI across the app.
 *
 * @param {string} title - Error heading (default: "Something went wrong")
 * @param {string} message - Error description or message
 * @param {function} onRetry - Optional retry callback
 * @param {string} retryLabel - Retry button text (default: "Try again")
 * @param {string} className - Additional CSS classes
 */
const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(({
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="error-state-retry"
        >
          <RefreshCw size={14} />
          {retryLabel}
        </Button>
      )}
    </div>
  )
})

ErrorState.displayName = "ErrorState"

export { ErrorState }
export type { ErrorStateProps }
