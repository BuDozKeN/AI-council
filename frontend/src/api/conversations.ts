/**
 * Conversations domain API methods.
 * Includes conversation CRUD, streaming, triage, leaderboard, and curation.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders, handleErrorResponse, log } from './client';
import type { ListConversationsOptions, SendMessageStreamOptions, ChatStreamOptions, SSEEventCallback } from './types';

export const conversationsMethods = {
  async listBusinesses() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/businesses`, { headers });
    if (!response.ok) {
      await handleErrorResponse(response, 'Failed to list businesses');
    }
    const data = await response.json();
    // Backend returns { companies: [...], has_more: bool }, but callers expect an array
    return data.companies || [];
  },

  async listConversations({
    limit = 20,
    offset = 0,
    search = '',
    includeArchived = false,
    sortBy = 'date',
    companyId = null,
  }: ListConversationsOptions = {}) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    params.set('sort_by', sortBy);
    if (search) {
      params.set('search', search);
    }
    if (includeArchived) {
      params.set('include_archived', 'true');
    }
    if (companyId) {
      params.set('company_id', companyId);
    }
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations?${params}`, { headers });
    if (!response.ok) {
      await handleErrorResponse(response, 'Failed to list conversations');
    }
    return response.json();
  },

  async starConversation(conversationId: string, starred = true) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations/${conversationId}/star`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ starred }),
    });
    if (!response.ok) {
      throw new Error('Failed to star conversation');
    }
    return response.json();
  },

  async createConversation(companyId: string | null = null) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ company_id: companyId }),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  async getConversation(conversationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations/${conversationId}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  async sendMessage(conversationId: string, content: string, businessId: string | null = null) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, business_id: businessId }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  async sendMessageStream(
    conversationId: string,
    content: string,
    onEvent: SSEEventCallback,
    options: SendMessageStreamOptions = {}
  ) {
    const {
      businessId = null,
      department = 'standard',
      role = null,
      departments = null,
      roles = null,
      playbooks = null,
      projectId = null,
      attachmentIds = null,
      signal = null,
      preset = null,
    } = options;
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          business_id: businessId,
          department,
          role,
          departments,
          roles,
          playbooks,
          project_id: projectId,
          attachment_ids: attachmentIds,
          preset_override: preset,
        }),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        while (buffer.includes('\n\n')) {
          const eventEnd = buffer.indexOf('\n\n');
          const eventText = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          for (const line of eventText.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);
                onEvent(event.type, event);
              } catch (e) {
                log.error('Failed to parse SSE event', { error: e });
              }
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        onEvent('cancelled', { message: 'Request was cancelled' });
      } else {
        throw e;
      }
    }
  },

  async sendChatStream(
    conversationId: string,
    content: string,
    onEvent: SSEEventCallback,
    options: ChatStreamOptions = {}
  ) {
    const {
      businessId = null,
      departmentId = null,
      departmentIds = null,
      roleIds = null,
      playbookIds = null,
      projectId = null,
      attachmentIds = null,
      signal = null,
    } = options;
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/chat/stream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          business_id: businessId,
          department_id: departmentId,
          department_ids: departmentIds,
          role_ids: roleIds,
          playbook_ids: playbookIds,
          project_id: projectId,
          attachment_ids: attachmentIds,
        }),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes('\n\n')) {
          const eventEnd = buffer.indexOf('\n\n');
          const eventText = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          for (const line of eventText.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);
                onEvent(event.type, event);
              } catch (e) {
                log.error('Failed to parse SSE event', { error: e });
              }
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        onEvent('cancelled', { message: 'Request was cancelled' });
      } else {
        throw e;
      }
    }
  },

  async getLeaderboardSummary() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/leaderboard`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get leaderboard');
    }
    return response.json();
  },

  async getOverallLeaderboard() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/leaderboard/overall`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get overall leaderboard');
    }
    return response.json();
  },

  async getDepartmentLeaderboard(department: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/leaderboard/department/${department}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get department leaderboard');
    }
    return response.json();
  },

  async analyzeTriage(content: string, businessId: string | null = null) {
    const response = await fetch(`${API_BASE}${API_VERSION}/triage/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, business_id: businessId }),
    });
    if (!response.ok) {
      throw new Error('Failed to analyze triage');
    }
    return response.json();
  },

  async continueTriage(
    originalQuery: string,
    previousConstraints: Record<string, unknown>,
    userResponse: string,
    businessId: string | null = null
  ) {
    const response = await fetch(`${API_BASE}${API_VERSION}/triage/continue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_query: originalQuery,
        previous_constraints: previousConstraints,
        user_response: userResponse,
        business_id: businessId,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to continue triage');
    }
    return response.json();
  },

  async exportConversation(conversationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/export`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to export conversation');
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'conversation.md';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match?.[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async renameConversation(conversationId: string, title: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/rename`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to rename conversation');
    }
    return response.json();
  },

  async archiveConversation(conversationId: string, archived = true) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/archive`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ archived }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to archive conversation');
    }
    return response.json();
  },

  async updateConversationDepartment(conversationId: string, department: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/department`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ department }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to update conversation department');
    }
    return response.json();
  },

  async deleteConversation(conversationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  async bulkDeleteConversations(conversationIds: string[]) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations/bulk-delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_ids: conversationIds }),
    });
    if (!response.ok) {
      throw new Error('Failed to bulk delete conversations');
    }
    return response.json();
  },

  async curateConversation(
    conversationId: string,
    businessId: string,
    departmentId: string | null = null
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/curate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          business_id: businessId,
          department_id: departmentId,
        }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to analyze conversation');
    }
    return response.json();
  },
};
