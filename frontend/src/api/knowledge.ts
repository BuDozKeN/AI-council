/**
 * Knowledge base and AI structuring domain API methods.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders, log } from './client';
import type { ListDecisionsOptions, SaveDecisionOptions } from './types';

export const knowledgeMethods = {
  async createKnowledgeEntry(entry: {
    company_id: string;
    title: string;
    content?: string;
    summary?: string;
    category: string;
    department_id?: string | null;
    department_ids?: string[];
    conversation_id?: string | null;
    source_conversation_id?: string | null;
    project_id?: string | null;
    problem_statement?: string | null;
    decision_text?: string;
    reasoning?: string | null;
    status?: string;
    auto_inject?: boolean;
    scope?: string;
    tags?: string[] | null;
  }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/knowledge`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to save knowledge entry' }));
      throw new Error(error.detail || 'Failed to save knowledge entry');
    }
    return response.json();
  },

  async getKnowledgeEntries(companyId: string, options: ListDecisionsOptions = {}) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options.departmentId) params.append('department_id', options.departmentId);
    if (options.projectId) params.append('project_id', options.projectId);
    if (options.category) params.append('category', options.category);
    if (options.status !== undefined) params.append('status', options.status || '');
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());

    const url = `${API_BASE}${API_VERSION}/knowledge/${companyId}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to get knowledge entries');
    }
    return response.json();
  },

  async updateKnowledgeEntry(entryId: string, updates: Record<string, unknown>) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/knowledge/${entryId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to update knowledge entry' }));
      throw new Error(error.detail || 'Failed to update knowledge entry');
    }
    return response.json();
  },

  async deactivateKnowledgeEntry(entryId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/knowledge/${entryId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to deactivate knowledge entry');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  async getProjectReport(projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/${projectId}/report`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to generate report' }));
      throw new Error(error.detail || 'Failed to generate report');
    }
    return response.json();
  },

  async getKnowledgeCountForConversation(conversationId: string, companyId: string) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ company_id: companyId });
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/knowledge-count?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get knowledge count');
    }
    return response.json();
  },

  async getConversationLinkedProject(conversationId: string, companyId: string) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ company_id: companyId });
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/linked-project?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get linked project');
    }
    return response.json();
  },

  async getConversationDecision(conversationId: string, companyId: string, responseIndex: number) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      company_id: companyId,
      response_index: responseIndex.toString(),
    });
    const response = await fetch(
      `${API_BASE}${API_VERSION}/knowledge/conversations/${conversationId}/decision?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      const error = new Error('Failed to get conversation decision') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return response.json();
  },

  async extractDecision(userQuestion: string, councilResponse: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/knowledge/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_question: userQuestion,
        council_response: councilResponse,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to extract decision' }));
      throw new Error(error.detail || 'Failed to extract decision');
    }
    return response.json();
  },

  async extractProject(userQuestion: string, councilResponse: string, companyId?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_question: userQuestion,
        council_response: councilResponse,
        company_id: companyId,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to extract project' }));
      throw new Error(error.detail || 'Failed to extract project');
    }
    return response.json();
  },

  async structureProjectContext(freeText: string, projectName: string = '', companyId?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/structure-context`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        free_text: freeText,
        project_name: projectName,
        company_id: companyId,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to structure context' }));
      throw new Error(error.detail || 'Failed to structure context');
    }
    return response.json();
  },

  async structureDepartment(description: string, companyId?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/departments/structure`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description,
        company_id: companyId,
      }),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to structure department' }));
      throw new Error(error.detail || 'Failed to structure department');
    }
    return response.json();
  },

  async structureRole(description: string, departmentId?: string, companyId?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/roles/structure`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description,
        department_id: departmentId,
        company_id: companyId,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to structure role' }));
      throw new Error(error.detail || 'Failed to structure role');
    }
    return response.json();
  },

  async structurePlaybook(
    description: string,
    companyId?: string,
    docType?: 'sop' | 'framework' | 'policy'
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/playbooks/structure`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description,
        company_id: companyId,
        doc_type: docType || undefined,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to structure playbook' }));
      throw new Error(error.detail || 'Failed to structure playbook');
    }
    return response.json();
  },

  async structureCompanyContext(companyId: string, description: string, companyName?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/context/structure`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description,
          company_name: companyName,
        }),
      }
    );
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to structure company context' }));
      throw new Error(error.detail || 'Failed to structure company context');
    }
    return response.json();
  },

  async mergeDecisionIntoProject(
    projectId: string,
    existingContext: string,
    decisionContent: string,
    userQuestion: string = '',
    options: SaveDecisionOptions = {}
  ) {
    const headers = await getAuthHeaders();
    const body: Record<string, unknown> = {
      existing_context: existingContext || '',
      decision_content: decisionContent || '',
      user_question: userQuestion || '',
    };
    log.debug('mergeDecisionIntoProject called', {
      projectId,
      existingContextLength: existingContext?.length ?? 'undefined',
      decisionContentLength: decisionContent?.length ?? 'undefined',
      userQuestion: userQuestion?.substring(0, 50) ?? 'undefined',
      options: Object.keys(options),
    });

    if (options.saveDecision) {
      body.save_decision = true;
      body.company_id = options.companyId || null;
      body.conversation_id = options.conversationId || null;
      body.response_index =
        typeof options.responseIndex === 'number' ? options.responseIndex : null;
      body.decision_title = options.decisionTitle || null;
      body.department_id = options.departmentId || null;
      body.department_ids =
        Array.isArray(options.departmentIds) && options.departmentIds.length > 0
          ? options.departmentIds
          : null;
      log.debug('mergeDecisionIntoProject body', { body });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      log.info('Starting merge-decision request');
      const response = await fetch(
        `${API_BASE}${API_VERSION}/projects/${projectId}/merge-decision`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      log.debug('merge-decision response status', { status: response.status });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to merge decision' }));
        log.error('merge-decision error', { error, status: response.status });
        const errorMsg = Array.isArray(error.detail)
          ? error.detail
              .map((e: { loc?: string[]; msg?: string }) => `${e.loc?.join('.')}: ${e.msg}`)
              .join('; ')
          : error.detail || 'Failed to merge decision';
        throw new Error(errorMsg);
      }
      const result = await response.json();
      log.info('merge-decision success', { savedDecisionId: result.saved_decision_id });
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        log.error('merge-decision request timed out after 60s');
        throw new Error('Request timed out. The AI merge is taking too long. Please try again.');
      }
      throw err;
    }
  },
};
