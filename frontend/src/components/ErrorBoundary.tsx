import { Component, ReactNode, ErrorInfo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { captureError } from '../utils/sentry';
import { logger } from '../utils/logger';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReload: () => void;
  onGoHome: () => void;
}

/**
 * Error Fallback UI component (functional, can use hooks)
 */
function ErrorFallback({ error, errorInfo, onReload, onGoHome }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const getErrorText = (): string => {
    if (!error) return '';
    return `${error.toString()}${errorInfo?.componentStack || ''}`;
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

        <h1 className="error-boundary-title">{t('errorBoundary.title')}</h1>

        <p className="error-boundary-message">{t('errorBoundary.message')}</p>

        <div className="error-boundary-buttons">
          <Button onClick={onReload} variant="default">
            {t('errorBoundary.reloadPage')}
          </Button>
          <Button onClick={onGoHome} variant="outline">
            {t('errorBoundary.goToHome')}
          </Button>
        </div>

        {/* Show error details in development */}
        {import.meta.env.DEV && error && (
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
              <pre className="error-boundary-error-text">
                {error.toString()}
                {errorInfo?.componentStack}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child
 * component tree, log them, and display a fallback UI instead of crashing.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({ errorInfo });

    // Send to Sentry
    captureError(error, {
      componentStack: errorInfo?.componentStack,
      errorBoundary: true,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
