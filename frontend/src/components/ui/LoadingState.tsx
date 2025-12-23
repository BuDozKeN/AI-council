import * as React from "react"
import { Spinner } from "./Spinner"
import { cn } from "@/lib/utils"
import "./LoadingState.css"

/**
 * Unified LoadingState component for consistent loading UI across the app.
 *
 * @param {string} message - Optional loading message to display
 * @param {string} size - Spinner size: "sm", "md", "lg", "xl" (default: "lg")
 * @param {string} variant - Spinner color variant (default: "default")
 * @param {string} className - Additional CSS classes
 */
const LoadingState = React.forwardRef(({
  message,
  size = "lg",
  variant = "default",
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("loading-state", className)}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Spinner size={size} variant={variant} label={message || "Loading"} />
      {message && (
        <p className="loading-state-message">{message}</p>
      )}
    </div>
  )
})

LoadingState.displayName = "LoadingState"

export { LoadingState }
