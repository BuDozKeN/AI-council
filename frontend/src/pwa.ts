import { registerSW } from 'virtual:pwa-register';

// Register service worker with error handling
// This prevents unhandled rejection errors when SW registration fails
// (e.g., when sw.js is not accessible due to network issues or misconfigurations)
export function initPWA() {
  if ('serviceWorker' in navigator) {
    try {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          // Check for updates periodically (every hour)
          if (registration) {
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000);
          }
        },
        onRegisterError(error) {
          // Silently log SW registration errors - these are non-critical
          // Common causes: network issues, sw.js not found, browser restrictions
          console.warn('Service worker registration failed:', error);
        },
      });
    } catch {
      // Catch any synchronous errors during registration setup
      console.warn('Service worker registration not available');
    }
  }
}
