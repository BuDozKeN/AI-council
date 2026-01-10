import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from './button';
import './ErrorState.css';

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Unified ErrorState component for consistent error UI across the app.
 *
 * @param {string} title - Error heading (default: i18n "errors.generic")
 * @param {string} message - Error description or message
 * @param {function} onRetry - Optional retry callback
 * @param {string} retryLabel - Retry button text (default: i18n "common.tryAgain")
 * @param {string} className - Additional CSS classes
 */
const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      title,
      message,
      onRetry,
      retryLabel,
      className,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();

    const displayTitle = title ?? t('errors.generic');
    const displayRetryLabel = retryLabel ?? t('common.tryAgain');

    return (
      <div ref={ref} className={cn('error-state', className)} role="alert" {...props}>
        <div className="error-state-icon">
          <AlertCircle size={24} strokeWidth={1.5} />
        </div>
        <h3 className="error-state-title">{displayTitle}</h3>
        {message && <p className="error-state-message">{message}</p>}
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="error-state-retry"
          >
            <RefreshCw size={14} />
            {displayRetryLabel}
          </Button>
        )}
      </div>
    );
  }
);

ErrorState.displayName = 'ErrorState';

export { ErrorState };
export type { ErrorStateProps };
