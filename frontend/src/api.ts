/**
 * API client for the AI Council backend.
 */

import { logger } from './utils/logger';

const log = logger.scope('API');
// In development, use relative URLs so Vite's proxy handles CORS
// In production, use the full URL from environment
const API_BASE = import.meta.env.PROD
  ? import.meta.env.VITE_API_URL || 'http://localhost:8000'
  : '';

// API version prefix - all endpoints use v1
const API_VERSION = '/api/v1';

// =============================================================================
// Error Response Types (matching backend schema)
// =============================================================================

interface APIErrorDetail {
  code: string;
  message: string;
  reference?: string;
  field?: string;
  details?: Record<string, unknown>;
}

interface APIErrorResponse {
  error: APIErrorDetail;
  meta?: {
    api_version: string;
    timestamp: string;
  };
}

/**
 * Custom API error class with structured error information.
 */
export class APIError extends Error {
  code: string;
  reference: string | undefined;
  field: string | undefined;
  details: Record<string, unknown> | undefined;
  statusCode: number;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    options?: {
      reference?: string | undefined;
      field?: string | undefined;
      details?: Record<string, unknown> | undefined;
    }
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.reference = options?.reference;
    this.field = options?.field;
    this.details = options?.details;
  }
}

/**
 * Parse an error response and throw an appropriate error.
 * Handles both new standardized format and legacy format.
 */
async function handleErrorResponse(response: Response, fallbackMessage: string): Promise<never> {
  let errorData: unknown;
  try {
    errorData = await response.json();
  } catch {
    throw new APIError(fallbackMessage, 'UNKNOWN_ERROR', response.status);
  }

  // New standardized format: { error: { code, message, ... }, meta: { ... } }
  if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
    const apiError = errorData as APIErrorResponse;
    throw new APIError(apiError.error.message, apiError.error.code, response.status, {
      reference: apiError.error.reference,
      field: apiError.error.field,
      details: apiError.error.details,
    });
  }

  // Legacy format: { detail: string | object }
  if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
    const legacy = errorData as { detail: string | unknown };
    const message = typeof legacy.detail === 'string' ? legacy.detail : fallbackMessage;
    throw new APIError(message, 'LEGACY_ERROR', response.status);
  }

  // Unknown format
  throw new APIError(fallbackMessage, 'UNKNOWN_ERROR', response.status);
}

// =============================================================================
// Type Definitions
// =============================================================================

type TokenGetter = (() => Promise<string | null>) | null;

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  includeArchived?: boolean;
  sortBy?: 'date' | 'activity';
  companyId?: string | null;
}

export interface SendMessageStreamOptions {
  businessId?: string | null;
  department?: string | null;
  role?: string | null;
  departments?: string[] | null;
  roles?: string[] | null;
  playbooks?: string[] | null;
  projectId?: string | null;
  attachmentIds?: string[] | null;
  signal?: AbortSignal | null;
  /** LLM preset override (conservative/balanced/creative). If null, uses department default. */
  preset?: 'conservative' | 'balanced' | 'creative' | null;
}

export interface ChatStreamOptions {
  businessId?: string | null;
  departmentId?: string | null;
  departmentIds?: string[] | null;
  roleIds?: string[] | null;
  playbookIds?: string[] | null;
  projectId?: string | null;
  signal?: AbortSignal | null;
}

export interface ListDecisionsOptions {
  departmentId?: string | null;
  projectId?: string | null;
  category?: string | null;
  status?: string | null;
  search?: string | null;
  limit?: number | null;
}

export interface ListActivityOptions {
  limit?: number;
  eventType?: string | null;
  days?: number | null;
}

export interface ContextWriteAssistOptions {
  playbookType?: string | null;
}

export interface SaveDecisionOptions {
  saveDecision?: boolean | undefined;
  companyId?: string | undefined;
  conversationId?: string | undefined;
  responseIndex?: number | undefined;
  decisionTitle?: string | undefined;
  departmentId?: string | null | undefined;
  departmentIds?: string[] | null | undefined;
}

export type SSEEventCallback = (eventType: string, data: Record<string, unknown>) => void;

// =============================================================================
// Onboarding Types
// =============================================================================

export interface OnboardingProfileResponse {
  success: boolean;
  profile?: {
    full_name: string;
    role: string;
    company: string;
    industry: string;
    employees: number;
    bio: string;
    magic_question: string;
    departments: Array<{
      id: string;
      name: string;
      purpose: string;
      icon: string;
    }>;
  };
  fallback_required: boolean;
  error?: string;
}

export interface TrialStatusResponse {
  has_trial_available: boolean;
  has_api_key: boolean;
  trial_count: number;
  trial_limit: number;
}

// =============================================================================
// Token Management
// =============================================================================

// Token getter function - set by the app to provide auth tokens
let getAccessToken: TokenGetter = null;

/**
 * Set the function that retrieves the access token.
 */
export const setTokenGetter = (getter: TokenGetter): void => {
  getAccessToken = getter;
};

