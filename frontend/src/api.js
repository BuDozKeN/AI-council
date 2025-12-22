/**
 * API client for the AI Council backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Token getter function - set by the app to provide auth tokens
let getAccessToken = null;

/**
 * Set the function that retrieves the access token.
 * @param {function} getter - Async function that returns the access token
 */
export const setTokenGetter = (getter) => {
  getAccessToken = getter;
};

/**
 * Get headers including Authorization if token is available.
 */
const getAuthHeaders = async () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
};

export const api = {
  /**
   * List all available business contexts.
   * Requires authentication.
   */
  async listBusinesses() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/businesses`, { headers });
    if (!response.ok) {
      throw new Error('Failed to list businesses');
    }
    return response.json();
  },

  /**
   * List conversations for the authenticated user with pagination and search.
   * Returns { conversations: [...], has_more: bool }
   *
   * @param {Object} options - Query options
   * @param {number} options.limit - Max conversations to return (default 20)
   * @param {number} options.offset - Number to skip for pagination (default 0)
   * @param {string} options.search - Optional search string for title filtering
   * @param {boolean} options.includeArchived - Include archived conversations (default false)
   * @param {string} options.sortBy - Sort order: "date" (most recent first) or "activity" (most messages first)
   * @param {string} options.companyId - Optional company ID to filter conversations by
   */
  async listConversations({ limit = 20, offset = 0, search = '', includeArchived = false, sortBy = 'date', companyId = null } = {}) {
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
    const response = await fetch(`${API_BASE}/api/conversations?${params}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Star or unstar a conversation.
   * Starred conversations appear at the top of the list.
   *
   * @param {string} conversationId - ID of the conversation
   * @param {boolean} starred - True to star, false to unstar
   */
  async starConversation(conversationId, starred = true) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/star`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ starred }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to star conversation');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   * @param {string} companyId - The company ID to associate with this conversation
   */
  async createConversation(companyId = null) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ company_id: companyId }),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {string|null} businessId - Optional business context ID
   */
  async sendMessage(conversationId, content, businessId = null) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
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

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {object} options - Context options
   * @param {string|null} options.businessId - Optional business context ID
   * @param {string|null} options.department - Optional single department (legacy)
   * @param {string|null} options.role - Optional single role (legacy)
   * @param {string[]|null} options.departments - Optional array of department UUIDs for multi-select
   * @param {string[]|null} options.roles - Optional array of role UUIDs for multi-select
   * @param {string|null} options.projectId - Optional project ID for project-specific context
   * @param {string[]|null} options.attachmentIds - Optional list of attachment IDs (images to analyze)
   * @param {AbortSignal} options.signal - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent, options = {}) {
    const { businessId = null, department = 'standard', role = null, departments = null, roles = null, playbooks = null, projectId = null, attachmentIds = null, signal = null } = options;
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          business_id: businessId,
          department,
          role,
          departments,  // Multi-select support
          roles,        // Multi-select support
          playbooks,    // Playbook IDs to inject
          project_id: projectId,
          attachment_ids: attachmentIds,
        }),
        signal, // Allow cancellation
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; // Buffer for incomplete SSE events

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete SSE events (separated by double newlines)
        while (buffer.includes('\n\n')) {
          const eventEnd = buffer.indexOf('\n\n');
          const eventText = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          // Parse the SSE event
          for (const line of eventText.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);
                onEvent(event.type, event);
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        onEvent('cancelled', { message: 'Request was cancelled' });
      } else {
        throw e;
      }
    }
  },

  /**
   * Send a chat message (Chairman only, no full council deliberation).
   * Used for follow-up questions after council response.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {object} options - Context options
   * @param {string|null} options.businessId - Optional business context ID
   * @param {string|null} options.departmentId - Optional single department (legacy)
   * @param {string[]|null} options.departmentIds - Optional array of department UUIDs for multi-select
   * @param {string[]|null} options.roleIds - Optional array of role UUIDs for multi-select
   * @param {string|null} options.projectId - Optional project ID for project-specific context
   * @param {AbortSignal} options.signal - Optional AbortSignal for cancellation
   * @returns {Promise<void>}
   */
  async sendChatStream(conversationId, content, onEvent, options = {}) {
    const { businessId = null, departmentId = null, departmentIds = null, roleIds = null, playbookIds = null, projectId = null, signal = null } = options;
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/chat/stream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          business_id: businessId,
          department_id: departmentId,
          department_ids: departmentIds,  // Multi-select support
          role_ids: roleIds,              // Multi-select support
          playbook_ids: playbookIds,      // Playbook IDs to inject
          project_id: projectId,
        }),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
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
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        onEvent('cancelled', { message: 'Request was cancelled' });
      } else {
        throw e;
      }
    }
  },

  /**
   * Get leaderboard summary (overall + all departments).
   */
  async getLeaderboardSummary() {
    const response = await fetch(`${API_BASE}/api/leaderboard`);
    if (!response.ok) {
      throw new Error('Failed to get leaderboard');
    }
    return response.json();
  },

  /**
   * Get overall leaderboard.
   */
  async getOverallLeaderboard() {
    const response = await fetch(`${API_BASE}/api/leaderboard/overall`);
    if (!response.ok) {
      throw new Error('Failed to get overall leaderboard');
    }
    return response.json();
  },

  /**
   * Get department-specific leaderboard.
   * @param {string} department - The department name
   */
  async getDepartmentLeaderboard(department) {
    const response = await fetch(`${API_BASE}/api/leaderboard/department/${department}`);
    if (!response.ok) {
      throw new Error('Failed to get department leaderboard');
    }
    return response.json();
  },

  /**
   * Analyze a question for triage (check for 4 constraints).
   * @param {string} content - The user's question
   * @param {string|null} businessId - Optional business context ID
   * @returns {Promise<{ready: boolean, constraints: object, missing: string[], questions: string|null, enhanced_query: string}>}
   */
  async analyzeTriage(content, businessId = null) {
    const response = await fetch(`${API_BASE}/api/triage/analyze`, {
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

  /**
   * Continue triage conversation with additional user info.
   * @param {string} originalQuery - The original question
   * @param {object} previousConstraints - Previously extracted constraints
   * @param {string} userResponse - User's response to triage questions
   * @param {string|null} businessId - Optional business context ID
   * @returns {Promise<{ready: boolean, constraints: object, missing: string[], questions: string|null, enhanced_query: string}>}
   */
  async continueTriage(originalQuery, previousConstraints, userResponse, businessId = null) {
    const response = await fetch(`${API_BASE}/api/triage/continue`, {
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

  /**
   * Export a conversation as Markdown file.
   * @param {string} conversationId - The conversation ID
   * @returns {Promise<void>} - Triggers a file download
   */
  async exportConversation(conversationId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/export`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to export conversation');
    }

    // Get the filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'conversation.md';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }

    // Download the file
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

  /**
   * Rename a conversation.
   * @param {string} conversationId - The conversation ID
   * @param {string} title - The new title
   */
  async renameConversation(conversationId, title) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/rename`,
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

  /**
   * Archive or unarchive a conversation.
   * @param {string} conversationId - The conversation ID
   * @param {boolean} archived - True to archive, false to unarchive
   */
  async archiveConversation(conversationId, archived = true) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/archive`,
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

  /**
   * Update the department of a conversation.
   * Used for drag-and-drop to move conversations between departments.
   * @param {string} conversationId - The conversation ID
   * @param {string} department - The target department ID/slug
   * @returns {Promise<{success: boolean, department: string}>}
   */
  async updateConversationDepartment(conversationId, department) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/department`,
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

  /**
   * Permanently delete a conversation.
   * @param {string} conversationId - The conversation ID
   */
  async deleteConversation(conversationId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    return response.json();
  },

  /**
   * Bulk delete multiple conversations.
   * @param {string[]} conversationIds - Array of conversation IDs to delete
   * @returns {Promise<{deleted: string[], failed: Array, deleted_count: number}>}
   */
  async bulkDeleteConversations(conversationIds) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/bulk-delete`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversation_ids: conversationIds }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to bulk delete conversations');
    }
    return response.json();
  },

  /**
   * Analyze a conversation for potential knowledge base updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} businessId - The business context ID
   * @param {string|null} departmentId - Optional department ID
   * @returns {Promise<{suggestions: Array, summary: string, analyzed_at: string}>}
   */
  async curateConversation(conversationId, businessId, departmentId = null) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/curate`,
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

  /**
   * Apply a suggestion to update the business context.
   * Requires authentication.
   * @param {string} businessId - The business context ID
   * @param {object} suggestion - The suggestion object to apply
   * @returns {Promise<{success: boolean, message: string, updated_at: string}>}
   */
  async applySuggestion(businessId, suggestion) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/context/apply-suggestion`, {
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

  /**
   * Get a specific section from the business context.
   * Requires authentication.
   * @param {string} businessId - The business context ID
   * @param {string} sectionName - The section name to retrieve
   * @param {string|null} department - Optional department ID to look in department context
   * @returns {Promise<{section: string, content: string, exists: boolean}>}
   */
  async getContextSection(businessId, sectionName, department = null) {
    const headers = await getAuthHeaders();
    let url = `${API_BASE}/api/context/${businessId}/section/${encodeURIComponent(sectionName)}`;
    if (department && department !== 'company') {
      url += `?department=${encodeURIComponent(department)}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to get context section');
    }
    return response.json();
  },

  /**
   * Save a record that the curator was run on this conversation.
   * @param {string} conversationId - The conversation ID
   * @param {string} businessId - The business context ID
   * @param {number} suggestionsCount - Total suggestions generated
   * @param {number} acceptedCount - Number of suggestions accepted
   * @param {number} rejectedCount - Number of suggestions rejected
   * @returns {Promise<{success: boolean}>}
   */
  async saveCuratorRun(conversationId, businessId, suggestionsCount, acceptedCount, rejectedCount) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/curator-history`,
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

  /**
   * Get curator run history for a conversation.
   * @param {string} conversationId - The conversation ID
   * @returns {Promise<{history: Array}>}
   */
  async getCuratorHistory(conversationId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/curator-history`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get curator history');
    }
    return response.json();
  },

  /**
   * Get current mock mode status.
   * @returns {Promise<{enabled: boolean, scenario: string}>}
   */
  async getMockMode() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/mock-mode`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get mock mode status');
    }
    return response.json();
  },

  /**
   * Toggle mock mode on/off.
   * @param {boolean} enabled - Whether to enable mock mode
   * @returns {Promise<{success: boolean, enabled: boolean, message: string}>}
   */
  async setMockMode(enabled) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/mock-mode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      throw new Error('Failed to set mock mode');
    }
    return response.json();
  },

  /**
   * Get current prompt caching status.
   * @returns {Promise<{enabled: boolean, supported_models: string[]}>}
   */
  async getCachingMode() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/caching-mode`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get caching mode status');
    }
    return response.json();
  },

  /**
   * Toggle prompt caching on/off.
   * @param {boolean} enabled - Whether to enable prompt caching
   * @returns {Promise<{success: boolean, enabled: boolean, message: string}>}
   */
  async setCachingMode(enabled) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/caching-mode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      throw new Error('Failed to set caching mode');
    }
    return response.json();
  },

  /**
   * Get the last updated date from a business context file.
   * Requires authentication.
   * @param {string} businessId - The business context ID
   * @returns {Promise<{last_updated: string|null}>}
   */
  async getContextLastUpdated(businessId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/context/${businessId}/last-updated`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get context last updated');
    }
    return response.json();
  },

  /**
   * Create a new department for a company.
   * @deprecated Use createCompanyDepartment instead
   * @param {string} companyId - The company ID
   * @param {object} department - The department to create
   * @param {string} department.id - The department ID (used as slug)
   * @param {string} department.name - The display name for the department
   * @returns {Promise<Object>} Created department
   */
  async createDepartment(companyId, department) {
    // Delegate to new unified endpoint
    return this.createCompanyDepartment(companyId, {
      name: department.name,
      slug: department.id || department.name.toLowerCase().replace(/\s+/g, '-'),
      description: department.description || null,
    });
  },

  /**
   * Update a department's name and/or description.
   * @deprecated Use updateCompanyDepartment instead
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department ID to update
   * @param {object} updates - Fields to update
   * @returns {Promise<Object>} Updated department
   */
  async updateDepartment(companyId, departmentId, updates) {
    // Delegate to new unified endpoint
    return this.updateCompanyDepartment(companyId, departmentId, updates);
  },

  /**
   * Add a new role to a department.
   * @deprecated Use createCompanyRole instead
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department to add the role to
   * @param {object} role - The role to create
   * @param {string} role.role_id - The role ID (used as slug)
   * @param {string} role.role_name - The display name for the role
   * @param {string} role.role_description - Optional description
   * @returns {Promise<Object>} Created role
   */
  async addRole(companyId, departmentId, role) {
    // Delegate to new unified endpoint
    return this.createCompanyRole(companyId, departmentId, {
      name: role.role_name,
      slug: role.role_id || role.role_name.toLowerCase().replace(/\s+/g, '-'),
      title: role.role_name,
      responsibilities: role.role_description || null,
    });
  },

  /**
   * Update a role's name and/or description.
   * @deprecated Use updateCompanyRole instead
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department the role belongs to
   * @param {string} roleId - The role ID to update
   * @param {object} updates - Fields to update
   * @returns {Promise<Object>} Updated role
   */
  async updateRole(companyId, departmentId, roleId, updates) {
    // Delegate to new unified endpoint
    return this.updateCompanyRole(companyId, departmentId, roleId, {
      name: updates.name,
      responsibilities: updates.description,
    });
  },

  /**
   * Get the system prompt/context for a specific role.
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department ID
   * @param {string} roleId - The role ID
   * @returns {Promise<{role: Object}>} Role with system_prompt
   */
  async getRoleContext(companyId, departmentId, roleId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/company/${companyId}/departments/${departmentId}/roles/${roleId}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get role context');
    }
    const data = await response.json();
    // Transform to match old API shape for backwards compatibility
    return {
      context: data.role?.system_prompt || null,
      exists: !!data.role?.system_prompt,
      path: `Database: roles/${roleId}`,
    };
  },

  // ============ Projects API ============

  /**
   * List all projects for a company.
   * @param {string} companyId - The company ID
   * @returns {Promise<{projects: Array}>}
   */
  async listProjects(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/companies/${companyId}/projects`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to list projects');
    }
    return response.json();
  },

  /**
   * Create a new project for a company.
   * @param {string} companyId - The company ID
   * @param {object} project - The project data
   * @param {string} project.name - Project name
   * @param {string} project.description - Optional description
   * @param {string} project.context_md - Optional markdown context
   * @returns {Promise<{project: object}>}
   */
  async createProject(companyId, project) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/companies/${companyId}/projects`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(project),
      }
    );
    if (!response.ok) {
      // Try to get the actual error message from the server
      let errorDetail = 'Failed to create project';
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorDetail;
      } catch (e) {
        // Ignore JSON parse errors
      }
      throw new Error(errorDetail);
    }
    return response.json();
  },

  /**
   * Get a specific project.
   * @param {string} projectId - The project ID
   * @returns {Promise<{project: object}>}
   */
  async getProject(projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/projects/${projectId}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get project');
    }
    return response.json();
  },

  /**
   * Update a project.
   * @param {string} projectId - The project ID
   * @param {object} updates - Fields to update (name, description, context_md, status)
   * @returns {Promise<{project: object}>}
   */
  async updateProject(projectId, updates) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/projects/${projectId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update project' }));
      throw new Error(error.detail || 'Failed to update project');
    }
    return response.json();
  },

  /**
   * Touch a project's last_accessed_at timestamp (when selected in chat).
   * @param {string} projectId - The project ID
   * @returns {Promise<{success: boolean}>}
   */
  async touchProject(projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/projects/${projectId}/touch`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      throw new Error('Failed to touch project');
    }
    return response.json();
  },

  /**
   * Regenerate project context by synthesizing ALL decisions from scratch.
   * Useful when context has accumulated duplicates or garbage.
   * @param {string} projectId - The project ID
   * @returns {Promise<{success: boolean, context_md: string, message: string, decision_count: number}>}
   */
  async regenerateProjectContext(projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/projects/${projectId}/regenerate-context`,
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

  /**
   * Delete a project permanently.
   * @param {string} projectId - The project ID
   * @returns {Promise<{success: boolean}>}
   */
  async deleteProject(projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/projects/${projectId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete project' }));
      throw new Error(error.detail || 'Failed to delete project');
    }
    return response.json();
  },

  /**
   * List projects with stats for Command Centre.
   * @param {string} companyId - The company ID
   * @param {object} options - Optional filters
   * @param {string} options.status - Filter by status ('active', 'completed', 'archived')
   * @param {boolean} options.includeArchived - Include archived projects
   * @returns {Promise<{projects: Array}>}
   */
  async listProjectsWithStats(companyId, options = {}) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.includeArchived) params.append('include_archived', 'true');

    const url = `${API_BASE}/api/companies/${companyId}/projects/stats${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to list projects with stats');
    }
    return response.json();
  },

  // ============ Utils API ============

  /**
   * Polish/rewrite text using AI.
   * @param {string} text - The text to polish
   * @param {string} fieldType - The field type for context (client_background, goals, constraints, additional)
   * @returns {Promise<{polished: string}>}
   */
  async polishText(text, fieldType) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/utils/polish-text`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, field_type: fieldType }),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to polish text' }));
      throw new Error(error.detail || 'Failed to polish text');
    }
    return response.json();
  },

  // ============ Billing API ============

  // ============================================
  // PROFILE METHODS
  // ============================================

  /**
   * Get current user's profile.
   * @returns {Promise<{display_name: string, company: string, phone: string, bio: string}>}
   */
  async getProfile() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/profile`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get profile');
    }
    return response.json();
  },

  /**
   * Update current user's profile.
   * @param {Object} profile - Profile data
   * @param {string} profile.display_name - Display name
   * @param {string} profile.company - Company name
   * @param {string} profile.phone - Phone number
   * @param {string} profile.bio - Bio/description
   * @returns {Promise<{success: boolean, profile: Object}>}
   */
  async updateProfile(profile) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(profile),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update profile' }));
      throw new Error(error.detail || 'Failed to update profile');
    }
    return response.json();
  },

  // ============================================
  // BILLING METHODS
  // ============================================

  /**
   * Get available subscription plans.
   * @returns {Promise<Array>} List of available plans
   */
  async getBillingPlans() {
    const response = await fetch(`${API_BASE}/api/billing/plans`);
    if (!response.ok) {
      throw new Error('Failed to get billing plans');
    }
    return response.json();
  },

  /**
   * Get current user's subscription status.
   * @returns {Promise<{tier: string, status: string, queries_used: number, queries_limit: number, period_end: string|null, features: string[]}>}
   */
  async getSubscription() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/billing/subscription`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to get subscription');
    }
    return response.json();
  },

  /**
   * Check if user can make a council query.
   * @returns {Promise<{can_query: boolean, reason: string|null, remaining: number}>}
   */
  async canQuery() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/billing/can-query`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to check query permission');
    }
    return response.json();
  },

  /**
   * Create a Stripe Checkout session for subscribing to a plan.
   * @param {string} tierId - The tier to subscribe to (pro, enterprise)
   * @returns {Promise<{checkout_url: string, session_id: string}>}
   */
  async createCheckout(tierId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/billing/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tier_id: tierId,
        success_url: `${window.location.origin}/?billing=success`,
        cancel_url: `${window.location.origin}/?billing=cancelled`,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create checkout' }));
      throw new Error(error.detail || 'Failed to create checkout');
    }
    return response.json();
  },

  /**
   * Create a Stripe Billing Portal session for managing subscription.
   * @returns {Promise<{portal_url: string}>}
   */
  async createBillingPortal() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/billing/portal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        return_url: window.location.origin,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create portal' }));
      throw new Error(error.detail || 'Failed to create portal');
    }
    return response.json();
  },

  // ============================================
  // ATTACHMENTS METHODS
  // ============================================

  /**
   * Upload an image attachment.
   * @param {File} file - The image file to upload
   * @param {string|null} conversationId - Optional conversation ID to link to
   * @param {number|null} messageIndex - Optional message index within the conversation
   * @returns {Promise<{id: string, file_name: string, file_type: string, file_size: number, storage_path: string, signed_url: string}>}
   */
  async uploadAttachment(file, conversationId = null, messageIndex = null) {
    const token = getAccessToken ? await getAccessToken() : null;

    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    if (messageIndex !== null) {
      formData.append('message_index', messageIndex.toString());
    }

    const response = await fetch(`${API_BASE}/api/attachments/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to upload attachment' }));
      throw new Error(error.detail || 'Failed to upload attachment');
    }
    return response.json();
  },

  /**
   * Get attachment metadata and a fresh signed URL.
   * @param {string} attachmentId - The attachment ID
   * @returns {Promise<{id: string, file_name: string, file_type: string, file_size: number, storage_path: string, signed_url: string}>}
   */
  async getAttachment(attachmentId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/attachments/${attachmentId}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get attachment');
    }
    return response.json();
  },

  /**
   * Get a fresh signed URL for an attachment.
   * @param {string} attachmentId - The attachment ID
   * @returns {Promise<{signed_url: string}>}
   */
  async getAttachmentUrl(attachmentId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/attachments/${attachmentId}/url`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get attachment URL');
    }
    return response.json();
  },

  /**
   * Delete an attachment.
   * @param {string} attachmentId - The attachment ID
   * @returns {Promise<{success: boolean}>}
   */
  async deleteAttachment(attachmentId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete attachment');
    }
    return response.json();
  },

  // ============================================
  // KNOWLEDGE BASE METHODS
  // ============================================

  /**
   * Save a knowledge entry to the database.
   * @param {Object} entry - Knowledge entry to save
   * @param {string} entry.company_id - Company UUID
   * @param {string} entry.title - Title of the knowledge entry
   * @param {string} entry.summary - Summary/content of the entry
   * @param {string} entry.category - Category (technical_decision, ux_pattern, feature, policy, process)
   * @param {string|null} entry.department_id - Optional department UUID
   * @param {string|null} entry.conversation_id - Optional source conversation ID
   * @returns {Promise<{success: boolean, entry: Object}>}
   */
  async createKnowledgeEntry(entry) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/knowledge`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to save knowledge entry' }));
      throw new Error(error.detail || 'Failed to save knowledge entry');
    }
    return response.json();
  },

  /**
   * Get knowledge entries for a company with filtering options.
   * @param {string} companyId - Company UUID
   * @param {Object} options - Filter options
   * @param {string|null} options.departmentId - Filter by department
   * @param {string|null} options.projectId - Filter by project
   * @param {string|null} options.category - Filter by category
   * @param {string|null} options.status - Filter by status (active, superseded, archived, or empty for all)
   * @param {string|null} options.search - Search term for title/problem/decision
   * @param {number} options.limit - Max entries to return
   * @returns {Promise<{entries: Array}>}
   */
  async getKnowledgeEntries(companyId, options = {}) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options.departmentId) params.append('department_id', options.departmentId);
    if (options.projectId) params.append('project_id', options.projectId);
    if (options.category) params.append('category', options.category);
    if (options.status !== undefined) params.append('status', options.status || '');
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());

    const url = `${API_BASE}/api/knowledge/${companyId}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to get knowledge entries');
    }
    return response.json();
  },

  /**
   * Update a knowledge entry.
   * @param {string} entryId - Knowledge entry UUID
   * @param {Object} updates - Fields to update
   * @param {string|null} updates.title - New title
   * @param {string|null} updates.category - New category
   * @param {string|null} updates.department_id - New department
   * @param {string|null} updates.problem_statement - New problem statement
   * @param {string|null} updates.decision_text - New decision text
   * @param {string|null} updates.reasoning - New reasoning
   * @param {string|null} updates.status - New status (active, superseded, archived)
   * @param {string|null} updates.body_md - New long-form markdown content
   * @param {string|null} updates.version - New version string
   * @returns {Promise<Object>} Updated entry
   */
  async updateKnowledgeEntry(entryId, updates) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/knowledge/${entryId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update knowledge entry' }));
      throw new Error(error.detail || 'Failed to update knowledge entry');
    }
    return response.json();
  },

  /**
   * Deactivate a knowledge entry (soft delete).
   * @param {string} entryId - Knowledge entry UUID
   * @returns {Promise<{success: boolean}>}
   */
  async deactivateKnowledgeEntry(entryId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/knowledge/${entryId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to deactivate knowledge entry');
    }
    return response.json();
  },

  /**
   * Generate a project report with all decisions and recommendations.
   * Returns structured data that can be rendered as HTML/PDF.
   * Client-friendly - no mention of AI Council.
   * @param {string} projectId - Project UUID
   * @returns {Promise<Object>} Report data with:
   *   - project_name: string
   *   - generated_at: ISO timestamp
   *   - entry_count: number
   *   - categories: { [categoryName]: Array<{title, summary, date, department}> }
   *   - timeline: Array<{date, title, category}>
   *   - executive_summary: string
   */
  async getProjectReport(projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/report`, { headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to generate report' }));
      throw new Error(error.detail || 'Failed to generate report');
    }
    return response.json();
  },

  /**
   * Get count of knowledge entries saved from a specific conversation.
   * @param {string} conversationId - Conversation UUID
   * @param {string} companyId - Company UUID
   * @returns {Promise<{count: number}>}
   */
  async getKnowledgeCountForConversation(conversationId, companyId) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ company_id: companyId });
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/knowledge-count?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get knowledge count');
    }
    return response.json();
  },

  /**
   * Get any project linked to a conversation via saved decisions.
   * @param {string} conversationId - Conversation UUID
   * @param {string} companyId - Company UUID
   * @returns {Promise<{project: {id: string, name: string, description: string, status: string} | null}>}
   */
  async getConversationLinkedProject(conversationId, companyId) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ company_id: companyId });
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/linked-project?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get linked project');
    }
    return response.json();
  },

  /**
   * Check if a specific decision exists for this conversation and response index.
   * @param {string} conversationId - The conversation ID
   * @param {string} companyId - The company ID
   * @param {number} responseIndex - The index of the response within the conversation
   * @returns {Promise<{decision: Object|null}>}
   */
  async getConversationDecision(conversationId, companyId, responseIndex) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      company_id: companyId,
      response_index: responseIndex.toString()
    });
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/decision?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      const error = new Error('Failed to get conversation decision');
      error.status = response.status;
      throw error;
    }
    return response.json();
  },

  /**
   * Extract key decision/recommendation from a council response using AI.
   * This uses an LLM to intelligently extract what's important.
   * @param {string} userQuestion - The original user question
   * @param {string} councilResponse - The Stage 3 chairman synthesis
   * @returns {Promise<{success: boolean, extracted: Object, error: string}>}
   *   - extracted.title: Short descriptive title
   *   - extracted.problem_statement: What problem was addressed
   *   - extracted.decision_text: The key decision/recommendation
   *   - extracted.reasoning: Why this decision was made
   *   - extracted.category: One of technical_decision, ux_pattern, feature, policy, process
   *   - extracted.department: One of technology, ux, marketing, operations, strategy, finance, hr, general
   */
  async extractDecision(userQuestion, councilResponse) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/knowledge/extract`, {
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

  /**
   * Extract a clear project name and description from a council response using AI.
   * Designed to be understandable by anyone - like onboarding documentation.
   * @param {string} userQuestion - The original user question
   * @param {string} councilResponse - The Stage 3 chairman synthesis
   * @returns {Promise<{success: boolean, extracted: {name: string, description: string}, error: string}>}
   */
  async extractProject(userQuestion, councilResponse) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/projects/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_question: userQuestion,
        council_response: councilResponse,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to extract project' }));
      throw new Error(error.detail || 'Failed to extract project');
    }
    return response.json();
  },

  /**
   * Use AI to structure free-form project description into organized context.
   * @param {string} freeText - User's free-form project description
   * @param {string} projectName - Optional project name (AI may suggest one if empty)
   * @returns {Promise<{structured: Object}>}
   *   - structured.context_md: Formatted markdown context
   *   - structured.description: Brief project description
   *   - structured.suggested_name: Suggested project name (if not provided)
   *   - structured.sections: Array of {title, content} for preview
   */
  async structureProjectContext(freeText, projectName = '') {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/projects/structure-context`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        free_text: freeText,
        project_name: projectName,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to structure context' }));
      throw new Error(error.detail || 'Failed to structure context');
    }
    return response.json();
  },

  /**
   * Use AI to merge a council decision into existing project context.
   * @param {string} projectId - Project to update
   * @param {string} existingContext - Current project context markdown
   * @param {string} decisionContent - The council decision to merge
   * @param {string} userQuestion - Original question that led to the decision
   * @returns {Promise<{merged: Object}>}
   *   - merged.context_md: Updated context with decision integrated
   *   - merged.summary: Brief summary of what was learned
   *   - merged.changes: Description of changes made
   */
  async mergeDecisionIntoProject(projectId, existingContext, decisionContent, userQuestion = '', options = {}) {
    const headers = await getAuthHeaders();
    // Ensure required fields are never undefined (would cause Pydantic validation error)
    const body = {
      existing_context: existingContext || '',
      decision_content: decisionContent || '',
      user_question: userQuestion || '',
    };
    console.log('[API] mergeDecisionIntoProject called:', {
      projectId,
      existingContextLength: existingContext?.length ?? 'undefined',
      decisionContentLength: decisionContent?.length ?? 'undefined',
      userQuestion: userQuestion?.substring(0, 50) ?? 'undefined',
      options: Object.keys(options)
    });

    // Optional: save decision to knowledge_entries for audit trail
    if (options.saveDecision) {
      body.save_decision = true;
      body.company_id = options.companyId || null;
      body.conversation_id = options.conversationId || null;
      body.response_index = typeof options.responseIndex === 'number' ? options.responseIndex : null;
      body.decision_title = options.decisionTitle || null;
      body.department_id = options.departmentId || null;  // Primary department (backwards compat)
      body.department_ids = Array.isArray(options.departmentIds) && options.departmentIds.length > 0
        ? options.departmentIds
        : null;  // All selected departments
      console.log('[API] mergeDecisionIntoProject body:', JSON.stringify(body, null, 2));
    }

    // Use AbortController for timeout (60s for AI processing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      console.log('[API] Starting merge-decision request...');
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/merge-decision`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log('[API] merge-decision response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to merge decision' }));
        console.error('[API] merge-decision error:', JSON.stringify(error, null, 2));
        console.error('[API] merge-decision status:', response.status);
        // Pydantic validation errors come as array of objects with loc, msg, type
        const errorMsg = Array.isArray(error.detail)
          ? error.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('; ')
          : (error.detail || 'Failed to merge decision');
        throw new Error(errorMsg);
      }
      const result = await response.json();
      console.log('[API] merge-decision success, saved_decision_id:', result.saved_decision_id);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('[API] merge-decision request timed out after 60s');
        throw new Error('Request timed out. The AI merge is taking too long. Please try again.');
      }
      throw err;
    }
  },

  // ============================================
  // MY COMPANY API METHODS
  // ============================================

  /**
   * Get company overview with stats.
   * @param {string} companyId - Company ID (slug or UUID)
   * @returns {Promise<Object>} Company overview with stats
   */
  async getCompanyOverview(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/overview`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get company overview');
    }
    return response.json();
  },

  /**
   * Update company info.
   * @param {string} companyId - Company ID
   * @param {Object} data - Company data to update
   * @returns {Promise<Object>} Updated company
   */
  async updateCompanyOverview(companyId, data) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/overview`, {
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

  /**
   * Update company context markdown.
   * @param {string} companyId - Company ID
   * @param {Object} data - {context_md: string}
   * @returns {Promise<Object>} Updated company
   */
  async updateCompanyContext(companyId, data) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/context`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update company context' }));
      throw new Error(error.detail || 'Failed to update company context');
    }
    return response.json();
  },

  /**
   * Get team structure (departments and roles).
   * @param {string} companyId - Company ID
   * @returns {Promise<{departments: Array}>}
   */
  async getCompanyTeam(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/team`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get team structure');
    }
    return response.json();
  },

  /**
   * Create a new department.
   * @param {string} companyId - Company ID
   * @param {Object} dept - Department data {name, slug, description, purpose}
   * @returns {Promise<Object>} Created department
   */
  async createCompanyDepartment(companyId, dept) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/departments`, {
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

  /**
   * Update a department.
   * @param {string} companyId - Company ID
   * @param {string} deptId - Department ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated department
   */
  async updateCompanyDepartment(companyId, deptId, data) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/departments/${deptId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update department' }));
      throw new Error(error.detail || 'Failed to update department');
    }
    return response.json();
  },

  /**
   * Create a new role in a department.
   * @param {string} companyId - Company ID
   * @param {string} deptId - Department ID
   * @param {Object} role - Role data {name, slug, title, responsibilities, system_prompt}
   * @returns {Promise<Object>} Created role
   */
  async createCompanyRole(companyId, deptId, role) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/departments/${deptId}/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(role),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create role' }));
      throw new Error(error.detail || 'Failed to create role');
    }
    return response.json();
  },

  /**
   * Update a role.
   * @param {string} companyId - Company ID
   * @param {string} deptId - Department ID
   * @param {string} roleId - Role ID
   * @param {Object} updates - Role updates {name, title, responsibilities, system_prompt}
   * @returns {Promise<Object>} Updated role
   */
  async updateCompanyRole(companyId, deptId, roleId, updates) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/departments/${deptId}/roles/${roleId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update role' }));
      throw new Error(error.detail || 'Failed to update role');
    }
    return response.json();
  },

  /**
   * Get playbooks (SOPs, frameworks, policies).
   * @param {string} companyId - Company ID
   * @param {string} docType - Optional filter: 'sop', 'framework', 'policy'
   * @returns {Promise<{playbooks: Array}>}
   */
  async getCompanyPlaybooks(companyId, docType = null) {
    const headers = await getAuthHeaders();
    const params = docType ? `?doc_type=${docType}` : '';
    const response = await fetch(`${API_BASE}/api/company/${companyId}/playbooks${params}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get playbooks');
    }
    return response.json();
  },

  /**
   * Get all unique tags used across playbooks for a company.
   * @param {string} companyId - Company ID
   * @returns {Promise<{tags: Array<string>}>}
   */
  async getCompanyPlaybookTags(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/playbooks/tags`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get playbook tags');
    }
    return response.json();
  },

  /**
   * Get a single playbook by ID.
   * @param {string} companyId - Company ID
   * @param {string} playbookId - Playbook ID
   * @returns {Promise<Object>} Playbook with content
   */
  async getPlaybook(companyId, playbookId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/playbooks/${playbookId}`, { headers });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to get playbook');
    }
    return response.json();
  },

  /**
   * Create a new playbook.
   * @param {string} companyId - Company ID
   * @param {Object} playbook - Playbook data {title, doc_type, content, department_id}
   * @returns {Promise<Object>} Created playbook with version
   */
  async createCompanyPlaybook(companyId, playbook) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/playbooks`, {
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

  /**
   * Update a playbook (creates new version).
   * @param {string} companyId - Company ID
   * @param {string} playbookId - Playbook ID
   * @param {Object} data - {content, change_summary}
   * @returns {Promise<Object>} Updated playbook with new version
   */
  async updateCompanyPlaybook(companyId, playbookId, data) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/playbooks/${playbookId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update playbook' }));
      throw new Error(error.detail || 'Failed to update playbook');
    }
    return response.json();
  },

  // Alias for updateCompanyPlaybook for consistency with MyCompany.jsx naming
  async updatePlaybook(companyId, playbookId, data) {
    return this.updateCompanyPlaybook(companyId, playbookId, data);
  },

  /**
   * Delete a playbook.
   * @param {string} companyId - Company ID
   * @param {string} playbookId - Playbook ID
   * @returns {Promise<void>}
   */
  async deletePlaybook(companyId, playbookId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/playbooks/${playbookId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete playbook' }));
      throw new Error(error.detail || 'Failed to delete playbook');
    }
    return response.json();
  },

  /**
   * Get decisions (saved council outputs).
   * @param {string} companyId - Company ID
   * @returns {Promise<{decisions: Array}>}
   */
  async getCompanyDecisions(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get decisions');
    }
    return response.json();
  },

  /**
   * Get a single decision by ID.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<Object|null>} Decision or null if not found
   */
  async getDecision(companyId, decisionId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}`, { headers });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to get decision');
    }
    const data = await response.json();
    return data.decision;  // Unwrap from {decision: ...} wrapper
  },

  /**
   * Save a decision from council output.
   * @param {string} companyId - Company ID
   * @param {Object} decision - Decision data {title, content, department_id, project_id, source_conversation_id, tags}
   * @param {string} decision.project_id - Optional project ID to link this decision to a project timeline
   * @returns {Promise<Object>} Created decision
   */
  async createCompanyDecision(companyId, decision) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions`, {
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

  /**
   * Get all decisions linked to a project (timeline view).
   * @param {string} companyId - Company ID
   * @param {string} projectId - Project ID
   * @returns {Promise<{project: Object, decisions: Array, total_count: number}>}
   */
  async getProjectDecisions(companyId, projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}/api/company/${companyId}/projects/${projectId}/decisions`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get project decisions');
    }
    return response.json();
  },

  /**
   * Promote a decision to a playbook.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @param {Object} data - {doc_type, title, department_id, department_ids}
   * @returns {Promise<Object>} Created playbook
   */
  async promoteDecisionToPlaybook(companyId, decisionId, data) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}/promote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to promote decision' }));
      throw new Error(error.detail || 'Failed to promote decision');
    }
    return response.json();
  },

  /**
   * Link a decision to an existing project.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @param {string} projectId - Project ID to link to
   * @returns {Promise<Object>} Updated decision
   */
  async linkDecisionToProject(companyId, decisionId, projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}/link-project`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ project_id: projectId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to link decision to project' }));
      throw new Error(error.detail || 'Failed to link decision to project');
    }
    return response.json();
  },

  /**
   * Create a new project from a decision.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @param {Object} data - {name, department_ids}
   * @returns {Promise<Object>} Created project
   */
  async createProjectFromDecision(companyId, decisionId, data) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}/create-project`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create project from decision' }));
      throw new Error(error.detail || 'Failed to create project from decision');
    }
    return response.json();
  },

  /**
   * Archive a decision (soft delete).
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<Object>} Success response
   */
  async archiveDecision(companyId, decisionId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}/archive`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to archive decision' }));
      throw new Error(error.detail || 'Failed to archive decision');
    }
    return response.json();
  },

  /**
   * Sync project's department_ids from all its decisions.
   * Recalculates departments based on all active decisions in the project.
   * @param {string} companyId - Company ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Updated department_ids
   */
  async syncProjectDepartments(companyId, projectId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/projects/${projectId}/sync-departments`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to sync departments' }));
      throw new Error(error.detail || 'Failed to sync departments');
    }
    return response.json();
  },

  /**
   * Delete a decision permanently.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<Object>} Success response
   */
  async deleteDecision(companyId, decisionId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete decision' }));
      throw new Error(error.detail || 'Failed to delete decision');
    }
    return response.json();
  },

  /**
   * Generate a summary for a decision's user_question.
   * Called on-demand when expanding a decision in the UI.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<{summary: string, cached: boolean}>}
   */
  async generateDecisionSummary(companyId, decisionId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/decisions/${decisionId}/generate-summary`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to generate summary' }));
      throw new Error(error.detail || 'Failed to generate summary');
    }
    return response.json();
  },

  /**
   * Get activity logs for a company.
   * @param {string} companyId - Company ID
   * @param {number} limit - Max number of logs to return
   * @param {string} eventType - Optional filter by event type
   * @returns {Promise<{logs: Array}>}
   */
  async getCompanyActivity(companyId, options = {}) {
    const { limit = 50, eventType = null, days = null } = options;
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (eventType) params.append('event_type', eventType);
    if (days) params.append('days', days);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE}/api/company/${companyId}/activity${queryString}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get activity logs');
    }
    return response.json();
  },

  /**
   * AI Writing Assistant - Get AI help with form content.
   * Sends user's draft text along with context-specific prompt to LLM.
   * @param {Object} params
   * @param {string} params.prompt - Full prompt including instructions and user text
   * @param {string} params.context - Context type (e.g., 'project-title', 'decision-statement')
   * @param {string} [params.playbookType] - For playbook content: 'sop', 'framework', or 'policy'
   * @returns {Promise<{suggestion: string}>} AI-generated suggestion
   */
  async aiWriteAssist({ prompt, context, playbookType }) {
    const headers = await getAuthHeaders();
    const body = { prompt, context };
    if (playbookType) {
      body.playbook_type = playbookType;
    }
    const response = await fetch(`${API_BASE}/api/ai/write-assist`, {
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

  /**
   * Merge new context into existing company context using AI.
   * Takes the user's answer to a knowledge gap question and intelligently
   * merges it into the existing company context.
   *
   * @param {Object} params
   * @param {string} params.companyId - Company ID
   * @param {string} params.existingContext - Current company context markdown
   * @param {string} params.question - The knowledge gap question that was asked
   * @param {string} params.answer - The user's answer to the question
   * @returns {Promise<{merged_context: string}>} The merged context
   */
  async mergeCompanyContext({ companyId, existingContext, question, answer }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/context/merge`, {
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

  /**
   * Get all members of a company.
   * @param {string} companyId - Company ID
   * @returns {Promise<{members: Array}>} List of company members with roles
   */
  async getCompanyMembers(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/members`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get company members');
    }
    return response.json();
  },

  /**
   * Add a new member to the company.
   * @param {string} companyId - Company ID
   * @param {string} email - Email of the user to add
   * @param {string} role - Role to assign ('admin' or 'member')
   * @returns {Promise<{member: Object, message: string}>}
   */
  async addCompanyMember(companyId, email, role = 'member') {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/members`, {
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

  /**
   * Update a member's role.
   * @param {string} companyId - Company ID
   * @param {string} memberId - Member ID
   * @param {string} role - New role ('admin' or 'member')
   * @returns {Promise<{member: Object, message: string}>}
   */
  async updateCompanyMember(companyId, memberId, role) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/members/${memberId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update member' }));
      throw new Error(error.detail || 'Failed to update member');
    }
    return response.json();
  },

  /**
   * Remove a member from the company.
   * @param {string} companyId - Company ID
   * @param {string} memberId - Member ID
   * @returns {Promise<{message: string}>}
   */
  async removeCompanyMember(companyId, memberId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/members/${memberId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
      throw new Error(error.detail || 'Failed to remove member');
    }
    return response.json();
  },

  // ===== USAGE TRACKING =====

  /**
   * Get usage statistics for the company.
   * Only owners and admins can view this.
   * @param {string} companyId - Company ID
   * @returns {Promise<{usage: Object}>} Usage statistics
   */
  async getCompanyUsage(companyId) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/company/${companyId}/usage`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get company usage');
    }
    return response.json();
  },

  // ===== BYOK (Bring Your Own Key) =====

  /**
   * Get the status of the user's OpenRouter API key.
   * @returns {Promise<{status: string, masked_key?: string, is_valid: boolean}>}
   */
  async getOpenRouterKeyStatus() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/openrouter-key`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get API key status');
    }
    return response.json();
  },

  /**
   * Save the user's OpenRouter API key.
   * Key is validated before saving.
   * @param {string} key - The OpenRouter API key
   * @returns {Promise<{status: string, masked_key: string, is_valid: boolean}>}
   */
  async saveOpenRouterKey(key) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/openrouter-key`, {
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

  /**
   * Delete the user's OpenRouter API key.
   * @returns {Promise<{status: string}>}
   */
  async deleteOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/openrouter-key`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete API key');
    }
    return response.json();
  },

  /**
   * Test the user's stored OpenRouter API key.
   * @returns {Promise<{status: string, masked_key: string, is_valid: boolean, is_active: boolean}>}
   */
  async testOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/openrouter-key/test`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to test API key' }));
      throw new Error(error.detail || 'Failed to test API key');
    }
    return response.json();
  },

  /**
   * Toggle the is_active status of the user's OpenRouter API key.
   * @returns {Promise<{status: string, masked_key: string, is_valid: boolean, is_active: boolean}>}
   */
  async toggleOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings/openrouter-key/toggle`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to toggle API key' }));
      throw new Error(error.detail || 'Failed to toggle API key');
    }
    return response.json();
  },

  /**
   * Get all user settings including BYOK status.
   * @returns {Promise<{default_mode: string, has_api_key: boolean, api_key_status?: Object}>}
   */
  async getUserSettings() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get user settings');
    }
    return response.json();
  },

  /**
   * Update user settings.
   * @param {object} updates - Fields to update
   * @param {string} [updates.default_mode] - 'quick' or 'full_council'
   * @returns {Promise<Object>} Updated settings
   */
  async updateUserSettings(updates) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/settings`, {
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
