/**
 * Type definitions for AI Council frontend
 *
 * Usage:
 *   import type { Business, Conversation, Message } from '../types';
 */

export * from './business';
export * from './conversation';
export * from './api';

// i18n types are declared in i18n.d.ts and augment react-i18next module
export type { TranslationKey } from './i18n.d';
