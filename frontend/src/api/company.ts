/**
 * My Company domain API methods.
 * Includes company overview, team, playbooks, decisions, activity,
 * members, invitations, usage, and settings.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders } from './client';
import type { ListActivityOptions } from './types';

export const companyMethods = {
  async getCompanyOverview(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/overview`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get company overview');
    }
    return response.json();
  },

  async updateCompanyOverview(companyId: string, data: { name?: string; description?: string }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/overview`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update company' }));
      throw new Error(error.detail || 'Failed to update company');
    }
    return response.json();
  },

  async updateCompanyContext(companyId: string, data: { context_md: string }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/context`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to update company context' }));
      throw new Error(error.detail || 'Failed to update company context');
    }
    return response.json();
  },

  async getCompanyTeam(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/team`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get team structure');
    }
    return response.json();
  },

  async createCompanyDepartment(
    companyId: string,
    dept: { name: string; slug?: string; description?: string; purpose?: string }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/departments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dept),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create department' }));
      throw new Error(error.detail || 'Failed to create department');
    }
    return response.json();
  },

  async updateCompanyDepartment(
    companyId: string,
    deptId: string,
    data: { name?: string; slug?: string; description?: string; purpose?: string }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/departments/${deptId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update department' }));
      throw new Error(error.detail || 'Failed to update department');
    }
    return response.json();
  },

  async createCompanyRole(
    companyId: string,
    deptId: string,
    role: {
      name: string;
      slug?: string;
      title?: string;
      responsibilities?: string;
      system_prompt?: string;
    }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/departments/${deptId}/roles`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(role),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create role' }));
      throw new Error(error.detail || 'Failed to create role');
    }
    return response.json();
  },

  async updateCompanyRole(
    companyId: string,
    deptId: string,
    roleId: string,
    updates: { name?: string; title?: string; responsibilities?: string; system_prompt?: string }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/departments/${deptId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update role' }));
      throw new Error(error.detail || 'Failed to update role');
    }
    return response.json();
  },

  async getCompanyPlaybooks(companyId: string, docType: string | null = null) {
    const headers = await getAuthHeaders();
    const params = docType ? `?doc_type=${docType}` : '';
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/playbooks${params}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get playbooks');
    }
    return response.json();
  },

  async getCompanyPlaybookTags(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/playbooks/tags`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get playbook tags');
    }
    return response.json();
  },

  async getPlaybook(companyId: string, playbookId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/playbooks/${playbookId}`,
      { headers }
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to get playbook');
    }
    return response.json();
  },

  async createCompanyPlaybook(
    companyId: string,
    playbook: {
      title: string;
      doc_type: string;
      content?: string | undefined;
      department_id?: string | undefined;
      department_ids?: string[] | null | undefined;
    }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/playbooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(playbook),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create playbook' }));
      throw new Error(error.detail || 'Failed to create playbook');
    }
    return response.json();
  },

  async updateCompanyPlaybook(
    companyId: string,
    playbookId: string,
    data: {
      content?: string;
      change_summary?: string;
      title?: string;
      status?: string;
      additional_departments?: string[];
    }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/playbooks/${playbookId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update playbook' }));
      throw new Error(error.detail || 'Failed to update playbook');
    }
    return response.json();
  },

  // Alias for updateCompanyPlaybook for consistency with MyCompany.jsx naming
  async updatePlaybook(
    companyId: string,
    playbookId: string,
    data: {
      content?: string;
      change_summary?: string;
      title?: string;
      status?: string;
      additional_departments?: string[];
    }
  ) {
    return this.updateCompanyPlaybook(companyId, playbookId, data);
  },

  async deletePlaybook(companyId: string, playbookId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/playbooks/${playbookId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete playbook' }));
      throw new Error(error.detail || 'Failed to delete playbook');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  async getCompanyDecisions(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/decisions`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get decisions');
    }
    return response.json();
  },

  async getDecision(companyId: string, decisionId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}`,
      { headers }
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to get decision');
    }
    const data = await response.json();
    return data.decision;
  },

  async createCompanyDecision(
    companyId: string,
    decision: {
      title: string;
      content: string;
      department_id?: string | undefined;
      department_ids?: string[] | undefined;
      project_id?: string | undefined;
      source_conversation_id?: string | undefined;
      user_question?: string | undefined;
      response_index?: number | undefined;
      tags?: string[] | undefined;
    }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/decisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(decision),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to save decision' }));
      throw new Error(error.detail || 'Failed to save decision');
    }
    return response.json();
  },

  async getProjectDecisions(companyId: string, projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/projects/${projectId}/decisions`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get project decisions');
    }
    return response.json();
  },

  async promoteDecisionToPlaybook(
    companyId: string,
    decisionId: string,
    data: { doc_type: string; title?: string; department_id?: string; department_ids?: string[] }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}/promote`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to promote decision' }));
      throw new Error(error.detail || 'Failed to promote decision');
    }
    return response.json();
  },

  async linkDecisionToProject(companyId: string, decisionId: string, projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}/link-project`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ project_id: projectId }),
      }
    );
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to link decision to project' }));
      throw new Error(error.detail || 'Failed to link decision to project');
    }
    return response.json();
  },

  async createProjectFromDecision(
    companyId: string,
    decisionId: string,
    data: { name: string; department_ids?: string[] }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}/create-project`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to create project from decision' }));
      throw new Error(error.detail || 'Failed to create project from decision');
    }
    return response.json();
  },

  async archiveDecision(companyId: string, decisionId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}/archive`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to archive decision' }));
      throw new Error(error.detail || 'Failed to archive decision');
    }
    return response.json();
  },

  async syncProjectDepartments(companyId: string, projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/projects/${projectId}/sync-departments`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to sync departments' }));
      throw new Error(error.detail || 'Failed to sync departments');
    }
    return response.json();
  },

  async deleteDecision(companyId: string, decisionId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete decision' }));
      throw new Error(error.detail || 'Failed to delete decision');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  async generateDecisionSummary(companyId: string, decisionId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/decisions/${decisionId}/generate-summary`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to generate summary' }));
      throw new Error(error.detail || 'Failed to generate summary');
    }
    return response.json();
  },

  async getCompanyActivity(companyId: string, options: ListActivityOptions = {}) {
    const { limit = 50, eventType = null, days = null } = options;
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (eventType) params.append('event_type', eventType);
    if (days) params.append('days', String(days));
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/activity${queryString}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get activity logs');
    }
    return response.json();
  },

  async aiWriteAssist({
    prompt,
    context,
    playbookType,
  }: {
    prompt: string;
    context: string;
    playbookType?: string;
  }): Promise<{ suggestion: string; title?: string }> {
    const headers = await getAuthHeaders();
    const body: Record<string, string> = { prompt, context };
    if (playbookType) {
      body.playbook_type = playbookType;
    }
    const response = await fetch(`${API_BASE}${API_VERSION}/ai/write-assist`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get AI suggestion' }));
      throw new Error(error.detail || 'Failed to get AI suggestion');
    }
    return response.json();
  },

  async mergeCompanyContext({
    companyId,
    existingContext,
    question,
    answer,
  }: {
    companyId: string;
    existingContext: string;
    question: string;
    answer: string;
  }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/context/merge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        existing_context: existingContext,
        question,
        answer,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to merge context' }));
      throw new Error(error.detail || 'Failed to merge context');
    }
    return response.json();
  },

  // ===== TEAM MEMBERS =====

  async getCompanyMembers(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/members`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get company members');
    }
    return response.json();
  },

  async addCompanyMember(companyId: string, email: string, role: 'admin' | 'member' = 'member') {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add member' }));
      throw new Error(error.detail || 'Failed to add member');
    }
    return response.json();
  },

  async updateCompanyMember(companyId: string, memberId: string, role: 'admin' | 'member') {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/members/${memberId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role }),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update member' }));
      throw new Error(error.detail || 'Failed to update member');
    }
    return response.json();
  },

  async removeCompanyMember(companyId: string, memberId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/members/${memberId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
      throw new Error(error.detail || 'Failed to remove member');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  // ===== COMPANY INVITATIONS =====

  async getCompanyInvitations(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/invitations`, {
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get invitations' }));
      throw new Error(error.detail || 'Failed to get invitations');
    }
    return response.json();
  },

  async cancelCompanyInvitation(companyId: string, invitationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/invitations/${invitationId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to cancel invitation' }));
      throw new Error(error.detail || 'Failed to cancel invitation');
    }
    return response.json();
  },

  async resendCompanyInvitation(companyId: string, invitationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/invitations/${invitationId}/resend`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to resend invitation' }));
      throw new Error(error.detail || 'Failed to resend invitation');
    }
    return response.json();
  },

  async acceptCompanyInvitation(token: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/invitations/accept-company?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to accept invitation' }));
      throw new Error(error.detail || 'Failed to accept invitation');
    }
    return response.json();
  },

  // ===== USAGE TRACKING =====

  async getCompanyUsage(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/usage`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get company usage');
    }
    return response.json();
  },

  // ===== BYOK (Bring Your Own Key) =====

  async getOpenRouterKeyStatus() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get API key status');
    }
    return response.json();
  },

  async saveOpenRouterKey(key: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to save API key' }));
      throw new Error(error.detail || 'Failed to save API key');
    }
    return response.json();
  },

  async deleteOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete API key');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  async testOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key/test`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to test API key' }));
      throw new Error(error.detail || 'Failed to test API key');
    }
    return response.json();
  },

  async toggleOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key/toggle`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to toggle API key' }));
      throw new Error(error.detail || 'Failed to toggle API key');
    }
    return response.json();
  },

  async getUserSettings() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get user settings');
    }
    return response.json();
  },

  async updateUserSettings(updates: { default_mode?: 'quick' | 'full_council' }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update user settings');
    }
    return response.json();
  },
};
