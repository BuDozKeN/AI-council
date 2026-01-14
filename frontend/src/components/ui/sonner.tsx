/* eslint-disable react-refresh/only-export-components -- Re-exporting toast helper alongside Toaster is intentional */
'use client';
import { Toaster as Sonner, toast } from 'sonner';
import './sonner.css';

/**
 * Toast component using sonner library
 * Provides notifications with optional undo actions
 *
 * Mobile: bottom-center for better thumb reach
 * Desktop: bottom-right to stay out of main content
 */
const Toaster = ({ ...props }) => {
  // Detect theme from document class (dark mode support)
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Use bottom-center on mobile for better accessibility
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <Sonner
      theme={isDark ? 'dark' : 'light'}
      className="toaster group"
      position={isMobile ? 'bottom-center' : 'bottom-right'}
      // Mobile: larger touch targets and more visible
      expand={isMobile}
      richColors
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
