/**
 * Admin Shared Constants & Helper Functions
 *
 * Non-component exports shared across admin tab components.
 * Separated from adminUtils.tsx to satisfy react-refresh/only-export-components.
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { getIntlLocale } from '../../i18n';

// =============================================================================
// Shared Constants
// =============================================================================

/** Dummy stats used by StatsOverview and AnalyticsTab */
export const DUMMY_STATS = {
  total_users: 156,
  total_companies: 23,
  total_conversations: 1247,
  total_messages: 8934,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format technical action names into user-friendly text
 * e.g., "view_audit_logs" -> "Viewed audit logs"
 */
export const formatActionName = (action: string): string => {
  const actionMap: Record<string, string> = {
    view_audit_logs: 'Viewed audit logs',
    view_user_details: 'Viewed user details',
    view_company_details: 'Viewed company details',
    update_user: 'Updated user',
    delete_user: 'Deleted user',
    create_company: 'Created company',
    update_company: 'Updated company',
    delete_company: 'Deleted company',
    impersonate_user: 'Impersonated user',
    grant_admin: 'Granted admin access',
    revoke_admin: 'Revoked admin access',
  };

  if (actionMap[action]) {
    return actionMap[action];
  }

  // Fallback: Convert snake_case to readable text
  return action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(getIntlLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
