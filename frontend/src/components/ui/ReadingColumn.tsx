import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * ReadingColumn - Premium content width constraint for optimal readability
 *
 * Based on readability research: 50-75 characters per line is optimal.
 * Uses character units (ch) for typographic correctness.
 *
 * Widths:
 * - default: 72ch (~680-720px) - Prose content, synthesis, chat
 * - wide: 56rem (~900px) - Tables, comparison grids, structured data
 *
 * Centering:
 * - centered (default): Centers the column within its container
 * - left: Aligns to start (for nested contexts)
 */

export interface ReadingColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width variant
   * - default: 72ch for prose (optimal reading)
   * - wide: 56rem for tables and structured content
   */
  variant?: "default" | "wide"

  /**
   * Whether to center the column
   * @default true
   */
  centered?: boolean

  /**
   * Element type to render
   * @default "div"
   */
  as?: "div" | "article" | "section" | "main"
}

const ReadingColumn = React.forwardRef<HTMLDivElement, ReadingColumnProps>(
  ({
    className,
    variant = "default",
    centered = true,
    as: Component = "div",
    ...props
  }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          // Base styles
          "w-full px-4 sm:px-6",
          // Width constraint based on variant
          variant === "default" && "max-w-[72ch]",
          variant === "wide" && "max-w-[56rem]",
          // Centering
          centered && "mx-auto",
          className
        )}
        {...props}
      />
    )
  }
)

ReadingColumn.displayName = "ReadingColumn"

export { ReadingColumn }
