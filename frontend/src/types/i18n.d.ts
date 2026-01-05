/**
 * Type-safe i18n configuration for react-i18next
 *
 * This file provides compile-time type checking for translation keys.
 * If you use an invalid key like t('nonexistent.key'), TypeScript will
 * show an error at compile time, preventing runtime i18n bugs.
 *
 * The types are derived from the English translation file (en.json),
 * which serves as the source of truth for all translation keys.
 */

import 'i18next';
import type en from '../i18n/locales/en.json';

// Recursive type to extract all nested keys as dot-notation strings
type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

// All valid translation keys derived from en.json structure
export type TranslationKey = NestedKeyOf<typeof en>;

declare module 'i18next' {
  interface CustomTypeOptions {
    // Default namespace used when not specified
    defaultNS: 'translation';
    // Type-safe resources derived from English translation file
    resources: {
      translation: typeof en;
    };
  }
}
