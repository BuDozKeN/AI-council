/**
 * Token Usage Settings Utilities
 *
 * Helper functions for managing token usage visibility settings.
 * Extracted from DeveloperSection to support React Fast Refresh.
 */

const SHOW_TOKEN_USAGE_KEY = 'showTokenUsage';

export function getShowTokenUsage(): boolean {
  return localStorage.getItem(SHOW_TOKEN_USAGE_KEY) === 'true';
}

export function setShowTokenUsage(enabled: boolean): void {
  localStorage.setItem(SHOW_TOKEN_USAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent('showTokenUsageChanged', { detail: enabled }));
}
