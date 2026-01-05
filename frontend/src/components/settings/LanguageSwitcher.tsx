/**
 * Language Switcher Component
 *
 * Premium language selector with SVG flags using Radix Select.
 * Uses country-flag-icons for cross-platform flag rendering (Windows doesn't support flag emojis).
 * Language preference is persisted to localStorage automatically by i18next.
 */

import { useTranslation } from 'react-i18next';
import { supportedLanguages, type SupportedLanguage } from '../../i18n';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
// SVG flags that work on all platforms (Windows doesn't render flag emojis)
import US from 'country-flag-icons/react/3x2/US';
import ES from 'country-flag-icons/react/3x2/ES';

// Map language codes to flag components
const flagComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  en: US,
  es: ES,
};

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    // Language preference is auto-saved to localStorage by i18next
    // Key: 'axcouncil_language' (configured in i18n/index.ts)
  };

  // Get current language (normalize to 2-char code)
  const currentLang = (i18n.language?.split('-')[0] || 'en') as SupportedLanguage;
  const currentLanguage = supportedLanguages.find((l) => l.code === currentLang);
  const CurrentFlag = flagComponents[currentLang] || US;

  return (
    <Card className="settings-card">
      <CardHeader>
        <CardTitle>{t('settings.language')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="form-group">
          <Select value={currentLang} onValueChange={handleLanguageChange}>
            <SelectTrigger id="language-select" className="language-select-trigger">
              <SelectValue>
                {currentLanguage && (
                  <span className="language-select-value">
                    <CurrentFlag className="language-flag" />
                    <span>{currentLanguage.nativeName}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => {
                const FlagIcon = flagComponents[lang.code] || US;
                return (
                  <SelectItem key={lang.code} value={lang.code} className="language-select-item">
                    <span className="language-select-option">
                      <FlagIcon className="language-flag" />
                      <span className="language-name">{lang.nativeName}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
