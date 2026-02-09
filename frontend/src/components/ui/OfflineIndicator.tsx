/**
 * OfflineIndicator - Shows a banner when the user is offline
 *
 * Appears at the top of the screen when network is disconnected.
 * Auto-dismisses when connection is restored.
 */

import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import './OfflineIndicator.css';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-indicator" role="alert" aria-live="assertive">
      <WifiOff size={16} aria-hidden="true" />
      <span>{t('offline.message', "You're offline. Some features may be unavailable.")}</span>
    </div>
  );
}
