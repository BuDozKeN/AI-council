/**
 * API client shared infrastructure.
 * Provides base URL, auth headers, error handling used by all domain modules.
 *
 * Split from api.ts during CRITICAL-3 tech debt remediation.
 */

import { logger } from '../utils/logger';

export const log = logger.scope('API');

// In development, use relative URLs so Vite's proxy handles CORS
// In production, use the full URL from environment
export const API_BASE = import.meta.env.PROD
  ? import.meta.env.VITE_API_URL || 'http://localhost:8000'
  : '';

// API version prefix - all endpoints use v1
export const API_VERSION = '/api/v1';

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
export async function handleErrorResponse(response: Response, fallbackMessage: string): Promise<never> {
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
// Token Management
// =============================================================================

type TokenGetter = (() => Promise<string | null>) | null;

// Token getter function - set by the app to provide auth tokens
let getAccessToken: TokenGetter = null;

/**
 * Set the function that retrieves the access token.
 */
export const setTokenGetter = (getter: TokenGetter): void => {
  getAccessToken = getter;
};

/**
 * Get the current access token (for direct use in non-JSON requests like file uploads).
 */
export const getToken = async (): Promise<string | null> => {
  if (!getAccessToken) return null;
  return getAccessToken();
};

// =============================================================================
// Impersonation Context
// =============================================================================

// Session storage key for impersonation data (must match useImpersonation.ts)
const IMPERSONATION_STORAGE_KEY = 'axcouncil_impersonation_session';

/**
 * Get the active impersonation session ID (if any).
 * This is read from sessionStorage where the useImpersonation hook stores it.
 */
const getImpersonationSessionId = (): string | null => {
  try {
    const stored = sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as { session_id?: string };
    return session.session_id || null;
  } catch {
    return null;
  }
};

/**
 * Get headers including Authorization if token is available.
 * Also includes X-Impersonate-User header if impersonation session is active.
 */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
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

  // Add impersonation header if session is active
  const impersonationSessionId = getImpersonationSessionId();
  if (impersonationSessionId) {
    headers['X-Impersonate-User'] = impersonationSessionId;
    log.debug('Adding impersonation header:', impersonationSessionId);
  }

  return headers;
};
