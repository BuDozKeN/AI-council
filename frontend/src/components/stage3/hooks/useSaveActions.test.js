/**
 * Tests for useSaveActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveActions } from './useSaveActions';

// Mock the API module
vi.mock('../../../api', () => ({
  api: {
    createCompanyDecision: vi.fn(),
    mergeDecisionIntoProject: vi.fn(),
    updateProject: vi.fn(),
    getProject: vi.fn(),
    promoteDecisionToPlaybook: vi.fn(),
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

describe('useSaveActions', () => {
  const defaultProps = {
    companyId: 'comp-123',
    conversationId: 'conv-456',
    responseIndex: 0,
    displayText: 'Test decision content',
    userQuestion: 'What should we do?',
    conversationTitle: 'Test Conversation',
    selectedProjectId: null,
    selectedDeptIds: [],
    selectedDocType: '',
    currentProject: null,
    fullProjectData: null,
    projects: [],
    saveState: 'idle',
    savedDecisionId: null,
    setSaveState: vi.fn(),
    setSavedDecisionId: vi.fn(),
    setPromotedPlaybookId: vi.fn(),
    setFullProjectData: vi.fn(),
    getTitle: vi.fn(() => 'Test Decision Title'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return save action handlers', () => {
    const { result } = renderHook(() => useSaveActions(defaultProps));

    expect(result.current.handleSaveForLater).toBeDefined();
    expect(result.current.handleSaveAndPromote).toBeDefined();
    expect(typeof result.current.handleSaveForLater).toBe('function');
    expect(typeof result.current.handleSaveAndPromote).toBe('function');
  });

  it('should not save if companyId is missing', async () => {
    const props = { ...defaultProps, companyId: null };
    const { result } = renderHook(() => useSaveActions(props));

    await act(async () => {
      await result.current.handleSaveForLater();
    });

    expect(api.createCompanyDecision).not.toHaveBeenCalled();
    expect(props.setSaveState).not.toHaveBeenCalled();
  });

  it('should not save if already saving', async () => {
    const props = { ...defaultProps, saveState: 'saving' };
    const { result } = renderHook(() => useSaveActions(props));

    await act(async () => {
      await result.current.handleSaveForLater();
    });

    expect(api.createCompanyDecision).not.toHaveBeenCalled();
  });

  it('should save standalone decision without project', async () => {
    api.createCompanyDecision.mockResolvedValueOnce({
      decision: { id: 'dec-123' },
    });

    const { result } = renderHook(() => useSaveActions(defaultProps));

    await act(async () => {
      await result.current.handleSaveForLater();
    });

    expect(defaultProps.setSaveState).toHaveBeenCalledWith('saving');
    expect(api.createCompanyDecision).toHaveBeenCalledWith('comp-123', {
      title: 'Test Decision Title',
      content: 'Test decision content',
      user_question: 'What should we do?',
      department_ids: [],
      source_conversation_id: 'conv-456',
      response_index: 0,
      project_id: null,
      tags: [],
    });
    expect(defaultProps.setSavedDecisionId).toHaveBeenCalledWith('dec-123');
    expect(defaultProps.setSaveState).toHaveBeenCalledWith('saved');
  });

  it('should merge decision into project when project is selected', async () => {
    api.getProject.mockResolvedValueOnce({
      project: { id: 'proj-123', name: 'Test Project', context_md: '' },
    });
    api.mergeDecisionIntoProject.mockResolvedValueOnce({
      saved_decision_id: 'dec-456',
      merged: { context_md: 'Updated context' },
    });
    api.updateProject.mockResolvedValueOnce({});

    const props = {
      ...defaultProps,
      selectedProjectId: 'proj-123',
      projects: [{ id: 'proj-123', name: 'Test Project' }],
    };
    const { result } = renderHook(() => useSaveActions(props));

    await act(async () => {
      await result.current.handleSaveForLater();
    });

    expect(api.getProject).toHaveBeenCalledWith('proj-123');
    expect(api.mergeDecisionIntoProject).toHaveBeenCalled();
    expect(api.updateProject).toHaveBeenCalledWith('proj-123', {
      context_md: 'Updated context',
    });
    expect(props.setSavedDecisionId).toHaveBeenCalledWith('dec-456');
    expect(props.setSaveState).toHaveBeenCalledWith('saved');
  });

  it('should handle save error', async () => {
    api.createCompanyDecision.mockRejectedValueOnce(new Error('Save failed'));

    const { result } = renderHook(() => useSaveActions(defaultProps));

    await act(async () => {
      await result.current.handleSaveForLater();
    });

    expect(defaultProps.setSaveState).toHaveBeenCalledWith('error');
  });

  it('should not promote if doc type is not selected', async () => {
    const props = { ...defaultProps, selectedDocType: '' };
    const { result } = renderHook(() => useSaveActions(props));

    await act(async () => {
      await result.current.handleSaveAndPromote();
    });

    expect(api.createCompanyDecision).not.toHaveBeenCalled();
    expect(api.promoteDecisionToPlaybook).not.toHaveBeenCalled();
  });

  it('should save and promote to playbook', async () => {
    api.createCompanyDecision.mockResolvedValueOnce({
      decision: { id: 'dec-789' },
    });
    api.promoteDecisionToPlaybook.mockResolvedValueOnce({
      playbook: { id: 'pb-123' },
    });

    const props = {
      ...defaultProps,
      selectedDocType: 'sop',
      selectedDeptIds: ['dept-1'],
    };
    const { result } = renderHook(() => useSaveActions(props));

    await act(async () => {
      await result.current.handleSaveAndPromote();
    });

    expect(props.setSaveState).toHaveBeenCalledWith('promoting');
    expect(api.createCompanyDecision).toHaveBeenCalled();
    expect(api.promoteDecisionToPlaybook).toHaveBeenCalledWith('comp-123', 'dec-789', {
      doc_type: 'sop',
      title: 'Test Decision Title',
      department_ids: ['dept-1'],
    });
    expect(props.setPromotedPlaybookId).toHaveBeenCalledWith('pb-123');
    expect(props.setSaveState).toHaveBeenCalledWith('promoted');
  });

  it('should not save temp conversations with actual ID', async () => {
    api.createCompanyDecision.mockResolvedValueOnce({
      decision: { id: 'dec-123' },
    });

    const props = { ...defaultProps, conversationId: 'temp-123' };
    const { result } = renderHook(() => useSaveActions(props));

    await act(async () => {
      await result.current.handleSaveForLater();
    });

    // Should use null for temp conversation IDs
    expect(api.createCompanyDecision).toHaveBeenCalledWith(
      'comp-123',
      expect.objectContaining({
        source_conversation_id: null,
      })
    );
  });
});
