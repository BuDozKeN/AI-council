/**
 * SidebarFooter - User info, dev toggles, and action buttons
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { Briefcase } from 'lucide-react';
import { DEV_MODE } from './hooks';

export function SidebarFooter({
  user,
  mockMode,
  isTogglingMock,
  onToggleMockMode,
  cachingMode,
  isTogglingCaching,
  onToggleCachingMode,
  onOpenMyCompany,
  onOpenSettings,
  onSignOut,
  // Hover handlers to keep panel open when hovering footer
  onMouseEnter,
  onMouseLeave
}) {
  if (!user) return null;

  return (
    <div
      className="sidebar-footer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Mode Toggles - Dev only */}
      {DEV_MODE && (
        <div className="mode-toggle-section">
          <button
            className={`mode-toggle-btn ${mockMode ? 'mock' : 'production'} ${isTogglingMock ? 'toggling' : ''}`}
            onClick={onToggleMockMode}
            disabled={isTogglingMock || mockMode === null}
            title={mockMode ? 'Mock Mode: Using simulated responses (free)' : 'Production Mode: Using real API calls (costs credits)'}
          >
            <span className="mode-indicator"></span>
            <span className="mode-label">{mockMode === null ? '...' : mockMode ? 'Mock' : 'Prod'}</span>
          </button>
          <button
            className={`mode-toggle-btn caching ${cachingMode ? 'enabled' : 'disabled'} ${isTogglingCaching ? 'toggling' : ''}`}
            onClick={onToggleCachingMode}
            disabled={isTogglingCaching || cachingMode === null}
            title={cachingMode ? 'Caching ON: Reduces costs by caching context (Claude/Gemini)' : 'Caching OFF: Standard API calls'}
          >
            <span className="mode-indicator"></span>
            <span className="mode-label">{cachingMode === null ? '...' : cachingMode ? 'Cache' : 'No Cache'}</span>
          </button>
        </div>
      )}

      <div className="user-info">
        <span className="user-email" title={user.email}>
          {user.email}
        </span>
      </div>
      <div className="sidebar-footer-buttons">
        <button className="company-btn" onClick={onOpenMyCompany} title="My Company">
          <Briefcase className="h-3.5 w-3.5" />
          Company
        </button>
        <button className="settings-btn" onClick={onOpenSettings} title="Settings & Profile">
          Settings
        </button>
        <button className="sign-out-btn" onClick={onSignOut} title="Sign out">
          Sign Out
        </button>
      </div>
    </div>
  );
}
