/**
 * Context, suggestions, and settings domain API methods.
 * Includes context sections, suggestions, role/department CRUD, mock/caching settings.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders } from './client';

export const contextMethods = {
  async applySuggestion(businessId: string, suggestion: Record<string, unknown>) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/context/apply-suggestion`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        business_id: businessId,
        suggestion: suggestion,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to apply suggestion');
    }
    return response.json();
  },

  async getContextSection(
    businessId: string,
    sectionName: string,
    department: string | null = null
  ) {
    const headers = await getAuthHeaders();
    let url = `${API_BASE}${API_VERSION}/context/${businessId}/section/${encodeURIComponent(sectionName)}`;
    if (department && department !== 'company') {
      url += `?department=${encodeURIComponent(department)}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to get context section');
    }
    return response.json();
  },

  async saveCuratorRun(
    conversationId: string,
    businessId: string,
    suggestionsCount: number,
    acceptedCount: number,
    rejectedCount: number
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/curator-history`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          business_id: businessId,
          suggestions_count: suggestionsCount,
          accepted_count: acceptedCount,
          rejected_count: rejectedCount,
        }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to save curator run');
    }
    return response.json();
  },

  async getCuratorHistory(conversationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/curator-history`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get curator history');
    }
    return response.json();
  },

  async getMockMode() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/mock-mode`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get mock mode status');
    }
    return response.json();
  },

  async setMockMode(enabled: boolean) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/mock-mode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      throw new Error('Failed to set mock mode');
    }
    return response.json();
  },

  async getCachingMode() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/caching-mode`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get caching mode status');
    }
    return response.json();
  },

  async setCachingMode(enabled: boolean) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/caching-mode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      throw new Error('Failed to set caching mode');
    }
    return response.json();
  },

  async getMockLengthOverride() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/mock-length-override`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get mock length override status');
    }
    return response.json();
  },

  async setMockLengthOverride(lengthOverride: number | null) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/mock-length-override`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ length_override: lengthOverride }),
    });
    if (!response.ok) {
      throw new Error('Failed to set mock length override');
    }
    return response.json();
  },

  async getContextLastUpdated(businessId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/context/${businessId}/last-updated`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get context last updated');
    }
    return response.json();
  },

  async getRoleContext(companyId: string, departmentId: string, roleId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/departments/${departmentId}/roles/${roleId}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get role context');
    }
    const data = await response.json();
    return {
      context: data.role?.system_prompt || null,
      exists: !!data.role?.system_prompt,
      path: `Database: roles/${roleId}`,
    };
  },

  async deleteDepartment(companyId: string, departmentId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/departments/${departmentId}`,
      { method: 'DELETE', headers }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete department' }));
      throw new Error(error.detail || 'Failed to delete department');
    }
    return response.json();
  },

  async deleteRole(companyId: string, departmentId: string, roleId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/departments/${departmentId}/roles/${roleId}`,
      { method: 'DELETE', headers }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete role' }));
      throw new Error(error.detail || 'Failed to delete role');
    }
    return response.json();
  },
};
