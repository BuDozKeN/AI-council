import * as React from "react"
import { cn } from "@/lib/utils"
import "./Skeleton.css"

/**
 * Skeleton - Animated placeholder for loading states
 *
 * Creates a shimmering placeholder that matches the shape of content being loaded.
 * This is the modern, premium approach used by GitHub, Notion, Linear, etc.
 *
 * Usage:
 * <Skeleton className="h-4 w-32" />           // Text line
 * <Skeleton className="h-10 w-full" />        // Full width input
 * <Skeleton variant="circular" size={40} />   // Avatar
 *
 * @param {string} variant - "rectangular" (default), "circular", "text"
 * @param {number} width - Width in pixels (or use className)
 * @param {number} height - Height in pixels (or use className)
 * @param {string} className - Additional CSS classes (supports Tailwind w-*, h-*)
 */
const Skeleton = React.forwardRef(({
  variant = "rectangular",
  width,
  height,
  className,
  style,
  ...props
}, ref) => {
  const variantClass = {
    rectangular: "skeleton-rectangular",
    circular: "skeleton-circular",
    text: "skeleton-text"
  }

  const inlineStyle = {
    ...style,
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  }

  return (
    <div
      ref={ref}
      className={cn("skeleton", variantClass[variant], className)}
      style={Object.keys(inlineStyle).length ? inlineStyle : undefined}
      aria-hidden="true"
      {...props}
    />
  )
})

Skeleton.displayName = "Skeleton"

/**
 * SkeletonText - Multiple lines of skeleton text
 *
 * @param {number} lines - Number of lines to show
 * @param {string} className - Additional CSS classes for each line
 */
const SkeletonText = ({ lines = 3, className, ...props }) => (
  <div className="skeleton-text-block" {...props}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={cn(
          // Last line is shorter for natural look
          i === lines - 1 ? "skeleton-text-short" : "",
          className
        )}
      />
    ))}
  </div>
)

SkeletonText.displayName = "SkeletonText"

export { Skeleton, SkeletonText }
