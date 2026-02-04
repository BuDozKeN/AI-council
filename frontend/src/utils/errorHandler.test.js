/**
 * Tests for the error handler utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleError, handleApiError, createErrorHandler } from './errorHandler';

// Mock the logger
vi.mock('./logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the toast
vi.mock('../components/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { logger } from './logger';
import { toast } from '../components/ui/sonner';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleError', () => {
    it('should log the error with context', () => {
      const error = new Error('Test error');
      handleError(error, 'TestComponent.testAction');

      expect(logger.error).toHaveBeenCalledWith('[TestComponent.testAction]', error);
    });

    it('should show toast notification by default', () => {
      const error = new Error('Test error');
      handleError(error, 'TestComponent.testAction');

      expect(toast.error).toHaveBeenCalledWith('Test error');
    });

    it('should not show toast when showToast is false', () => {
      const error = new Error('Test error');
      handleError(error, 'TestComponent.testAction', { showToast: false });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should use custom userMessage if provided', () => {
      const error = new Error('Technical error');
      handleError(error, 'Test', { userMessage: 'Something went wrong' });

      expect(toast.error).toHaveBeenCalledWith('Something went wrong');
    });

    it('should not log or show toast when silent is true', () => {
      const error = new Error('Test error');
      handleError(error, 'Test', { silent: true });

      expect(logger.error).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should return error object with message', () => {
      const error = new Error('Test error');
      const result = handleError(error, 'Test');

      expect(result).toEqual({ error: true, message: 'Test error' });
    });

    it('should handle string errors', () => {
      const result = handleError('String error', 'Test');

      expect(result.message).toBe('String error');
    });

    it('should handle null/undefined errors', () => {
      const result = handleError(null, 'Test');

      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should suppress GitHub resource errors from external sources', () => {
      const error = new Error('The requested GitHub resource was not found');
      const result = handleError(error, 'Test');

      // Should not show toast or log error for suppressed errors
      expect(toast.error).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      // Should still return the error result
      expect(result).toEqual({ error: true, message: 'The requested GitHub resource was not found' });
    });
  });

  describe('handleApiError', () => {
    it('should handle 401 status', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const result = handleApiError(error, 'Test');

      expect(result.status).toBe(401);
      expect(result.message).toBe('Please sign in to continue');
    });

    it('should handle 403 status', () => {
      const error = { status: 403 };
      const result = handleApiError(error, 'Test');

      expect(result.status).toBe(403);
      expect(result.message).toBe("You don't have permission to do this");
    });

    it('should handle 404 status', () => {
      const error = { status: 404 };
      const result = handleApiError(error, 'Test');

      expect(result.status).toBe(404);
      expect(result.message).toBe('The requested resource was not found');
    });

    it('should handle 500 status', () => {
      const error = { status: 500 };
      const result = handleApiError(error, 'Test');

      expect(result.status).toBe(500);
      expect(result.message).toBe('Server error. Please try again later');
    });
  });

  describe('createErrorHandler', () => {
    it('should create a scoped error handler', () => {
      const handler = createErrorHandler('MyComponent');

      expect(handler.handle).toBeDefined();
      expect(handler.handleApi).toBeDefined();
      expect(handler.wrap).toBeDefined();
    });

    it('should prefix context with component name', () => {
      const handler = createErrorHandler('MyComponent');
      handler.handle(new Error('Test'), 'loadData');

      expect(logger.error).toHaveBeenCalledWith('[MyComponent.loadData]', expect.any(Error));
    });
  });
});
