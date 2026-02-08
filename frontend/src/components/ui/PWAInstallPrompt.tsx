/**
 * PWAInstallPrompt - Shows an install banner when the app can be installed as PWA
 *
 * Captures the beforeinstallprompt event and shows a dismissible banner
 * that allows users to install the app to their device.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';
import { Button } from './button';
import './PWAInstallPrompt.css';

// Type for the beforeinstallprompt event (not in standard lib)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Storage key for dismissal
const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallPrompt() {
  const { t } = useTranslation();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check if user dismissed recently
  const wasDismissedRecently = useCallback(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const dismissedAt = parseInt(dismissed, 10);
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  }, []);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Stash the event for later use
      setInstallPrompt(e as BeforeInstallPromptEvent);

      // Only show if not dismissed recently
      if (!wasDismissedRecently()) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [wasDismissedRecently]);

  // Handle install button click
  const handleInstall = async () => {
    if (!installPrompt) return;

    setIsInstalling(true);
    try {
      // Show the native install prompt
      await installPrompt.prompt();

      // Wait for user choice
      const { outcome } = await installPrompt.userChoice;

      if (outcome === 'accepted') {
        // User accepted - hide the banner
        setIsVisible(false);
        setInstallPrompt(null);
      }
    } catch (err) {
      console.error('PWA install failed:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!isVisible || !installPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt" role="alert" aria-live="polite">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <Download size={20} aria-hidden="true" />
        </div>
        <div className="pwa-install-text">
          <span className="pwa-install-title">{t('pwa.installTitle', 'Install AxCouncil')}</span>
          <span className="pwa-install-desc">
            {t('pwa.installDesc', 'Get quick access from your home screen')}
          </span>
        </div>
      </div>
      <div className="pwa-install-actions">
        <Button
          variant="default"
          size="sm"
          onClick={handleInstall}
          disabled={isInstalling}
          className="pwa-install-btn"
        >
          {isInstalling ? t('common.installing', 'Installing...') : t('pwa.install', 'Install')}
        </Button>
        <button
          className="pwa-dismiss-btn"
          onClick={handleDismiss}
          aria-label={t('common.dismiss', 'Dismiss')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
