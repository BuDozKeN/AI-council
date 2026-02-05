/**
 * LLM operations domain API methods.
 * Includes usage analytics, rate limits, budget alerts, presets, model registry, and personas.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { API_BASE, API_VERSION, getAuthHeaders } from './client';
import type {
  UpdatePresetPayload,
  UpdateModelPayload,
  CreateModelPayload,
  UpdatePersonaPayload,
  LLMPresetFull,
  ModelRegistryEntry,
  Persona,
} from './types';

export const llmMethods = {
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
};
