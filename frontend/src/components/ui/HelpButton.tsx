/**
 * LanguageButton - Floating language selector in the bottom-right corner
 *
 * Provides quick access to change the application language.
 * Uses fixed positioning with high z-index to stay above all content.
 */

import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, X } from 'lucide-react';
import { supportedLanguages, type SupportedLanguage } from '../../i18n';
import './HelpButton.css';

// SSR-safe mount detection
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function HelpButton() {
  const { t, i18n } = useTranslation();
  const mounted = useIsMounted();

  // Get current language (normalize to 2-char code)
  const currentLang = (i18n.language?.split('-')[0] || 'en') as SupportedLanguage;

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  // Set timestamp on pointer/mouse down to prevent Radix modals from closing
  // See CLAUDE.md "Fixed-Position Elements + Radix Dialogs" for details
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime = Date.now();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime = Date.now();
  };

  // Don't render until mounted (SSR safety)
  if (!mounted) {
    return null;
  }

  // Get current language name for display
  const currentLangName = supportedLanguages.find(l => l.code === currentLang)?.nativeName || 'English';

  return (
    <div className="help-button-container" data-testid="language-button">
      {/* Language Panel */}
      {isOpen && (
        <div
          className="help-panel"
          ref={panelRef}
          role="dialog"
          aria-label={t('settings.language')}
          onPointerDown={(e) => {
            e.stopPropagation();
            // Set timestamp so parent modals don't close when interacting with language panel
            (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime =
              Date.now();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime =
              Date.now();
          }}
        >
          <div className="help-panel-header">
            <h3 className="help-panel-title">{t('settings.language')}</h3>
            <button
              className="help-panel-close"
              onClick={() => setIsOpen(false)}
              aria-label={t('common.close')}
            >
              <X size={16} />
            </button>
          </div>
          <div className="help-language-section" style={{ borderTop: 'none', paddingTop: '8px' }}>
            <div className="help-language-options" style={{ flexDirection: 'column', gap: '6px' }}>
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  className={`help-language-btn ${currentLang === lang.code ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    // Set timestamp so parent modals don't close when clicking language options
                    (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime =
                      Date.now();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime =
                      Date.now();
                  }}
                  style={{ flex: 'none' }}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Language Button */}
      <button
        ref={buttonRef}
        className={`help-button-btn ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        aria-label={`${t('settings.language')}: ${currentLangName}`}
        aria-expanded={isOpen}
        title={`${t('settings.language')}: ${currentLangName}`}
      >
        {isOpen ? <X size={20} /> : <Globe size={20} />}
      </button>
    </div>
  );
}