/**
 * Get headers including Authorization if token is available.
 */
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      log.warn('getAccessToken returned null - no auth token available');
    }
  } else {
    log.warn('getAccessToken not set - API calls will be unauthenticated');
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
    const response = await fetch(`${API_BASE}${API_VERSION}/businesses`, { headers });
    if (!response.ok) {
      await handleErrorResponse(response, 'Failed to list businesses');
    }
    const data = await response.json();
    // Backend returns { companies: [...], has_more: bool }, but callers expect an array
    return data.companies || [];
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

  /**
   * Star or unstar a conversation.
   * Starred conversations appear at the top of the list.
   *
   * @param {string} conversationId - ID of the conversation
   * @param {boolean} starred - True to star, false to unstar
   */
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

  /**
   * Create a new conversation.
   * @param {string} companyId - The company ID to associate with this conversation
   */
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

  /**
   * Get a specific conversation.
   */
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

  /**
   * Send a message in a conversation.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {string|null} businessId - Optional business context ID
   */
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
          departments, // Multi-select support
          roles, // Multi-select support
          playbooks, // Playbook IDs to inject
          project_id: projectId,
          attachment_ids: attachmentIds,
          preset_override: preset, // LLM preset override (null = use department default)
        }),
        signal, // Allow cancellation
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
          department_ids: departmentIds, // Multi-select support
          role_ids: roleIds, // Multi-select support
          playbook_ids: playbookIds, // Playbook IDs to inject
          project_id: projectId,
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

  /**
   * Get leaderboard summary (overall + all departments).
   */
  async getLeaderboardSummary() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/leaderboard`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get leaderboard');
    }
    return response.json();
  },

  /**
   * Get overall leaderboard.
   */
  async getOverallLeaderboard() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/leaderboard/overall`, { headers });
    if (!response.ok) {
      throw new Error('Failed to get overall leaderboard');
    }
    return response.json();
  },

  /**
   * Get department-specific leaderboard.
   * @param {string} department - The department name
   */
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

  /**
   * Analyze a question for triage (check for 4 constraints).
   * @param {string} content - The user's question
   * @param {string|null} businessId - Optional business context ID
   * @returns {Promise<{ready: boolean, constraints: object, missing: string[], questions: string|null, enhanced_query: string}>}
   */
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

  /**
   * Continue triage conversation with additional user info.
   * @param {string} originalQuery - The original question
   * @param {object} previousConstraints - Previously extracted constraints
   * @param {string} userResponse - User's response to triage questions
   * @param {string|null} businessId - Optional business context ID
   * @returns {Promise<{ready: boolean, constraints: object, missing: string[], questions: string|null, enhanced_query: string}>}
   */
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

  /**
   * Export a conversation as Markdown file.
   * @param {string} conversationId - The conversation ID
   * @returns {Promise<void>} - Triggers a file download
   */
  async exportConversation(conversationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/conversations/${conversationId}/export`,
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
      if (match?.[1]) {
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

  /**
   * Archive or unarchive a conversation.
   * @param {string} conversationId - The conversation ID
   * @param {boolean} archived - True to archive, false to unarchive
   */
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

  /**
   * Update the department of a conversation.
   * Used for drag-and-drop to move conversations between departments.
   * @param {string} conversationId - The conversation ID
   * @param {string} department - The target department ID/slug
   * @returns {Promise<{success: boolean, department: string}>}
   */
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

  /**
   * Permanently delete a conversation.
   * @param {string} conversationId - The conversation ID
   */
  async deleteConversation(conversationId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  /**
   * Bulk delete multiple conversations.
   * @param {string[]} conversationIds - Array of conversation IDs to delete
   * @returns {Promise<{deleted: string[], failed: Array, deleted_count: number}>}
   */
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

  /**
   * Analyze a conversation for potential knowledge base updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} businessId - The business context ID
   * @param {string|null} departmentId - Optional department ID
   * @returns {Promise<{suggestions: Array, summary: string, analyzed_at: string}>}
   */
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

  /**
   * Apply a suggestion to update the business context.
   * Requires authentication.
   * @param {string} businessId - The business context ID
   * @param {object} suggestion - The suggestion object to apply
   * @returns {Promise<{success: boolean, message: string, updated_at: string}>}
   */
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

  /**
   * Get a specific section from the business context.
   * Requires authentication.
   * @param {string} businessId - The business context ID
   * @param {string} sectionName - The section name to retrieve
   * @param {string|null} department - Optional department ID to look in department context
   * @returns {Promise<{section: string, content: string, exists: boolean}>}
   */
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

  /**
   * Save a record that the curator was run on this conversation.
   * @param {string} conversationId - The conversation ID
   * @param {string} businessId - The business context ID
   * @param {number} suggestionsCount - Total suggestions generated
   * @param {number} acceptedCount - Number of suggestions accepted
   * @param {number} rejectedCount - Number of suggestions rejected
   * @returns {Promise<{success: boolean}>}
   */
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

  /**
   * Get curator run history for a conversation.
   * @param {string} conversationId - The conversation ID
   * @returns {Promise<{history: Array}>}
   */
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

  /**
   * Get current mock mode status.
   * @returns {Promise<{enabled: boolean, scenario: string}>}
   */
  async getMockMode() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/mock-mode`, { headers });
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

  /**
   * Get current prompt caching status.
   * @returns {Promise<{enabled: boolean, supported_models: string[]}>}
   */
  async getCachingMode() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/caching-mode`, { headers });
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

  /**
   * Get current mock length override status.
   * @returns {Promise<{length_override: number|null, valid_values: number[]}>}
   */
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

  /**
   * Set mock response length override.
   * @param {number|null} lengthOverride - Override value or null for LLM Hub settings
   * @returns {Promise<{success: boolean, length_override: number|null, message: string}>}
   */
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

  /**
   * Get the last updated date from a business context file.
   * Requires authentication.
   * @param {string} businessId - The business context ID
   * @returns {Promise<{last_updated: string|null}>}
   */
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

  /**
   * Create a new department for a company.
   * @deprecated Use createCompanyDepartment instead
   * @param {string} companyId - The company ID
   * @param {object} department - The department to create
   * @param {string} department.id - The department ID (used as slug)
   * @param {string} department.name - The display name for the department
   * @returns {Promise<Object>} Created department
   */
  async createDepartment(
    companyId: string,
    department: { id?: string; name: string; description?: string }
  ) {
    // Delegate to new unified endpoint
    const payload: { name: string; slug: string; description?: string } = {
      name: department.name,
      slug: department.id || department.name.toLowerCase().replace(/\s+/g, '-'),
    };
    if (department.description) {
      payload.description = department.description;
    }
    return this.createCompanyDepartment(companyId, payload);
  },

  /**
   * Update a department's name and/or description.
   * @deprecated Use updateCompanyDepartment instead
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department ID to update
   * @param {object} updates - Fields to update
   * @returns {Promise<Object>} Updated department
   */
  async updateDepartment(
    companyId: string,
    departmentId: string,
    updates: { name?: string; slug?: string; description?: string; purpose?: string }
  ) {
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
  async addRole(
    companyId: string,
    departmentId: string,
    role: { role_id?: string; role_name: string; role_description?: string }
  ) {
    // Delegate to new unified endpoint
    const payload: { name: string; slug: string; title: string; responsibilities?: string } = {
      name: role.role_name,
      slug: role.role_id || role.role_name.toLowerCase().replace(/\s+/g, '-'),
      title: role.role_name,
    };
    if (role.role_description) {
      payload.responsibilities = role.role_description;
    }
    return this.createCompanyRole(companyId, departmentId, payload);
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
  async updateRole(
    companyId: string,
    departmentId: string,
    roleId: string,
    updates: { name?: string; description?: string }
  ) {
    // Delegate to new unified endpoint
    const payload: { name?: string; responsibilities?: string } = {};
    if (updates.name) {
      payload.name = updates.name;
    }
    if (updates.description) {
      payload.responsibilities = updates.description;
    }
    return this.updateCompanyRole(companyId, departmentId, roleId, payload);
  },

  /**
   * Get the system prompt/context for a specific role.
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department ID
   * @param {string} roleId - The role ID
   * @returns {Promise<{role: Object}>} Role with system_prompt
   */
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
    // Transform to match old API shape for backwards compatibility
    return {
      context: data.role?.system_prompt || null,
      exists: !!data.role?.system_prompt,
      path: `Database: roles/${roleId}`,
    };
  },

  /**
   * Delete a department and all its roles.
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department ID to delete
   * @returns {Promise<{success: boolean, deleted_department: string, deleted_roles: number}>}
   */
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

  /**
   * Delete a role.
   * @param {string} companyId - The company ID
   * @param {string} departmentId - The department ID
   * @param {string} roleId - The role ID to delete
   * @returns {Promise<{success: boolean, deleted_role: string}>}
   */
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

  // ============ Projects API ============

  /**
   * List all projects for a company.
   * @param {string} companyId - The company ID
   * @returns {Promise<{projects: Array}>}
   */
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

  /**
   * Create a new project for a company.
   * @param {string} companyId - The company ID
   * @param {object} project - The project data
   * @param {string} project.name - Project name
   * @param {string} project.description - Optional description
   * @param {string} project.context_md - Optional markdown context
   * @param {string[]} project.department_ids - Optional department IDs
   * @param {string} project.source - Optional source ('ai' or 'manual')
   * @returns {Promise<{project: object}>}
   */
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
      // Try to get the actual error message from the server
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

  /**
   * Get a specific project.
   * @param {string} projectId - The project ID
   * @returns {Promise<{project: object}>}
   */
  async getProject(projectId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/projects/${projectId}`, { headers });
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

  /**
   * Touch a project's last_accessed_at timestamp (when selected in chat).
   * @param {string} projectId - The project ID
   * @returns {Promise<{success: boolean}>}
   */
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

  /**
   * Regenerate project context by synthesizing ALL decisions from scratch.
   * Useful when context has accumulated duplicates or garbage.
   * @param {string} projectId - The project ID
   * @returns {Promise<{success: boolean, context_md: string, message: string, decision_count: number}>}
   */
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

  /**
   * Delete a project permanently.
   * @param {string} projectId - The project ID
   * @returns {Promise<{success: boolean}>}
   */
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
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  /**
   * List projects with stats for Command Centre.
   * @param {string} companyId - The company ID
   * @param {object} options - Optional filters
   * @param {string} options.status - Filter by status ('active', 'completed', 'archived')
   * @param {boolean} options.includeArchived - Include archived projects
   * @returns {Promise<{projects: Array}>}
   */
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

  // ============ Utils API ============

  /**
   * Polish/rewrite text using AI.
   * @param {string} text - The text to polish
   * @param {string} fieldType - The field type for context (client_background, goals, constraints, additional)
   * @returns {Promise<{polished: string}>}
   */
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
    const response = await fetch(`${API_BASE}${API_VERSION}/profile`, {
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
  async updateProfile(profile: {
    display_name?: string;
    company?: string;
    phone?: string;
    bio?: string;
    role?: string;
    linkedin_url?: string;
  }) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/profile`, {
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
    const response = await fetch(`${API_BASE}${API_VERSION}/billing/plans`);
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
    const response = await fetch(`${API_BASE}${API_VERSION}/billing/subscription`, {
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
    const response = await fetch(`${API_BASE}${API_VERSION}/billing/can-query`, {
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
  async createCheckout(tierId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/billing/checkout`, {
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
    const response = await fetch(`${API_BASE}${API_VERSION}/billing/portal`, {
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
  async uploadAttachment(
    file: File,
    conversationId: string | null = null,
    messageIndex: number | null = null
  ) {
    const token = getAccessToken ? await getAccessToken() : null;

    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    if (messageIndex !== null) {
      formData.append('message_index', messageIndex.toString());
    }

    const response = await fetch(`${API_BASE}${API_VERSION}/attachments/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  async getAttachment(attachmentId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/attachments/${attachmentId}`, {
      headers,
    });
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
  async getAttachmentUrl(attachmentId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/attachments/${attachmentId}/url`, {
      headers,
    });
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
  async deleteAttachment(attachmentId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete attachment');
    }
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
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

  /**
   * Deactivate a knowledge entry (soft delete).
   * @param {string} entryId - Knowledge entry UUID
   * @returns {Promise<{success: boolean}>}
   */
  async deactivateKnowledgeEntry(entryId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/knowledge/${entryId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to deactivate knowledge entry');
    }
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
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

  /**
   * Get count of knowledge entries saved from a specific conversation.
   * @param {string} conversationId - Conversation UUID
   * @param {string} companyId - Company UUID
   * @returns {Promise<{count: number}>}
   */
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

  /**
   * Get any project linked to a conversation via saved decisions.
   * @param {string} conversationId - Conversation UUID
   * @param {string} companyId - Company UUID
   * @returns {Promise<{project: {id: string, name: string, description: string, status: string} | null}>}
   */
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

  /**
   * Check if a specific decision exists for this conversation and response index.
   * @param {string} conversationId - The conversation ID
   * @param {string} companyId - The company ID
   * @param {number} responseIndex - The index of the response within the conversation
   * @returns {Promise<{decision: Object|null}>}
   */
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

  /**
   * Extract a clear project name and description from a council response using AI.
   * Designed to be understandable by anyone - like onboarding documentation.
   * @param {string} userQuestion - The original user question
   * @param {string} councilResponse - The Stage 3 chairman synthesis
   * @param {string} companyId - Optional company ID for usage tracking
   * @returns {Promise<{success: boolean, extracted: {name: string, description: string}, error: string}>}
   */
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

  /**
   * Use AI to structure free-form project description into organized context.
   * @param {string} freeText - User's free-form project description
   * @param {string} projectName - Optional project name (AI may suggest one if empty)
   * @param {string} companyId - Optional company ID for usage tracking
   * @returns {Promise<{structured: Object}>}
   *   - structured.context_md: Formatted markdown context
   *   - structured.description: Brief project description
   *   - structured.suggested_name: Suggested project name (if not provided)
   *   - structured.sections: Array of {title, content} for preview
   */
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

  /**
   * Use AI to structure a natural language department description.
   * @param {string} description - User's description of the department
   * @param {string} companyId - Optional company ID for usage tracking
   * @returns {Promise<{structured: Object}>}
   *   - structured.name: Suggested department name (2-4 words)
   *   - structured.description: Clear description of what the department does
   *   - structured.suggested_roles: Array of typical roles for this department
   */
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

  /**
   * Use AI to structure a role from a natural language description.
   * Two-phase process: role_designer generates metadata, persona_architect generates system_prompt.
   * @param {string} description - Natural language description of the role
   * @param {string} [departmentId] - Optional department ID for context
   * @param {string} [companyId] - Optional company ID for usage tracking
   * @returns {Promise<{structured: Object}>}
   *   - structured.name: Concise role name
   *   - structured.title: Full job title
   *   - structured.description: What this role does
   *   - structured.responsibilities: Array of key responsibilities
   *   - structured.system_prompt: AI advisor system prompt defining personality and expertise
   */
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

  /**
   * Use AI to structure a playbook from a natural language description.
   * @param {string} description - Natural language description of the playbook
   * @param {string} [companyId] - Optional company ID for usage tracking
   * @returns {Promise<{structured: Object}>}
   *   - structured.title: Clear playbook title
   *   - structured.doc_type: "sop" | "framework" | "policy"
   *   - structured.content: Initial markdown content with sections
   */
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
        doc_type: docType || undefined, // Only send if user preselected
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to structure playbook' }));
      throw new Error(error.detail || 'Failed to structure playbook');
    }
    return response.json();
  },

  /**
   * Use AI to generate a comprehensive company context document from a natural language description.
   * @param {string} companyId - Company ID
   * @param {string} description - Natural language description of the company
   * @param {string} [companyName] - Optional company name for the document header
   * @returns {Promise<{structured: Object}>}
   *   - structured.context_md: Complete company context document in markdown
   */
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
  async mergeDecisionIntoProject(
    projectId: string,
    existingContext: string,
    decisionContent: string,
    userQuestion: string = '',
    options: SaveDecisionOptions = {}
  ) {
    const headers = await getAuthHeaders();
    // Ensure required fields are never undefined (would cause Pydantic validation error)
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

    // Optional: save decision to knowledge_entries for audit trail
    if (options.saveDecision) {
      body.save_decision = true;
      body.company_id = options.companyId || null;
      body.conversation_id = options.conversationId || null;
      body.response_index =
        typeof options.responseIndex === 'number' ? options.responseIndex : null;
      body.decision_title = options.decisionTitle || null;
      body.department_id = options.departmentId || null; // Primary department (backwards compat)
      body.department_ids =
        Array.isArray(options.departmentIds) && options.departmentIds.length > 0
          ? options.departmentIds
          : null; // All selected departments
      log.debug('mergeDecisionIntoProject body', { body });
    }

    // Use AbortController for timeout (60s for AI processing)
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
        // Pydantic validation errors come as array of objects with loc, msg, type
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

  // ============================================
  // MY COMPANY API METHODS
  // ============================================

  /**
   * Get company overview with stats.
   * @param {string} companyId - Company ID (slug or UUID)
   * @returns {Promise<Object>} Company overview with stats
   */
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

  /**
   * Update company info.
   * @param {string} companyId - Company ID
   * @param {Object} data - Company data to update
   * @returns {Promise<Object>} Updated company
   */
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

  /**
   * Update company context markdown.
   * @param {string} companyId - Company ID
   * @param {Object} data - {context_md: string}
   * @returns {Promise<Object>} Updated company
   */
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

  /**
   * Get team structure (departments and roles).
   * @param {string} companyId - Company ID
   * @returns {Promise<{departments: Array}>}
   */
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

  /**
   * Create a new department.
   * @param {string} companyId - Company ID
   * @param {Object} dept - Department data {name, slug, description, purpose}
   * @returns {Promise<Object>} Created department
   */
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

  /**
   * Update a department.
   * @param {string} companyId - Company ID
   * @param {string} deptId - Department ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated department
   */
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

  /**
   * Create a new role in a department.
   * @param {string} companyId - Company ID
   * @param {string} deptId - Department ID
   * @param {Object} role - Role data {name, slug, title, responsibilities, system_prompt}
   * @returns {Promise<Object>} Created role
   */
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

  /**
   * Update a role.
   * @param {string} companyId - Company ID
   * @param {string} deptId - Department ID
   * @param {string} roleId - Role ID
   * @param {Object} updates - Role updates {name, title, responsibilities, system_prompt}
   * @returns {Promise<Object>} Updated role
   */
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

  /**
   * Get playbooks (SOPs, frameworks, policies).
   * @param {string} companyId - Company ID
   * @param {string} docType - Optional filter: 'sop', 'framework', 'policy'
   * @returns {Promise<{playbooks: Array}>}
   */
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

  /**
   * Get all unique tags used across playbooks for a company.
   * @param {string} companyId - Company ID
   * @returns {Promise<{tags: Array<string>}>}
   */
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

  /**
   * Get a single playbook by ID.
   * @param {string} companyId - Company ID
   * @param {string} playbookId - Playbook ID
   * @returns {Promise<Object>} Playbook with content
   */
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

  /**
   * Create a new playbook.
   * @param {string} companyId - Company ID
   * @param {Object} playbook - Playbook data {title, doc_type, content, department_id}
   * @returns {Promise<Object>} Created playbook with version
   */
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

  /**
   * Update a playbook (creates new version).
   * @param {string} companyId - Company ID
   * @param {string} playbookId - Playbook ID
   * @param {Object} data - {content, change_summary, title, status, additional_departments}
   * @returns {Promise<Object>} Updated playbook with new version
   */
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

  /**
   * Delete a playbook.
   * @param {string} companyId - Company ID
   * @param {string} playbookId - Playbook ID
   * @returns {Promise<void>}
   */
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
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  /**
   * Get decisions (saved council outputs).
   * @param {string} companyId - Company ID
   * @returns {Promise<{decisions: Array}>}
   */
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

  /**
   * Get a single decision by ID.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<Object|null>} Decision or null if not found
   */
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
    return data.decision; // Unwrap from {decision: ...} wrapper
  },

  /**
   * Save a decision from council output.
   * @param {string} companyId - Company ID
   * @param {Object} decision - Decision data {title, content, department_id, project_id, source_conversation_id, tags}
   * @param {string} decision.project_id - Optional project ID to link this decision to a project timeline
   * @returns {Promise<Object>} Created decision
   */
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

  /**
   * Get all decisions linked to a project (timeline view).
   * @param {string} companyId - Company ID
   * @param {string} projectId - Project ID
   * @returns {Promise<{project: Object, decisions: Array, total_count: number}>}
   */
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

  /**
   * Promote a decision to a playbook.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @param {Object} data - {doc_type, title, department_id, department_ids}
   * @returns {Promise<Object>} Created playbook
   */
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

  /**
   * Link a decision to an existing project.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @param {string} projectId - Project ID to link to
   * @returns {Promise<Object>} Updated decision
   */
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

  /**
   * Create a new project from a decision.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @param {Object} data - {name, department_ids}
   * @returns {Promise<Object>} Created project
   */
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

  /**
   * Archive a decision (soft delete).
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<Object>} Success response
   */
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

  /**
   * Sync project's department_ids from all its decisions.
   * Recalculates departments based on all active decisions in the project.
   * @param {string} companyId - Company ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Updated department_ids
   */
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

  /**
   * Delete a decision permanently.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<Object>} Success response
   */
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
    // DELETE may return empty body - only parse JSON if there's content
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  /**
   * Generate a summary for a decision's user_question.
   * Called on-demand when expanding a decision in the UI.
   * @param {string} companyId - Company ID
   * @param {string} decisionId - Decision ID
   * @returns {Promise<{summary: string, cached: boolean}>}
   */
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

  /**
   * Get activity logs for a company.
   * @param {string} companyId - Company ID
   * @param {number} limit - Max number of logs to return
   * @param {string} eventType - Optional filter by event type
   * @returns {Promise<{logs: Array}>}
   */
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

  /**
   * AI Writing Assistant - Get AI help with form content.
   * Sends user's draft text along with context-specific prompt to LLM.
   * @param {Object} params
   * @param {string} params.prompt - Full prompt including instructions and user text
   * @param {string} params.context - Context type (e.g., 'project-title', 'decision-statement')
   * @param {string} [params.playbookType] - For playbook content: 'sop', 'framework', or 'policy'
   * @returns {Promise<{suggestion: string, title?: string}>} AI-generated suggestion and optional title
   */
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

  /**
   * Get all members of a company.
   * @param {string} companyId - Company ID
   * @returns {Promise<{members: Array}>} List of company members with roles
   */
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

  /**
   * Add a new member to the company.
   * @param {string} companyId - Company ID
   * @param {string} email - Email of the user to add
   * @param {string} role - Role to assign ('admin' or 'member')
   * @returns {Promise<{member: Object, message: string}>}
   */
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

  /**
   * Update a member's role.
   * @param {string} companyId - Company ID
   * @param {string} memberId - Member ID
   * @param {string} role - New role ('admin' or 'member')
   * @returns {Promise<{member: Object, message: string}>}
   */
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

  /**
   * Remove a member from the company.
   * @param {string} companyId - Company ID
   * @param {string} memberId - Member ID
   * @returns {Promise<{message: string}>}
   */
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
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  // ===== USAGE TRACKING =====

  /**
   * Get usage statistics for the company.
   * Only owners and admins can view this.
   * @param {string} companyId - Company ID
   * @returns {Promise<{usage: Object}>} Usage statistics
   */
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

  /**
   * Get the status of the user's OpenRouter API key.
   * @returns {Promise<{status: string, masked_key?: string, is_valid: boolean}>}
   */
  async getOpenRouterKeyStatus() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key`, { headers });
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

  /**
   * Delete the user's OpenRouter API key.
   * @returns {Promise<{status: string}>}
   */
  async deleteOpenRouterKey() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings/openrouter-key`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete API key');
    }
    // DELETE may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },

  /**
   * Test the user's stored OpenRouter API key.
   * @returns {Promise<{status: string, masked_key: string, is_valid: boolean, is_active: boolean}>}
   */
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

  /**
   * Toggle the is_active status of the user's OpenRouter API key.
   * @returns {Promise<{status: string, masked_key: string, is_valid: boolean, is_active: boolean}>}
   */
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

  /**
   * Get all user settings including BYOK status.
   * @returns {Promise<{default_mode: string, has_api_key: boolean, api_key_status?: Object}>}
   */
  async getUserSettings() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/settings`, { headers });
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

  // ===== LLM OPERATIONS =====

  /**
   * Get LLM usage analytics for the dashboard.
   * Returns daily usage breakdown, model usage, and summary statistics.
   * Only accessible by company owners and admins.
   * @param {string} companyId - Company ID
   * @param {number} days - Number of days to fetch (1-90)
   * @returns {Promise<{summary: Object, daily: Array, models: Array, period_days: number}>}
   */
  async getLlmUsage(companyId: string, days: number = 30) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-ops/usage?days=${days}`,
      { headers }
    );
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Admin access required to view usage data');
      }
      if (response.status === 404) {
        throw new Error('Company not found');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to get LLM usage');
    }
    return response.json();
  },

  /**
   * Get rate limit status and configuration.
   * Returns current usage vs limits for sessions, tokens, and budget.
   * @param {string} companyId - Company ID
   * @returns {Promise<{tier: string, config: Object, current: Object, warnings: Array, exceeded: Array}>}
   */
  async getRateLimits(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-ops/rate-limits`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get rate limits');
    }
    return response.json();
  },

  /**
   * Update rate limit configuration.
   * Only company owners can update rate limits.
   * @param {string} companyId - Company ID
   * @param {Object} updates - Rate limit updates
   * @returns {Promise<{success: boolean, updated: Object}>}
   */
  async updateRateLimits(
    companyId: string,
    updates: {
      sessions_per_hour?: number;
      sessions_per_day?: number;
      tokens_per_month?: number;
      budget_cents_per_month?: number;
      alert_threshold_percent?: number;
    }
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-ops/rate-limits`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update rate limits' }));
      throw new Error(error.detail || 'Failed to update rate limits');
    }
    return response.json();
  },

  /**
   * Get budget alerts for the company.
   * @param {string} companyId - Company ID
   * @param {boolean} acknowledged - Filter by acknowledged status
   * @param {number} limit - Max number of alerts to return
   * @returns {Promise<{alerts: Array, total: number}>}
   */
  async getBudgetAlerts(
    companyId: string,
    options: { acknowledged?: boolean; limit?: number } = {}
  ) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options.acknowledged !== undefined) {
      params.append('acknowledged', String(options.acknowledged));
    }
    if (options.limit) {
      params.append('limit', String(options.limit));
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-ops/alerts${queryString}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get budget alerts');
    }
    return response.json();
  },

  /**
   * Acknowledge a budget alert.
   * @param {string} companyId - Company ID
   * @param {string} alertId - Alert ID
   * @returns {Promise<{success: boolean}>}
   */
  async acknowledgeBudgetAlert(companyId: string, alertId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-ops/alerts/${alertId}/acknowledge`,
      {
        method: 'POST',
        headers,
      }
    );
    if (!response.ok) {
      throw new Error('Failed to acknowledge alert');
    }
    return response.json();
  },

  // =============================================================================
  // LLM HUB - Presets & Model Registry
  // =============================================================================

  /**
   * Get all LLM presets (owner only).
   * @param {string} companyId - Company ID
   * @returns {Promise<{presets: LLMPresetFull[]}>}
   */
  async getLLMPresets(companyId: string): Promise<{ presets: LLMPresetFull[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/presets`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to fetch LLM presets');
    }
    return response.json();
  },

  /**
   * Update an LLM preset configuration (owner only).
   * @param {string} companyId - Company ID
   * @param {string} presetId - Preset ID (conservative, balanced, creative)
   * @param {UpdatePresetPayload} data - Update payload
   * @returns {Promise<{success: boolean, preset: LLMPresetFull}>}
   */
  async updateLLMPreset(
    companyId: string,
    presetId: string,
    data: UpdatePresetPayload
  ): Promise<{ success: boolean; preset: LLMPresetFull }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/presets/${presetId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to update LLM preset');
    }
    return response.json();
  },

  /**
   * Get model registry entries (owner only).
   * @param {string} companyId - Company ID
   * @param {string} [role] - Optional filter by role
   * @returns {Promise<{models: Record<string, ModelRegistryEntry[]>, roles: string[]}>}
   */
  async getModelRegistry(
    companyId: string,
    role?: string
  ): Promise<{ models: Record<string, ModelRegistryEntry[]>; roles: string[] }> {
    const headers = await getAuthHeaders();
    let url = `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/models`;
    if (role) {
      url += `?role=${encodeURIComponent(role)}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch model registry');
    }
    return response.json();
  },

  /**
   * Update a model registry entry (owner only).
   * @param {string} companyId - Company ID
   * @param {string} modelId - Model UUID
   * @param {UpdateModelPayload} data - Update payload
   * @returns {Promise<{success: boolean, model: ModelRegistryEntry}>}
   */
  async updateModelRegistryEntry(
    companyId: string,
    modelId: string,
    data: UpdateModelPayload
  ): Promise<{ success: boolean; model: ModelRegistryEntry }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/models/${modelId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to update model');
    }
    return response.json();
  },

  /**
   * Create a new model registry entry (owner only).
   * @param {string} companyId - Company ID
   * @param {CreateModelPayload} data - Create payload
   * @returns {Promise<{success: boolean, model: ModelRegistryEntry}>}
   */
  async createModelRegistryEntry(
    companyId: string,
    data: CreateModelPayload
  ): Promise<{ success: boolean; model: ModelRegistryEntry }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/models`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to create model');
    }
    return response.json();
  },

  /**
   * Delete a model registry entry (owner only).
   * @param {string} companyId - Company ID
   * @param {string} modelId - Model UUID
   * @returns {Promise<{success: boolean}>}
   */
  async deleteModelRegistryEntry(
    companyId: string,
    modelId: string
  ): Promise<{ success: boolean }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/models/${modelId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      throw new Error('Failed to delete model');
    }
    return response.json();
  },

  // ==========================================================================
  // AI Personas (Prompt Management)
  // ==========================================================================

  /**
   * Get all editable AI personas (owner only).
   * @param {string} companyId - Company ID
   * @returns {Promise<{personas: Persona[]}>}
   */
  async getPersonas(companyId: string): Promise<{ personas: Persona[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/personas`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to get personas');
    }
    return response.json();
  },

  /**
   * Update a persona's prompts (owner only).
   * Creates company-specific override if editing a global persona.
   * @param {string} companyId - Company ID
   * @param {string} personaKey - Persona key
   * @param {UpdatePersonaPayload} data - Update data
   * @returns {Promise<{success: boolean, persona: Persona, created: boolean}>}
   */
  async updatePersona(
    companyId: string,
    personaKey: string,
    data: UpdatePersonaPayload
  ): Promise<{ success: boolean; persona: Persona; created: boolean }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/personas/${personaKey}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to update persona');
    }
    return response.json();
  },

  /**
   * Reset a persona to global defaults (owner only).
   * Deletes any company-specific override.
   * @param {string} companyId - Company ID
   * @param {string} personaKey - Persona key
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async resetPersona(
    companyId: string,
    personaKey: string
  ): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/company/${companyId}/llm-hub/personas/${personaKey}/reset`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      throw new Error('Failed to reset persona');
    }
    return response.json();
  },

  // ==========================================================================
  // Public Endpoints (no authentication required)
  // ==========================================================================

  /**
   * Get council configuration stats for the landing page.
   * This is a public endpoint - no authentication required.
   * @param {string} [companyId] - Optional company ID for company-specific stats
   * @returns {Promise<CouncilStats>} The council configuration stats
   */
  async getCouncilStats(companyId?: string): Promise<CouncilStats> {
    const url = companyId
      ? `${API_BASE}${API_VERSION}/council-stats?company_id=${encodeURIComponent(companyId)}`
      : `${API_BASE}${API_VERSION}/council-stats`;
    const response = await fetch(url);
    if (!response.ok) {
      // Return defaults if endpoint fails (graceful degradation)
      return {
        stage1_count: 5,
        stage2_count: 6,
        stage3_count: 3,
        total_rounds: 3,
        providers: ['openai', 'anthropic', 'google', 'xai', 'deepseek'],
      };
    }
    return response.json();
  },

  // ===========================================================================
  // FEATURE FLAGS
  // ===========================================================================

  /**
   * Get all feature flags.
   * Returns current state of all feature flags for conditional rendering.
   * No authentication required - flags are public.
   */
  async getFeatureFlags(): Promise<{ flags: Record<string, boolean> }> {
    const response = await fetch(`${API_BASE}/api/feature-flags`);
    if (!response.ok) {
      // Return empty flags on error (fail open)
      return { flags: {} };
    }
    return response.json();
  },

  // ===========================================================================
  // ONBOARDING
  // ===========================================================================

  /**
   * Analyze a LinkedIn profile URL and generate onboarding data.
   * Returns profile information and a personalized "magic question".
   */
  async analyzeLinkedInProfile(linkedInUrl: string): Promise<OnboardingProfileResponse> {
    const response = await fetch(`${API_BASE}${API_VERSION}/onboarding/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_url: linkedInUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to analyze profile' }));
      return {
        success: false,
        fallback_required: true,
        error: error.detail || error.error || 'Failed to analyze profile',
      };
    }

    return response.json();
  },

  /**
   * Get trial status for the current user.
   * Returns whether the user has trial deliberations available or an API key.
   */
  async getTrialStatus(token: string): Promise<TrialStatusResponse> {
    const response = await fetch(`${API_BASE}${API_VERSION}/onboarding/trial-status`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Default to no trial on error
      return {
        has_trial_available: false,
        has_api_key: false,
        trial_count: 0,
        trial_limit: 3,
      };
    }

    return response.json();
  },

  /**
   * Check if the current user has admin access.
   * Returns admin status and role from platform_admins table.
   */
  async checkAdminAccess(): Promise<{ is_admin: boolean; role: string | null }> {
    const headers = await getAuthHeaders();
    try {
      const response = await fetch(`${API_BASE}${API_VERSION}/admin/check-access`, {
        headers,
      });
      // 403 means user is not an admin - return gracefully
      if (response.status === 403) {
        return { is_admin: false, role: null };
      }
      if (!response.ok) {
        return { is_admin: false, role: null };
      }
      return response.json();
    } catch (error) {
      console.error('Failed to check admin access:', error);
      return { is_admin: false, role: null };
    }
  },

  /**
   * Get platform statistics (admin only).
   */
  async getAdminStats(): Promise<AdminStats> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/stats`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch admin stats');
    }
    return response.json();
  },

  /**
   * List all platform users (admin only).
   */
  async listAdminUsers(params?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<AdminUsersResponse> {
    const headers = await getAuthHeaders();
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params?.search) searchParams.set('search', params.search);
    const url = `${API_BASE}${API_VERSION}/admin/users?${searchParams.toString()}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },

  /**
   * List all companies (admin only).
   */
  async listAdminCompanies(params?: {
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<AdminCompaniesResponse> {
    const headers = await getAuthHeaders();
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params?.search) searchParams.set('search', params.search);
    const url = `${API_BASE}${API_VERSION}/admin/companies?${searchParams.toString()}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch companies');
    }
    return response.json();
  },

  /**
   * List all platform admins (admin only).
   */
  async listAdminAdmins(): Promise<{ admins: AdminUserInfo[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/admins`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch admins');
    }
    return response.json();
  },

  /**
   * List platform audit logs (admin only).
   */
  async listAdminAuditLogs(filters?: AdminAuditFilters): Promise<AdminAuditLogsResponse> {
    const headers = await getAuthHeaders();
    const searchParams = new URLSearchParams();
    if (filters?.page) searchParams.set('page', filters.page.toString());
    if (filters?.page_size) searchParams.set('page_size', filters.page_size.toString());
    if (filters?.action_category) searchParams.set('action_category', filters.action_category);
    if (filters?.actor_type) searchParams.set('actor_type', filters.actor_type);
    if (filters?.resource_type) searchParams.set('resource_type', filters.resource_type);
    if (filters?.company_id) searchParams.set('company_id', filters.company_id);
    if (filters?.start_date) searchParams.set('start_date', filters.start_date);
    if (filters?.end_date) searchParams.set('end_date', filters.end_date);
    if (filters?.search) searchParams.set('search', filters.search);
    const url = `${API_BASE}${API_VERSION}/admin/audit?${searchParams.toString()}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }
    return response.json();
  },

  /**
   * Get audit log filter categories (admin only).
   */
  async getAdminAuditCategories(): Promise<AdminAuditCategories> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/audit/categories`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to fetch audit categories');
    }
    return response.json();
  },

  /**
   * Export audit logs to JSON (super_admin only).
   */
  async exportAdminAuditLogs(params?: {
    action_category?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<AdminAuditExportResponse> {
    const headers = await getAuthHeaders();
    const searchParams = new URLSearchParams();
    if (params?.action_category) searchParams.set('action_category', params.action_category);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const url = `${API_BASE}${API_VERSION}/admin/audit/export?${searchParams.toString()}`;
    const response = await fetch(url, { method: 'POST', headers });
    if (!response.ok) {
      throw new Error('Failed to export audit logs');
    }
    return response.json();
  },

  // ===========================================================================
  // Admin Invitations
  // ===========================================================================

  /**
   * Create and send a platform invitation (admin only).
   */
  async createAdminInvitation(data: CreateInvitationRequest): Promise<CreateInvitationResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/invitations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create invitation' }));
      throw new Error(error.detail || 'Failed to create invitation');
    }
    return response.json();
  },

  /**
   * List platform invitations (admin only).
   */
  async listAdminInvitations(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    search?: string;
  }): Promise<AdminInvitationsResponse> {
    const headers = await getAuthHeaders();
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    const url = `${API_BASE}${API_VERSION}/admin/invitations?${searchParams.toString()}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch invitations');
    }
    return response.json();
  },

  /**
   * Cancel a pending invitation (admin only).
   */
  async cancelAdminInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/invitations/${invitationId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to cancel invitation' }));
      throw new Error(error.detail || 'Failed to cancel invitation');
    }
    return response.json();
  },

  /**
   * Resend invitation email (admin only).
   */
  async resendAdminInvitation(invitationId: string): Promise<ResendInvitationResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/admin/invitations/${invitationId}/resend`,
      { method: 'POST', headers }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to resend invitation' }));
      throw new Error(error.detail || 'Failed to resend invitation');
    }
    return response.json();
  },

  // ===========================================================================
  // Admin User Management
  // ===========================================================================

  /**
   * Get detailed user information (admin only).
   */
  async getAdminUserDetails(userId: string): Promise<AdminUserDetails> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/users/${userId}`, { headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch user details' }));
      throw new Error(error.detail || 'Failed to fetch user details');
    }
    return response.json();
  },

  /**
   * Update a user's status (suspend/unsuspend) (admin only).
   */
  async updateAdminUser(
    userId: string,
    data: { is_suspended?: boolean }
  ): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update user' }));
      throw new Error(error.detail || 'Failed to update user');
    }
    return response.json();
  },

  /**
   * Delete a user and all their data (admin only).
   * Requires confirm=true as a safety measure.
   */
  async deleteAdminUser(userId: string): Promise<AdminDeleteUserResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/users/${userId}?confirm=true`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete user' }));
      throw new Error(error.detail || 'Failed to delete user');
    }
    return response.json();
  },

  // ===========================================================================
  // Admin Impersonation
  // ===========================================================================

  /**
   * Start impersonating a user (admin only).
   * Returns a session that must be stored client-side.
   */
  async startImpersonation(
    targetUserId: string,
    reason: string
  ): Promise<StartImpersonationResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/admin/users/${targetUserId}/impersonate`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to start impersonation' }));
      throw new Error(error.detail || 'Failed to start impersonation');
    }
    return response.json();
  },

  /**
   * End an active impersonation session (admin only).
   */
  async endImpersonation(sessionId?: string): Promise<EndImpersonationResponse> {
    const headers = await getAuthHeaders();
    const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/impersonation/end${params}`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to end impersonation' }));
      throw new Error(error.detail || 'Failed to end impersonation');
    }
    return response.json();
  },

  /**
   * Check current impersonation status (admin only).
   */
  async getImpersonationStatus(sessionId?: string): Promise<ImpersonationStatusResponse> {
    const headers = await getAuthHeaders();
    const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/impersonation/status${params}`, {
      headers,
    });
    if (!response.ok) {
      // Return not impersonating on error
      return { is_impersonating: false, session: null };
    }
    return response.json();
  },

  /**
   * List impersonation sessions (super_admin only).
   */
  async listImpersonationSessions(params?: {
    page?: number;
    page_size?: number;
    include_inactive?: boolean;
  }): Promise<ImpersonationSessionsResponse> {
    const headers = await getAuthHeaders();
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params?.include_inactive) searchParams.set('include_inactive', 'true');
    const response = await fetch(
      `${API_BASE}${API_VERSION}/admin/impersonation/sessions?${searchParams.toString()}`,
      { headers }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch impersonation sessions');
    }
    return response.json();
  },

  // ===========================================================================
  // Public Invitation Endpoints (no auth required)
  // ===========================================================================

  /**
   * Validate an invitation token (public, no auth).
   */
  async validateInvitation(token: string): Promise<InvitationValidation> {
    const response = await fetch(
      `${API_BASE}${API_VERSION}/invitations/validate?token=${encodeURIComponent(token)}`
    );
    return response.json();
  },

  /**
   * Accept an invitation after signup (public, no auth).
   */
  async acceptInvitation(token: string, userId: string): Promise<AcceptInvitationResponse> {
    const response = await fetch(
      `${API_BASE}${API_VERSION}/invitations/accept?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to accept invitation' }));
      throw new Error(error.detail || 'Failed to accept invitation');
    }
    return response.json();
  },
};

// =============================================================================
// Types for Admin Portal
// =============================================================================

export interface AdminStats {
  total_users: number;
  total_companies: number;
  total_conversations: number;
  total_messages: number;
  active_users_24h: number;
  active_users_7d: number;
}

export interface AdminPlatformUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
}

export interface AdminUsersResponse {
  users: AdminPlatformUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminCompanyInfo {
  id: string;
  name: string;
  created_at: string;
  user_count: number;
  conversation_count: number;
  owner_email: string | null;
}

export interface AdminCompaniesResponse {
  companies: AdminCompanyInfo[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserInfo {
  id: string;
  email: string;
  role: string;
  created_at: string; // When admin access was granted
  user_metadata?: Record<string, unknown> | null;
}

export interface AdminAuditLog {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_type: 'user' | 'admin' | 'system' | 'api';
  action: string;
  action_category: 'auth' | 'user' | 'company' | 'admin' | 'data' | 'api' | 'billing' | 'security';
  resource_type: string | null;
  resource_id: string | null;
  resource_name: string | null;
  company_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AdminAuditLogsResponse {
  logs: AdminAuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminAuditFilters {
  page?: number;
  page_size?: number;
  action_category?: string;
  actor_type?: string;
  resource_type?: string;
  company_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface AdminAuditCategoryOption {
  value: string;
  label: string;
}

export interface AdminAuditCategories {
  action_categories: AdminAuditCategoryOption[];
  actor_types: AdminAuditCategoryOption[];
  resource_types: AdminAuditCategoryOption[];
}

export interface AdminAuditExportResponse {
  success: boolean;
  count: number;
  exported_at: string;
  logs: AdminAuditLog[];
}

// =============================================================================
// Types for Admin User Management
// =============================================================================

export interface AdminUserDetails {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
  is_suspended: boolean;
  companies: Array<{ id: string; name: string; created_at: string }>;
  conversation_count: number;
}

export interface AdminDeleteUserResponse {
  success: boolean;
  message: string;
  deleted: {
    companies: number;
    conversations: number;
  };
}

export interface AdminUpdateUserResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// Types for Admin Invitations
// =============================================================================

export interface CreateInvitationRequest {
  email: string;
  name?: string;
  notes?: string;
  target_company_id?: string;
  target_company_role?: 'owner' | 'admin' | 'member';
}

export interface CreateInvitationResponse {
  success: boolean;
  invitation_id: string;
  email: string;
  expires_at: string;
  email_sent: boolean;
  email_preview_mode: boolean;
}

export interface AdminInvitation {
  id: string;
  email: string;
  name: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'revoked';
  invited_by_email: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  target_company_name: string | null;
  resend_count: number;
}

export interface AdminInvitationsResponse {
  invitations: AdminInvitation[];
  total: number;
  page: number;
  page_size: number;
}

export interface ResendInvitationResponse {
  success: boolean;
  message: string;
  new_expires_at: string;
  email_sent: boolean;
  email_preview_mode: boolean;
}

// Public invitation validation (no auth required)
export interface InvitationValidation {
  is_valid: boolean;
  email: string | null;
  name: string | null;
  expires_at: string | null;
  target_company_name: string | null;
  error: string | null;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  added_to_company: boolean;
  company_name: string | null;
}

// =============================================================================
// Types for Admin Impersonation
// =============================================================================

export interface ImpersonationSession {
  session_id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string;
  target_user_email: string;
  started_at: string;
  expires_at: string;
  reason: string;
}

export interface StartImpersonationRequest {
  reason: string;
}

export interface StartImpersonationResponse {
  success: boolean;
  session: ImpersonationSession;
}

export interface ImpersonationStatusResponse {
  is_impersonating: boolean;
  session: ImpersonationSession | null;
}

export interface EndImpersonationResponse {
  success: boolean;
  message: string;
  ended_count: number;
}

export interface ImpersonationSessionHistoryItem {
  session_id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string;
  target_user_email: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  ended_reason: 'manual' | 'expired' | 'admin_logout' | 'target_deleted' | null;
  reason: string;
  is_active: boolean;
}

export interface ImpersonationSessionsResponse {
  sessions: ImpersonationSessionHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Types for Public Endpoints
// =============================================================================

/**
 * Council configuration stats returned by the public endpoint.
 */
export interface CouncilStats {
  stage1_count: number; // Number of AIs in Stage 1 (initial responses)
  stage2_count: number; // Number of AIs in Stage 2 (peer review)
  stage3_count: number; // Number of chairman models
  total_rounds: number; // Always 3 (the deliberation stages)
  providers: string[]; // List of unique provider names for carousel display
}

// =============================================================================
// Types for LLM Hub
// =============================================================================

export interface Persona {
  id: string;
  persona_key: string;
  name: string;
  category: string;
  description?: string;
  system_prompt: string;
  user_prompt_template?: string;
  is_global: boolean;
  updated_at?: string;
}

export interface UpdatePersonaPayload {
  name?: string;
  description?: string;
  system_prompt?: string;
  user_prompt_template?: string;
}

export interface UpdatePresetPayload {
  config: {
    stage1: StageConfig;
    stage2: StageConfig;
    stage3: StageConfig;
  };
}

export interface UpdateModelPayload {
  model_id?: string;
  priority?: number;
  is_enabled?: boolean;
}

export interface CreateModelPayload {
  role: string;
  model_id: string;
  priority?: number;
}

interface StageConfig {
  temperature: number;
  max_tokens: number;
}

/**
 * Full LLM preset with configuration for all stages.
 */
interface LLMPresetFull {
  id: string; // 'conservative' | 'balanced' | 'creative'
  name: string;
  description?: string;
  config: {
    stage1: StageConfig;
    stage2: StageConfig;
    stage3: StageConfig;
  };
  recommended_for: string[];
  updated_at?: string;
}

/**
 * A model entry in the model registry.
 */
interface ModelRegistryEntry {
  id: string;
  role: string;
  model_id: string;
  display_name?: string;
  priority: number;
  is_active: boolean;
  is_global?: boolean;
  notes?: string;
}
