/**
 * Tooltip - Accessible hover tooltip using Radix UI
 *
 * Simple, clean tooltip that appears on hover.
 * On touch devices, the portal is NOT rendered to prevent flash-of-tooltip.
 * Use toast notifications for mobile contextual help instead.
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';
import './Tooltip.css';

/**
 * Detect touch-only device via media query.
 * Cached at module load — covers phones/tablets reliably.
 */
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delayDuration = 200,
}: TooltipProps) {
  // On touch devices, render the trigger without the tooltip portal.
  // This prevents the flash caused by Radix rendering → CSS hiding.
  if (isTouchDevice) {
    return (
      <TooltipPrimitive.Provider delayDuration={delayDuration}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  }

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="tooltip-content"
            side={side}
            align={align}
            sideOffset={6}
          >
            {content}
            <TooltipPrimitive.Arrow className="tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// Export primitives for advanced usage
export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className = '', sideOffset = 6, ...props }, ref) => {
  // Same touch guard for the exported primitive
  if (isTouchDevice) return null;

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={`tooltip-content ${className}`}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = 'TooltipContent';
