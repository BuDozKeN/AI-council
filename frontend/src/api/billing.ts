/**
 * Profile, billing, and attachments domain API methods.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders, getToken } from './client';

export const billingMethods = {
  // ============================================
  // PROFILE METHODS
  // ============================================

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

  async getBillingPlans() {
    const response = await fetch(`${API_BASE}${API_VERSION}/billing/plans`);
    if (!response.ok) {
      throw new Error('Failed to get billing plans');
    }
    return response.json();
  },

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

  async uploadAttachment(
    file: File,
    conversationId: string | null = null,
    messageIndex: number | null = null
  ) {
    const token = await getToken();

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

  async deleteAttachment(attachmentId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      throw new Error('Failed to delete attachment');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : { success: true };
  },
};
