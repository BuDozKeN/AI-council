/**
 * Tests for the constants
 */

import { describe, it, expect } from 'vitest';
import {
  BREAKPOINTS,
  PAGINATION,
  TEXT_LIMITS,
  TIMEOUTS,
  UPLOAD,
  UI,
  isMobileDevice,
} from './index';

describe('constants', () => {
  describe('BREAKPOINTS', () => {
    it('should have mobile breakpoint at 768', () => {
      expect(BREAKPOINTS.MOBILE).toBe(768);
    });

    it('should have all breakpoint values', () => {
      expect(BREAKPOINTS.SM).toBeDefined();
      expect(BREAKPOINTS.TABLET).toBeDefined();
      expect(BREAKPOINTS.DESKTOP).toBeDefined();
    });
  });

  describe('PAGINATION', () => {
    it('should have conversations page size of 10', () => {
      expect(PAGINATION.CONVERSATIONS_PAGE_SIZE).toBe(10);
    });

    it('should have activity page size of 20', () => {
      expect(PAGINATION.ACTIVITY_PAGE_SIZE).toBe(20);
    });
  });

  describe('TEXT_LIMITS', () => {
    it('should have title max length of 60', () => {
      expect(TEXT_LIMITS.TITLE_MAX_LENGTH).toBe(60);
    });
  });

  describe('TIMEOUTS', () => {
    it('should have decision check throttle of 5000ms', () => {
      expect(TIMEOUTS.DECISION_CHECK_THROTTLE).toBe(5000);
    });

    it('should have debounce of 1000ms', () => {
      expect(TIMEOUTS.DEBOUNCE_SAVE_PREFS).toBe(1000);
    });
  });

  describe('UPLOAD', () => {
    it('should have max 5 images', () => {
      expect(UPLOAD.MAX_IMAGES).toBe(5);
    });

    it('should have max 10MB image size', () => {
      expect(UPLOAD.MAX_IMAGE_SIZE_MB).toBe(10);
    });
  });

  describe('UI', () => {
    it('should have pull refresh threshold', () => {
      expect(UI.PULL_REFRESH_THRESHOLD).toBe(80);
    });
  });

  describe('isMobileDevice', () => {
    it('should be a function', () => {
      expect(typeof isMobileDevice).toBe('function');
    });

    it('should return a boolean', () => {
      const result = isMobileDevice();
      expect(typeof result).toBe('boolean');
    });
  });
});
