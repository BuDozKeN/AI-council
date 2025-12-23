/**
 * Tests for filter hooks
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaybookFilter, useProjectFilter, useDecisionFilter } from './useFilters';

describe('usePlaybookFilter', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePlaybookFilter());

    expect(result.current.playbookTypeFilter).toBe('all');
    expect(result.current.playbookDeptFilter).toEqual([]);
    expect(result.current.expandedTypes).toEqual({});
  });

  it('should allow setting playbook type filter', () => {
    const { result } = renderHook(() => usePlaybookFilter());

    act(() => {
      result.current.setPlaybookTypeFilter('sop');
    });

    expect(result.current.playbookTypeFilter).toBe('sop');
  });

  it('should allow setting playbook department filter', () => {
    const { result } = renderHook(() => usePlaybookFilter());

    act(() => {
      result.current.setPlaybookDeptFilter('dept-123');
    });

    expect(result.current.playbookDeptFilter).toBe('dept-123');
  });

  it('should allow setting expanded types', () => {
    const { result } = renderHook(() => usePlaybookFilter());

    act(() => {
      result.current.setExpandedTypes({ sop: true, framework: false });
    });

    expect(result.current.expandedTypes).toEqual({ sop: true, framework: false });
  });
});

describe('useProjectFilter', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useProjectFilter());

    expect(result.current.projectStatusFilter).toBe('active');
    expect(result.current.projectDeptFilter).toEqual([]);
    expect(result.current.projectSortBy).toBe('updated');
  });

  it('should allow setting project status filter', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.setProjectStatusFilter('completed');
    });

    expect(result.current.projectStatusFilter).toBe('completed');
  });

  it('should allow setting project department filter', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.setProjectDeptFilter('dept-456');
    });

    expect(result.current.projectDeptFilter).toBe('dept-456');
  });

  it('should allow setting project sort by', () => {
    const { result } = renderHook(() => useProjectFilter());

    act(() => {
      result.current.setProjectSortBy('name');
    });

    expect(result.current.projectSortBy).toBe('name');
  });
});

describe('useDecisionFilter', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useDecisionFilter());

    expect(result.current.decisionDeptFilter).toEqual([]);
    expect(result.current.decisionSearch).toBe('');
  });

  it('should allow setting decision department filter', () => {
    const { result } = renderHook(() => useDecisionFilter());

    act(() => {
      result.current.setDecisionDeptFilter('dept-789');
    });

    expect(result.current.decisionDeptFilter).toBe('dept-789');
  });

  it('should allow setting decision search', () => {
    const { result } = renderHook(() => useDecisionFilter());

    act(() => {
      result.current.setDecisionSearch('search term');
    });

    expect(result.current.decisionSearch).toBe('search term');
  });
});
