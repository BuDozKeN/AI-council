/* eslint-disable react-refresh/only-export-components -- Re-exporting toast helper alongside Toaster is intentional */
'use client';
import { Toaster as Sonner, toast as sonnerToast, ExternalToast } from 'sonner';
import { useTranslation } from 'react-i18next';
import './sonner.css';

/**
 * ISS-340, ISS-341: Toast duration constants
 * Errors stay longer so users can read the message
 */
const TOAST_DURATION = {
  default: 5000, // 5 seconds
  success: 4000, // 4 seconds (quick confirmation)
  error: 8000, // 8 seconds (time to read error details)
  warning: 6000, // 6 seconds
  info: 5000, // 5 seconds
};

/**
 * Enhanced toast helpers with consistent durations
 * ISS-340: Errors stay visible longer
 * ISS-341: Consistent styling via richColors
 */
const toast = Object.assign(
  // Default toast
  (message: string, options?: ExternalToast) =>
    sonnerToast(message, { duration: TOAST_DURATION.default, ...options }),
  {
    // Success toast - quick confirmation
    success: (message: string, options?: ExternalToast) =>
      sonnerToast.success(message, { duration: TOAST_DURATION.success, ...options }),

    // Error toast - longer duration for readability
    error: (message: string, options?: ExternalToast) =>
      sonnerToast.error(message, { duration: TOAST_DURATION.error, ...options }),

    // Warning toast
    warning: (message: string, options?: ExternalToast) =>
      sonnerToast.warning(message, { duration: TOAST_DURATION.warning, ...options }),

    // Info toast
    info: (message: string, options?: ExternalToast) =>
      sonnerToast.info(message, { duration: TOAST_DURATION.info, ...options }),

    // Loading toast (no auto-dismiss)
    loading: (message: string, options?: ExternalToast) => sonnerToast.loading(message, options),

    // Promise toast
    promise: sonnerToast.promise,

    // Dismiss toast
    dismiss: sonnerToast.dismiss,

    // Custom toast (pass-through)
    custom: sonnerToast.custom,
  }
);

/**
 * Toast component using sonner library
 * Provides notifications with optional undo actions
 *
 * Mobile: bottom-center for better thumb reach
 * Desktop: bottom-right to stay out of main content
 *
 * ISS-118: Uses translated aria-label for the notifications region
 */
const Toaster = ({ ...props }) => {
  const { t } = useTranslation();
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
      // ISS-341: richColors ensures success (green), error (red), etc. are styled consistently
      richColors
      // ISS-118: Translated aria-label for the notifications region
      containerAriaLabel={t('aria.notifications', 'Notifications')}
      // ISS-340: Default duration (individual toasts may override)
      duration={TOAST_DURATION.default}
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

export { Toaster, toast, TOAST_DURATION };
