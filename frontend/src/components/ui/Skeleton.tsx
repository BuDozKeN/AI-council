import * as React from "react"
import { cn } from "@/lib/utils"
import "./Skeleton.css"

type SkeletonVariant = "rectangular" | "circular" | "text";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
}

interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

interface MessageSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "assistant" | "user";
}

interface CountProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

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
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(({
  variant = "rectangular",
  width,
  height,
  className,
  style,
  ...props
}, ref) => {
  const variantClass: Record<SkeletonVariant, string> = {
    rectangular: "skeleton-rectangular",
    circular: "skeleton-circular",
    text: "skeleton-text"
  }

  const inlineStyle: React.CSSProperties = {
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
const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3, className, ...props }) => (
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

/**
 * MessageSkeleton - Loading placeholder for chat messages
 *
 * @param {string} variant - "assistant" (default) or "user"
 */
const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ variant = "assistant", ...props }) => (
  <div className={cn("skeleton-message", variant)} {...props}>
    <div className="skeleton-message-header">
      <Skeleton className="skeleton-message-avatar" />
      <Skeleton className="skeleton-message-label" />
    </div>
    <div className="skeleton-message-content">
      <Skeleton className="skeleton-message-line" />
      <Skeleton className="skeleton-message-line" />
      <Skeleton className="skeleton-message-line" />
    </div>
  </div>
)

MessageSkeleton.displayName = "MessageSkeleton"

/**
 * MessageSkeletonGroup - Multiple message skeletons for initial load
 *
 * @param {number} count - Number of skeletons to show
 */
const MessageSkeletonGroup: React.FC<CountProps> = ({ count = 3, ...props }) => (
  <div className="skeleton-message-group" {...props}>
    {Array.from({ length: count }).map((_, i) => (
      <MessageSkeleton key={i} variant={i % 2 === 0 ? "assistant" : "user"} />
    ))}
  </div>
)

MessageSkeletonGroup.displayName = "MessageSkeletonGroup"

/**
 * ConversationSkeleton - Loading placeholder for sidebar conversation items
 */
const ConversationSkeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ ...props }) => (
  <div className="skeleton-conversation" {...props}>
    <div className="skeleton-conversation-content">
      <Skeleton className="skeleton-conversation-title" />
      <Skeleton className="skeleton-conversation-meta" />
    </div>
  </div>
)

ConversationSkeleton.displayName = "ConversationSkeleton"

/**
 * ConversationSkeletonGroup - Multiple conversation skeletons for sidebar loading
 *
 * @param {number} count - Number of skeletons to show (default: 5)
 */
const ConversationSkeletonGroup: React.FC<CountProps> = ({ count = 5, ...props }) => (
  <div className="skeleton-conversation-group" {...props}>
    {Array.from({ length: count }).map((_, i) => (
      <ConversationSkeleton key={i} />
    ))}
  </div>
)

ConversationSkeletonGroup.displayName = "ConversationSkeletonGroup"

export { Skeleton, SkeletonText, MessageSkeleton, MessageSkeletonGroup, ConversationSkeleton, ConversationSkeletonGroup }
