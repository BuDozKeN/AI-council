/**
 * Tests for useDecisionActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDecisionActions } from './useDecisionActions';

// Mock the API module
vi.mock('../../../api', () => ({
  api: {
    promoteDecisionToPlaybook: vi.fn(),
    createProjectFromDecision: vi.fn(),
    linkDecisionToProject: vi.fn(),
    deleteDecision: vi.fn(),
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

describe('useDecisionActions', () => {
  let mockSetDecisions;
  let mockSetProjects;
  let mockLoadData;
  let mockSetActiveTab;
  let mockSetHighlightedProjectId;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSetDecisions = vi.fn();
    mockSetProjects = vi.fn();
    mockLoadData = vi.fn().mockResolvedValue(undefined);
    mockSetActiveTab = vi.fn();
    mockSetHighlightedProjectId = vi.fn();

    api.promoteDecisionToPlaybook.mockResolvedValue({});
    api.createProjectFromDecision.mockResolvedValue({ project: { id: 'new-proj' } });
    api.linkDecisionToProject.mockResolvedValue({});
    api.deleteDecision.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    expect(result.current.promoteModal).toBeNull();
    expect(result.current.deletingDecisionId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it('should expose all action handlers', () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    expect(typeof result.current.handlePromoteDecision).toBe('function');
    expect(typeof result.current.handleConfirmPromote).toBe('function');
    expect(typeof result.current.handleDeleteDecision).toBe('function');
    expect(typeof result.current.setPromoteModal).toBe('function');
    expect(typeof result.current.setSaving).toBe('function');
  });

  it('should open promote modal when handlePromoteDecision is called', () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    const decision = { id: 'dec-123', title: 'Test Decision' };

    act(() => {
      result.current.handlePromoteDecision(decision);
    });

    expect(result.current.promoteModal).toEqual(decision);
  });

  it('should promote to playbook when handleConfirmPromote is called with doc type', async () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    const decision = { id: 'dec-123', title: 'Test Decision' };

    // First open modal
    act(() => {
      result.current.handlePromoteDecision(decision);
    });

    // Then confirm promote to playbook (SOP)
    await act(async () => {
      await result.current.handleConfirmPromote('sop', 'Custom Title', ['dept-1']);
    });

    expect(api.promoteDecisionToPlaybook).toHaveBeenCalledWith('comp-123', 'dec-123', {
      doc_type: 'sop',
      title: 'Custom Title',
      department_ids: ['dept-1'],
    });
    expect(mockLoadData).toHaveBeenCalled();
    expect(result.current.promoteModal).toBeNull();
  });

  it('should create new project from decision when project type selected without projectId', async () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    const decision = { id: 'dec-123', title: 'Test Decision' };

    act(() => {
      result.current.handlePromoteDecision(decision);
    });

    await act(async () => {
      await result.current.handleConfirmPromote('project', 'New Project Name', ['dept-1'], null);
    });

    expect(api.createProjectFromDecision).toHaveBeenCalledWith('comp-123', 'dec-123', {
      name: 'New Project Name',
      department_ids: ['dept-1'],
    });
    expect(mockSetActiveTab).toHaveBeenCalledWith('projects');
    expect(mockSetHighlightedProjectId).toHaveBeenCalledWith('new-proj');
  });

  it('should link decision to existing project when projectId provided', async () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    const decision = { id: 'dec-123', title: 'Test Decision' };

    act(() => {
      result.current.handlePromoteDecision(decision);
    });

    await act(async () => {
      await result.current.handleConfirmPromote('project', 'Title', [], 'existing-proj');
    });

    expect(api.linkDecisionToProject).toHaveBeenCalledWith('comp-123', 'dec-123', 'existing-proj');
    expect(mockSetActiveTab).toHaveBeenCalledWith('projects');
    expect(mockSetHighlightedProjectId).toHaveBeenCalledWith('existing-proj');
  });

  it('should delete decision with fade animation', async () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    const decision = { id: 'dec-del', title: 'To Delete' };

    act(() => {
      result.current.handleDeleteDecision(decision);
    });

    expect(result.current.deletingDecisionId).toBe('dec-del');

    // Fast-forward past animation
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSetDecisions).toHaveBeenCalled();
    expect(api.deleteDecision).toHaveBeenCalledWith('comp-123', 'dec-del');
  });

  it('should not call handleConfirmPromote if promoteModal is null', async () => {
    const { result } = renderHook(() =>
      useDecisionActions({
        companyId: 'comp-123',
        setDecisions: mockSetDecisions,
        setProjects: mockSetProjects,
        loadData: mockLoadData,
        setActiveTab: mockSetActiveTab,
        setHighlightedProjectId: mockSetHighlightedProjectId,
      })
    );

    // Don't open modal first
    await act(async () => {
      await result.current.handleConfirmPromote('sop', 'Title', []);
    });

    expect(api.promoteDecisionToPlaybook).not.toHaveBeenCalled();
    expect(api.createProjectFromDecision).not.toHaveBeenCalled();
  });
});
