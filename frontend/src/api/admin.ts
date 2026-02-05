/**
 * Admin portal domain API methods.
 * Includes admin access, stats, users, companies, audit logs, invitations,
 * user management, and impersonation.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders } from './client';
import type {
  AdminStats,
  ModelAnalyticsResponse,
  AdminUsersResponse,
  AdminCompaniesResponse,
  AdminUserInfo,
  AdminAuditFilters,
  AdminAuditLogsResponse,
  AdminAuditCategories,
  AdminAuditExportResponse,
  CreateInvitationRequest,
  CreateInvitationResponse,
  AdminInvitationsResponse,
  ResendInvitationResponse,
  AdminUserDetails,
  AdminDeleteUserResponse,
  AdminDeletedUser,
  AdminRestoreUserResponse,
  StartImpersonationResponse,
  EndImpersonationResponse,
  ImpersonationStatusResponse,
  ImpersonationSessionsResponse,
  InvitationValidation,
  AcceptInvitationResponse,
} from './types';

export const adminMethods = {
  async checkAdminAccess(): Promise<{ is_admin: boolean; role: string | null }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}${API_VERSION}/admin/check-access`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 403) {
        return { is_admin: false, role: null };
      }
      if (!response.ok) {
        return { is_admin: false, role: null };
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Admin access check timed out after 10s');
        throw new Error('Admin access check timed out. Please check your network connection.');
      }
      console.error('Failed to check admin access:', error);
      return { is_admin: false, role: null };
    }
  },

  async getAdminStats(): Promise<AdminStats> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/stats`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch admin stats');
    }
    return response.json();
  },

  async getModelAnalytics(): Promise<ModelAnalyticsResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/model-analytics`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch model analytics');
    }
    return response.json();
  },

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

  async listAdminAdmins(): Promise<{ admins: AdminUserInfo[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/admins`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch admins');
    }
    return response.json();
  },

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
      const message =
        error.detail || error.error?.message || error.message || `HTTP ${response.status}`;
      console.error('Cancel invitation error:', { status: response.status, error, invitationId });
      throw new Error(message);
    }
    return response.json();
  },

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

  async deleteAdminInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE}${API_VERSION}/admin/invitations/${invitationId}/permanent`,
      { method: 'DELETE', headers }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete invitation' }));
      throw new Error(error.detail || 'Failed to delete invitation');
    }
    return response.json();
  },

  // ===========================================================================
  // Admin User Management
  // ===========================================================================

  async getAdminUserDetails(userId: string): Promise<AdminUserDetails> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/users/${userId}`, { headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch user details' }));
      throw new Error(error.detail || 'Failed to fetch user details');
    }
    return response.json();
  },

  async updateAdminUser(
    userId: string,
    data: { is_suspended?: boolean; suspend_reason?: string }
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

  async deleteAdminUser(
    userId: string,
    options?: { reason?: string; permanent?: boolean }
  ): Promise<AdminDeleteUserResponse> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ confirm: 'true' });
    if (options?.reason) {
      params.set('reason', options.reason);
    }
    if (options?.permanent) {
      params.set('permanent', 'true');
    }
    const response = await fetch(
      `${API_BASE}${API_VERSION}/admin/users/${userId}?${params.toString()}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to delete user' }));
      throw new Error(error.detail || 'Failed to delete user');
    }
    return response.json();
  },

  async restoreAdminUser(userId: string): Promise<AdminRestoreUserResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/users/${userId}/restore`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to restore user' }));
      throw new Error(error.detail || 'Failed to restore user');
    }
    return response.json();
  },

  async listDeletedUsers(options?: {
    include_anonymized?: boolean;
  }): Promise<{ deleted_users: AdminDeletedUser[]; total: number }> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options?.include_anonymized) {
      params.set('include_anonymized', 'true');
    }
    const response = await fetch(
      `${API_BASE}${API_VERSION}/admin/users/deleted?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to list deleted users' }));
      throw new Error(error.detail || 'Failed to list deleted users');
    }
    return response.json();
  },

  // ===========================================================================
  // Admin Impersonation
  // ===========================================================================

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
      const error = await response
        .json()
        .catch(() => ({ detail: 'Failed to start impersonation' }));
      throw new Error(error.detail || 'Failed to start impersonation');
    }
    return response.json();
  },

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

  async getImpersonationStatus(sessionId?: string): Promise<ImpersonationStatusResponse> {
    const headers = await getAuthHeaders();
    const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    const response = await fetch(`${API_BASE}${API_VERSION}/admin/impersonation/status${params}`, {
      headers,
    });
    if (!response.ok) {
      return { is_impersonating: false, session: null };
    }
    return response.json();
  },

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

  async validateInvitation(token: string): Promise<InvitationValidation> {
    const response = await fetch(
      `${API_BASE}${API_VERSION}/invitations/validate?token=${encodeURIComponent(token)}`
    );
    return response.json();
  },

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
