/**
 * i18n Configuration for AxCouncil
 *
 * Language-agnostic internationalization setup.
 * To add a new language, see PLAN-I18N-IMPLEMENTATION.md
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import es from './locales/es.json';

/**
 * Supported languages configuration.
 * To add a new language:
 * 1. Create locales/[code].json translation file
 * 2. Import it above
 * 3. Add entry here with flag emoji
 * 4. Add to resources below
 */
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  // Future languages:
  // { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  // { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  // { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  // { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]['code'];

/**
 * Locale mapping for Intl APIs (dates, numbers, currency)
 */
export const localeMap: Record<string, string> = {
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
  pt: 'pt-BR',
  ja: 'ja-JP',
};

/**
 * Get the Intl-compatible locale code for the current language
 */
export const getIntlLocale = (): string => {
  const lang = i18n.language?.split('-')[0] || 'en';
  return localeMap[lang] || 'en-GB';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      // Add new languages here:
      // de: { translation: de },
    },
    fallbackLng: 'en',
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    detection: {
      // Order of language detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language preference
      caches: ['localStorage'],
      // LocalStorage key for language preference
      lookupLocalStorage: 'axcouncil_language',
    },
  });

export default i18n;
