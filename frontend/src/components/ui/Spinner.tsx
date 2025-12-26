import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import "./Spinner.css"

type SpinnerSizeName = "xs" | "sm" | "md" | "lg" | "xl";
type SpinnerSize = SpinnerSizeName | number;
type SpinnerVariant = "default" | "success" | "brand" | "muted";

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** "xs" (12px), "sm" (16px), "md" (20px), "lg" (32px), "xl" (40px), or a number for custom size */
  size?: SpinnerSize;
  /** "default" (blue), "success" (green), "brand" (indigo), "muted" (gray) */
  variant?: SpinnerVariant;
  /** Screen reader text (default: "Loading") */
  label?: string;
}

/**
 * Unified Spinner component for consistent loading states across the app.
 */
const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(({
  size = "md",
  variant = "default",
  label = "Loading",
  className,
  style,
  ...props
}, ref) => {
  const sizeClasses: Record<SpinnerSizeName, string> = {
    xs: "spinner-xs",
    sm: "spinner-sm",
    md: "spinner-md",
    lg: "spinner-lg",
    xl: "spinner-xl"
  }

  // Handle numeric sizes with inline style
  const isNumericSize = typeof size === 'number';
  const sizeClass = isNumericSize ? '' : sizeClasses[size as SpinnerSizeName];
  const sizeStyle = isNumericSize ? { width: size, height: size, ...style } : style;

  const variantClasses: Record<SpinnerVariant, string> = {
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
      className={cn("spinner", sizeClass, variantClasses[variant], className)}
      style={sizeStyle}
      {...props}
    >
      <Loader2 className="spinner-icon" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
})

Spinner.displayName = "Spinner"

export { Spinner }
export type { SpinnerProps, SpinnerSize, SpinnerSizeName, SpinnerVariant }