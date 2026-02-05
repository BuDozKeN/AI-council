/**
 * Projects domain API methods.
 * Includes project CRUD, stats, regeneration, and utilities.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders } from './client';

export const projectsMethods = {
  async listProjects(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/companies/${companyId}/projects`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to list projects');
    }
    return response.json();
  },

  async createProject(
    companyId: string,
    project: {
      name: string;
      description?: string;
      context_md?: string;
      department_ids?: string[];
      source?: 'ai' | 'manual';
    }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/companies/${companyId}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(project),
    });
    if (!response.ok) {
      let errorDetail = 'Failed to create project';
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorDetail;
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorDetail);
    }
    return response.json();
  },

  async getProject(projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/${projectId}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get project');
    }
    return response.json();
  },

  async updateProject(projectId: string, updates: Record<string, unknown>) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/${projectId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update project' }));
      throw new Error(error.detail || 'Failed to update project');
    }
    return response.json();
  },

  async touchProject(projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/${projectId}/touch`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to touch project');
    }
    return response.json();
  },

  async regenerateProjectContext(projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/projects/${projectId}/regenerate-context`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to regenerate context' }));
      throw new Error(error.detail || 'Failed to regenerate context');
    }
    return response.json();
  },

  async deleteProject(projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/${projectId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete project' }));
      throw new Error(error.detail || 'Failed to delete project');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  async listProjectsWithStats(
    companyId: string,
    options: { status?: string; includeArchived?: boolean } = {}
  ) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.includeArchived) params.append('include_archived', 'true');

    const url = `${API_BASE}${API_VERSION}/companies/${companyId}/projects/stats${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to list projects with stats');
    }
    return response.json();
  },

  async polishText(text: string, fieldType: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/utils/polish-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, field_type: fieldType }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to polish text' }));
      throw new Error(error.detail || 'Failed to polish text');
    }
    return response.json();
  },
};
