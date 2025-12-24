/* eslint-disable react-refresh/only-export-components -- Exporting both Button component and buttonVariants helper is intentional */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

/**
 * Button component with Notion/Figma-inspired variants
 *
 * Variants:
 * - default: Primary blue action button
 * - secondary: Gray/neutral button
 * - outline: Bordered button with transparent bg
 * - ghost: No border, transparent until hover
 * - destructive: Red danger button
 * - success: Green confirmation button
 * - link: Text link style
 *
 * Sizes:
 * - sm: 32px height, compact
 * - default: 36px height, standard
 * - lg: 44px height, prominent
 * - icon: Square icon-only button
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary - Uses design tokens
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-sm hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)]",
        // Secondary - Gray
        secondary:
          "bg-[var(--color-bg-muted)] text-[var(--color-text-default)] hover:bg-[var(--color-bg-emphasis)] active:bg-[var(--color-border-emphasis)]",
        // Outline - Bordered
        outline:
          "border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[var(--color-text-default)] shadow-sm hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-border-emphasis)]",
        // Ghost - Minimal
        ghost:
          "text-[var(--color-text-default)] hover:bg-[var(--color-bg-muted)] active:bg-[var(--color-bg-emphasis)]",
        // Destructive - Red
        destructive:
          "bg-[var(--color-error)] text-[var(--color-error-text)] shadow-sm hover:bg-[var(--color-error-hover)] active:opacity-90",
        // Success - Green
        success:
          "bg-[var(--color-success)] text-[var(--color-success-text)] shadow-sm hover:bg-[var(--color-success-hover)] active:opacity-90",
        // Link style
        link:
          "text-[var(--color-primary)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        default: "h-9 px-4 py-2",
        lg: "h-11 px-6 text-base rounded-lg",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
