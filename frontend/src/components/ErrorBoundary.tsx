import { Component } from 'react';
import { Copy, Check } from 'lucide-react';
import { captureError } from '../utils/sentry';
import { logger } from '../utils/logger';

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child
 * component tree, log them, and display a fallback UI instead of crashing.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({ errorInfo });

    // Send to Sentry
    captureError(error, {
      componentStack: errorInfo?.componentStack,
      errorBoundary: true,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleCopyError = async () => {
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

  getErrorText = () => {
    const { error, errorInfo } = this.state;
    if (!error) return '';
    return `${error.toString()}${errorInfo?.componentStack || ''}`;
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block' }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="7" x2="12" y2="13" />
                <circle cx="12" cy="16.5" r="0.5" fill="#f97316" stroke="none" />
              </svg>
            </div>

            <h1 style={styles.title}>Something went wrong</h1>

            <p style={styles.message}>
              We apologize for the inconvenience. An unexpected error occurred.
            </p>

            <div style={styles.buttonGroup}>
              <button
                onClick={this.handleReload}
                style={styles.primaryButton}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={styles.secondaryButton}
              >
                Go to Home
              </button>
            </div>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details (Dev Only)</summary>
                <div style={styles.errorContainer}>
                  <button
                    onClick={this.handleCopyError}
                    style={styles.copyButton}
                    title={this.state.copied ? 'Copied!' : 'Copy error details'}
                  >
                    {this.state.copied ? (
                      <Check size={14} color="#10b981" />
                    ) : (
                      <Copy size={14} color="#6b7280" />
                    )}
                  </button>
                  <pre style={styles.errorText}>
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

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '48px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb',
  },
  iconContainer: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '12px',
    margin: '0 0 12px 0',
  },
  message: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '32px',
    lineHeight: '1.5',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#f97316',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  details: {
    marginTop: '32px',
    textAlign: 'left',
  },
  summary: {
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '8px',
  },
  errorContainer: {
    position: 'relative',
  },
  copyButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    zIndex: 1,
  },
  errorText: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px',
    paddingRight: '44px',
    fontSize: '12px',
    color: '#991b1b',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
};

export default ErrorBoundary;
