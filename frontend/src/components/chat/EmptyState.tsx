/**
 * EmptyState - Welcome screen when no conversation selected or conversation has no messages
 *
 * These components use the unified ui/EmptyState component for consistent styling.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

/**
 * Branded welcome screen shown when no conversation is selected.
 * Uses custom AX logo icon.
 */
export function WelcomeState() {
  const { t } = useTranslation();
  const brandedIcon = (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
      <span className="text-white font-bold text-2xl">AX</span>
    </div>
  );

  return (
    <div className="chat-interface">
      <EmptyState
        variant="large"
        customIcon={brandedIcon}
        title={t('chat.welcomeTitle')}
        message={t('chat.welcomeMessage')}
      />
    </div>
  );
}

/**
 * Empty state shown when a conversation has no messages yet.
 * Shows hints to help users get started.
 */
export function ConversationEmptyState() {
  const { t } = useTranslation();
  return (
    <EmptyState
      variant="large"
      icon={Clock}
      title={t('chat.askTheCouncil')}
      message={t('chat.councilDebateHint')}
      hints={[t('chat.tryHint'), t('chat.pasteImageHint')]}
    />
  );
}
