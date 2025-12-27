import { Component, ReactNode, ErrorInfo } from 'react';
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
  copied: boolean;
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
      copied: false
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

  handleCopyError = async (): Promise<void> => {
    const errorText = this.getErrorText();
    if (!errorText) return;

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  getErrorText = (): string => {
    const { error, errorInfo } = this.state;
    if (!error) return '';
    return `${error.toString()}${errorInfo?.componentStack || ''}`;
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
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
                <circle cx="12" cy="16.5" r="0.5" fill="var(--color-orange-500, #f97316)" stroke="none" />
              </svg>
            </div>

            <h1 className="error-boundary-title">Oops, something broke</h1>

            <p className="error-boundary-message">
              Don't worry — your work is safe. Let's get you back on track.
            </p>

            <div className="error-boundary-buttons">
              <Button
                onClick={this.handleReload}
                variant="default"
              >
                Reload Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
              >
                Go to Home
              </Button>
            </div>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="error-boundary-details">
                <summary className="error-boundary-summary">Error Details (Dev Only)</summary>
                <div className="error-boundary-error-container">
                  <button
                    onClick={this.handleCopyError}
                    className="error-boundary-copy-btn"
                    title={this.state.copied ? 'Copied!' : 'Copy error details'}
                  >
                    {this.state.copied ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} className="text-gray-500" />
                    )}
                  </button>
                  <pre className="error-boundary-error-text">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
