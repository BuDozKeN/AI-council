/**
 * ErrorPage - Custom error boundary for React Router
 *
 * Provides a user-friendly error page when routing errors occur,
 * instead of the default React Router error message.
 *
 * Design: Uses design tokens from design-tokens.css and tailwind.css
 * UX: Shows friendly messages to users, technical details only in dev mode
 */

import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log error details to console for debugging
  if (import.meta.env.DEV) {
    console.error('[ErrorPage] Caught error:', error);
  }

  // Determine user-friendly error details
  // Never show technical messages like "Maximum update depth exceeded" to users
  let title = 'Something went wrong';
  let message = "We're sorry, but something unexpected happened. Please try refreshing the page.";
  let statusCode: number | null = null;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    if (error.status === 404) {
      title = 'Page not found';
      message = "The page you're looking for doesn't exist or has been moved.";
    } else if (error.status === 401) {
      title = 'Please sign in';
      message = 'You need to be signed in to access this page.';
    } else if (error.status === 403) {
      title = 'Access denied';
      message = "You don't have permission to access this page.";
    } else if (error.status === 500) {
      title = 'Server error';
      message = "Something went wrong on our end. We're working to fix it.";
    }
  }
  // For runtime errors (like React errors), always show friendly message
  // Technical details go to console, not to users

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="error-page">
      <div className="error-page-content">
        {statusCode && <span className="error-page-code">{statusCode}</span>}
        <h1 className="error-page-title">{title}</h1>
        <p className="error-page-message">{message}</p>

        <div className="error-page-actions">
          <Button variant="default" onClick={handleGoHome}>
            Go to Home
          </Button>
          <Button variant="outline" onClick={handleGoBack}>
            Go Back
          </Button>
          <Button variant="ghost" onClick={handleRefresh}>
            Refresh Page
          </Button>
        </div>

        {/* Show error details in development only - collapsed by default */}
        {import.meta.env.DEV && error instanceof Error && (
          <details className="error-page-details">
            <summary>Developer Info</summary>
            <pre>
              {error.name}: {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default ErrorPage;
