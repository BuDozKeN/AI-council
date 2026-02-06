/**
 * SettingsTab - Platform settings placeholder
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';

export function SettingsTab() {
  const { t } = useTranslation();

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.settings.title', 'Platform Settings')}</h2>
          <p className="admin-section-desc">
            {t('admin.settings.description', 'Configure platform-wide settings and preferences.')}
          </p>
        </div>
      </div>

      <div className="admin-placeholder">
        <Settings className="admin-placeholder-icon" />
        <h3>{t('admin.settings.comingSoon', 'Coming Soon')}</h3>
        <p>
          {t(
            'admin.settings.comingSoonDesc',
            'Global configuration options will be available in a future update.'
          )}
        </p>
      </div>
    </div>
  );
}
