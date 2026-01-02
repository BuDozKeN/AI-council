/**
 * Test Utilities
 *
 * Custom render function that wraps components with all necessary providers.
 * Use this instead of @testing-library/react's render for component tests.
 */

/* eslint-disable react-refresh/only-export-components */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a new QueryClient for each test to ensure isolation
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry in tests
        gcTime: 0, // Disable caching for tests
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

// All providers wrapper for tests
function AllTheProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Custom render that includes providers
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Override render with custom render
export { customRender as render };

// Export query client creator for tests that need direct access
export { createTestQueryClient };
