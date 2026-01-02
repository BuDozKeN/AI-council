/**
 * Tests for useDecisionState hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDecisionState } from './useDecisionState';

// Mock the API module
vi.mock('../../../api', () => ({
  api: {
    getConversationDecision: vi.fn(),
  },
}));

// Mock the logger module
vi.mock('../../../utils/logger', () => ({
  logger: {
    scope: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { api } from '../../../api';

describe('useDecisionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    api.getConversationDecision.mockResolvedValue({ decision: null });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    expect(result.current.saveState).toBe('idle');
    expect(result.current.savedDecisionId).toBeNull();
    expect(result.current.promotedPlaybookId).toBeNull();
    expect(result.current.selectedProjectId).toBeNull();
    expect(result.current.selectedDeptIds).toEqual([]);
    expect(result.current.selectedDocType).toBe('');
  });

  it('should initialize with provided project ID', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
        currentProjectId: 'proj-789',
      })
    );

    expect(result.current.selectedProjectId).toBe('proj-789');
  });

  it('should initialize with provided department ID', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
        departmentId: 'dept-123',
      })
    );

    expect(result.current.selectedDeptIds).toEqual(['dept-123']);
  });

  it('should not fetch for temp conversations', () => {
    renderHook(() =>
      useDecisionState({
        conversationId: 'temp-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    expect(api.getConversationDecision).not.toHaveBeenCalled();
  });

  it('should not fetch when conversationId is missing', () => {
    renderHook(() =>
      useDecisionState({
        conversationId: null,
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    expect(api.getConversationDecision).not.toHaveBeenCalled();
  });

  it('should not fetch when companyId is missing', () => {
    renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: null,
        responseIndex: 0,
      })
    );

    expect(api.getConversationDecision).not.toHaveBeenCalled();
  });

  it('should allow setting save state', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    act(() => {
      result.current.setSaveState('saving');
    });

    expect(result.current.saveState).toBe('saving');
  });

  it('should allow setting saved decision ID', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    act(() => {
      result.current.setSavedDecisionId('dec-123');
    });

    expect(result.current.savedDecisionId).toBe('dec-123');
  });

  it('should allow setting promoted playbook ID', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    act(() => {
      result.current.setPromotedPlaybookId('pb-123');
    });

    expect(result.current.promotedPlaybookId).toBe('pb-123');
  });

  it('should allow setting selected project ID', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    act(() => {
      result.current.setSelectedProjectId('proj-new');
    });

    expect(result.current.selectedProjectId).toBe('proj-new');
  });

  it('should allow setting selected department IDs', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    act(() => {
      result.current.setSelectedDeptIds(['dept-1', 'dept-2']);
    });

    expect(result.current.selectedDeptIds).toEqual(['dept-1', 'dept-2']);
  });

  it('should allow setting selected doc type', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    act(() => {
      result.current.setSelectedDocType('sop');
    });

    expect(result.current.selectedDocType).toBe('sop');
  });

  it('should expose checkDecisionStatus function', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    expect(typeof result.current.checkDecisionStatus).toBe('function');
  });

  it('should expose lastSyncedProjectIdRef ref', () => {
    const { result } = renderHook(() =>
      useDecisionState({
        conversationId: 'conv-123',
        companyId: 'comp-456',
        responseIndex: 0,
      })
    );

    expect(result.current.lastSyncedProjectIdRef).toBeDefined();
  });
});
