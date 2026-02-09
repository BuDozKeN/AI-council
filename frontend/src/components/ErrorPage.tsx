/**
 * ErrorPage - Custom error boundary for React Router
 *
 * Uses the same design as ErrorBoundary.tsx for visual consistency.
 * Provides a user-friendly error page when routing errors occur.
 */

import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { logger } from '../utils/logger';
import './ErrorBoundary.css';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Log error details for debugging (logger handles env-based filtering)
  logger.error('[ErrorPage] Caught error:', error);

  // Determine user-friendly error details based on status code
  let title = t('errorBoundary.title');
  let message = t('errorBoundary.message');
  let statusCode: number | null = null;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    if (error.status === 404) {
      title = t('errorBoundary.notFoundTitle');
      message = t('errorBoundary.notFoundMessage');
    } else if (error.status === 401) {
      title = t('errorBoundary.authRequiredTitle');
      message = t('errorBoundary.authRequiredMessage');
    } else if (error.status === 403) {
      title = t('errorBoundary.accessDeniedTitle');
      message = t('errorBoundary.accessDeniedMessage');
    } else if (error.status === 500) {
      title = t('errorBoundary.serverErrorTitle');
      message = t('errorBoundary.serverErrorMessage');
    }
  }

  // ISS-015: Set page title for accessibility and SEO
  useEffect(() => {
    document.title = `${title} - AxCouncil`;
  }, [title]);

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const getErrorText = (): string => {
    if (error instanceof Error) {
      return `${error.toString()}${error.stack ? `\n\n${error.stack}` : ''}`;
    }
    if (isRouteErrorResponse(error)) {
      return `${error.status} ${error.statusText}\n${error.data || ''}`;
    }
    return String(error);
  };

  const handleCopyError = async (): Promise<void> => {
    const errorText = getErrorText();
    if (!errorText) return;

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  return (
    <div className="error-boundary">
      <div className="error-boundary-card">
        <div className="error-boundary-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-orange-500, #f97316)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="7" x2="12" y2="13" />
            <circle
              cx="12"
              cy="16.5"
              r="0.5"
              fill="var(--color-orange-500, #f97316)"
              stroke="none"
            />
          </svg>
        </div>

        {statusCode && <span className="error-boundary-status-code">{statusCode}</span>}

        <h1 className="error-boundary-title">{title}</h1>

        <p className="error-boundary-message">{message}</p>

        <div className="error-boundary-buttons">
          <Button onClick={handleRefresh} variant="default">
            {t('errorBoundary.reloadPage')}
          </Button>
          <Button onClick={handleGoHome} variant="outline">
            {t('errorBoundary.goToHome')}
          </Button>
          <Button onClick={handleGoBack} variant="ghost">
            {t('errorBoundary.goBack')}
          </Button>
        </div>

        {/* Show error details in development only */}
        {import.meta.env.DEV && getErrorText() && (
          <details className="error-boundary-details">
            <summary className="error-boundary-summary">{t('errorBoundary.errorDetails')}</summary>
            <div className="error-boundary-error-container">
              <button
                onClick={handleCopyError}
                className="error-boundary-copy-btn"
                title={copied ? t('common.copied') : t('errorBoundary.copyError')}
              >
                {copied ? (
                  <Check size={14} className="text-emerald-500" />
                ) : (
                  <Copy size={14} className="text-gray-500" />
                )}
              </button>
              <pre className="error-boundary-error-text">{getErrorText()}</pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default ErrorPage;
