/**
 * Tests for the logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have all log methods', () => {
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.api).toBeDefined();
    expect(logger.scope).toBeDefined();
  });

  it('should create a scoped logger', () => {
    const log = logger.scope('TestComponent');
    expect(log.debug).toBeDefined();
    expect(log.info).toBeDefined();
    expect(log.warn).toBeDefined();
    expect(log.error).toBeDefined();
  });

  it('should always log errors', () => {
    logger.error('test error');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should always log warnings', () => {
    logger.warn('test warning');
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});
