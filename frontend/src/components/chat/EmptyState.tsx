/**
 * EmptyState - Fallback welcome screen when no conversation selected
 *
 * Uses the unified ui/EmptyState component for consistent styling.
 * NOTE: LandingHero now handles the primary empty/welcome state.
 * This is kept as a fallback for edge cases where no conversation exists.
 */

import { useTranslation } from 'react-i18next';
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
