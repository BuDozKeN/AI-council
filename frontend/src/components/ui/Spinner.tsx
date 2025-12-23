import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import "./Spinner.css"

/**
 * Unified Spinner component for consistent loading states across the app.
 *
 * @param {string} size - "sm" (16px), "md" (20px), "lg" (32px), "xl" (40px)
 * @param {string} variant - "default" (blue), "success" (green), "brand" (indigo), "muted" (gray)
 * @param {string} label - Screen reader text (default: "Loading")
 * @param {string} className - Additional CSS classes
 */
const Spinner = React.forwardRef(({
  size = "md",
  variant = "default",
  label = "Loading",
  className,
  ...props
}, ref) => {
  const sizeClasses = {
    sm: "spinner-sm",
    md: "spinner-md",
    lg: "spinner-lg",
    xl: "spinner-xl"
  }

  const variantClasses = {
    default: "spinner-default",
    success: "spinner-success",
    brand: "spinner-brand",
    muted: "spinner-muted"
  }

  return (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn("spinner", sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      <Loader2 className="spinner-icon" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
})

Spinner.displayName = "Spinner"

export { Spinner }