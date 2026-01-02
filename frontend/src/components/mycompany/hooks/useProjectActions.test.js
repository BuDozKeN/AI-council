/**
 * Tests for useProjectActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectActions } from './useProjectActions';

// Mock the API module
vi.mock('../../../api', () => ({
  api: {
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
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

describe('useProjectActions', () => {
  let mockSetProjects;
  let mockLoadData;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSetProjects = vi.fn();
    mockLoadData = vi.fn().mockResolvedValue(undefined);
    api.updateProject.mockResolvedValue({ project: { id: 'proj-123', status: 'completed' } });
    api.deleteProject.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    expect(result.current.fadingProjectId).toBeNull();
    expect(result.current.confirmingDeleteProjectId).toBeNull();
  });

  it('should expose all action handlers', () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    expect(typeof result.current.handleCompleteProject).toBe('function');
    expect(typeof result.current.handleArchiveProject).toBe('function');
    expect(typeof result.current.handleRestoreProject).toBe('function');
    expect(typeof result.current.handleDeleteProject).toBe('function');
    expect(typeof result.current.handleUpdateProject).toBe('function');
  });

  it('should set fadingProjectId when completing project', async () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    const project = { id: 'proj-123', status: 'active' };
    const event = { stopPropagation: vi.fn() };

    act(() => {
      result.current.handleCompleteProject(project, event);
    });

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(result.current.fadingProjectId).toBe('proj-123');
  });

  it('should call API and update state after fade animation for complete', async () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    const project = { id: 'proj-123', status: 'active' };

    act(() => {
      result.current.handleCompleteProject(project, { stopPropagation: vi.fn() });
    });

    // Fast-forward past animation
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(api.updateProject).toHaveBeenCalledWith('proj-123', { status: 'completed' });
    expect(mockSetProjects).toHaveBeenCalled();
  });

  it('should set fadingProjectId when archiving project', () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    const project = { id: 'proj-456', status: 'completed' };

    act(() => {
      result.current.handleArchiveProject(project, { stopPropagation: vi.fn() });
    });

    expect(result.current.fadingProjectId).toBe('proj-456');
  });

  it('should set fadingProjectId when restoring project', () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    const project = { id: 'proj-789', status: 'archived' };

    act(() => {
      result.current.handleRestoreProject(project, { stopPropagation: vi.fn() });
    });

    expect(result.current.fadingProjectId).toBe('proj-789');
  });

  it('should require double-click for delete - first click shows confirm', () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    const project = { id: 'proj-del', status: 'archived' };

    // First click
    act(() => {
      result.current.handleDeleteProject(project, { stopPropagation: vi.fn() });
    });

    expect(result.current.confirmingDeleteProjectId).toBe('proj-del');
    expect(result.current.fadingProjectId).toBeNull();
    expect(api.deleteProject).not.toHaveBeenCalled();
  });

  it('should delete project on second click', async () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    const project = { id: 'proj-del', status: 'archived' };

    // First click
    act(() => {
      result.current.handleDeleteProject(project, { stopPropagation: vi.fn() });
    });

    // Second click
    act(() => {
      result.current.handleDeleteProject(project, { stopPropagation: vi.fn() });
    });

    expect(result.current.confirmingDeleteProjectId).toBeNull();
    expect(result.current.fadingProjectId).toBe('proj-del');

    // Fast-forward past animation
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(api.deleteProject).toHaveBeenCalledWith('proj-del');
    expect(mockSetProjects).toHaveBeenCalled();
  });

  it('should call loadData and return updated project on handleUpdateProject', async () => {
    const updatedProject = { id: 'proj-123', name: 'Updated Name' };
    api.updateProject.mockResolvedValue({ project: updatedProject });

    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    let returnedProject;
    await act(async () => {
      returnedProject = await result.current.handleUpdateProject('proj-123', {
        name: 'Updated Name',
      });
    });

    expect(api.updateProject).toHaveBeenCalledWith('proj-123', { name: 'Updated Name' });
    expect(mockLoadData).toHaveBeenCalled();
    expect(returnedProject).toEqual(updatedProject);
  });

  it('should allow setting confirmingDeleteProjectId manually', () => {
    const { result } = renderHook(() =>
      useProjectActions({
        setProjects: mockSetProjects,
        loadData: mockLoadData,
      })
    );

    act(() => {
      result.current.setConfirmingDeleteProjectId('proj-manual');
    });

    expect(result.current.confirmingDeleteProjectId).toBe('proj-manual');
  });
});
