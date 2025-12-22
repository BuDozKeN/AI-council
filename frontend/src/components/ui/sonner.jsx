"use client";
import { Toaster as Sonner, toast } from "sonner"

/**
 * Toast component using sonner library
 * Provides notifications with optional undo actions
 */
const Toaster = ({
  ...props
}) => {
  // Detect theme from document class (dark mode support)
  const isDark = typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  return (
    <Sonner
      theme={isDark ? 'dark' : 'light'}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
