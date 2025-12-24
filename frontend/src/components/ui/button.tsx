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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary - Notion blue
        default:
          "bg-[#2383e2] text-white shadow-sm hover:bg-[#1a73d4] active:bg-[#1565c0]",
        // Secondary - Gray
        secondary:
          "bg-[#f5f5f5] text-[#37352f] hover:bg-[#ebebeb] active:bg-[#e0e0e0]",
        // Outline - Bordered
        outline:
          "border border-[#e8e8e8] bg-white text-[#37352f] shadow-sm hover:bg-[#fafafa] hover:border-[#d4d4d4]",
        // Ghost - Minimal
        ghost:
          "text-[#37352f] hover:bg-[#f5f5f5] active:bg-[#ebebeb]",
        // Destructive - Red
        destructive:
          "bg-[#e03e3e] text-white shadow-sm hover:bg-[#c93636] active:bg-[#b02e2e]",
        // Success - Green
        success:
          "bg-[#0f7b6c] text-white shadow-sm hover:bg-[#0d6b5e] active:bg-[#0a5a4f]",
        // Link style
        link:
          "text-[#2383e2] underline-offset-4 hover:underline",
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
