/* eslint-disable react-refresh/only-export-components -- Exporting both Button component and buttonVariants helper is intentional */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

/**
 * Button component with Notion/Figma-inspired variants
 *
 * Variants:
 * - default: Primary indigo action button
 * - secondary: Gray/neutral button
 * - outline: Bordered button with transparent bg
 * - ghost: No border, transparent until hover
 * - destructive: Red danger button
 * - success: Green confirmation button
 * - link: Text link style
 *
 * Sizes (padding handled via CSS in tailwind.css):
 * - sm: 40px height, 24px horizontal padding
 * - default: 44px height, 28px horizontal padding
 * - lg: 52px height, 36px horizontal padding
 * - icon: 44x44px square icon-only button
 *
 * Styling uses CSS classes from tailwind.css (.btn-variant-*)
 * for reliable theming via CSS variables.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Variants use CSS classes from tailwind.css for reliable theming
        default: 'btn-variant-default',
        secondary: 'btn-variant-secondary',
        outline: 'btn-variant-outline',
        ghost: 'btn-variant-ghost',
        destructive: 'btn-variant-destructive',
        success: 'btn-variant-success',
        link: 'btn-variant-link',
      },
      size: {
        sm: 'h-10 [&_svg]:size-4',
        default: 'h-11 [&_svg]:size-4',
        lg: 'h-13 [&_svg]:size-5',
        icon: 'h-11 w-11 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Show loading spinner and disable button */
  loading?: boolean;
  /** Text to show while loading (defaults to children if not provided) */
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      loadingText,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    // Add haptic feedback on click for mobile
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        // Different haptics for different button types
        if (variant === 'destructive') {
          haptic.heavy();
        } else if (variant === 'success') {
          haptic.success();
        } else {
          haptic.light();
        }
      }
      onClick?.(e);
    };

    // For asChild, pass handleClick to preserve onClick and haptic feedback
    // Radix Slot will compose this with any onClick on the child element
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={handleClick}
          {...props}
        />
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), loading && 'relative')}
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <Loader2
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin"
            size={16}
            aria-hidden="true"
          />
        )}
        <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
          {loadingText && loading ? loadingText : children}
        </span>
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
