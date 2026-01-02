/**
 * EmptyState - Welcome screen when no conversation selected or conversation has no messages
 *
 * These components use the unified ui/EmptyState component for consistent styling.
 * Extracted from ChatInterface.jsx for better maintainability.
 */

import { Clock } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

/**
 * Branded welcome screen shown when no conversation is selected.
 * Uses custom AX logo icon.
 */
export function WelcomeState() {
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
        title="Welcome to AxCouncil"
        message="Your AI council is ready. What decision can we help with?"
      />
    </div>
  );
}

/**
 * Empty state shown when a conversation has no messages yet.
 * Shows hints to help users get started.
 */
export function ConversationEmptyState() {
  return (
    <EmptyState
      variant="large"
      icon={Clock}
      title="Ask the Council"
      message="5 AI advisors will debate your question and synthesize the best answer"
      hints={[
        "Try: \"What's the best approach to...\"",
        "Paste images with Ctrl+V"
      ]}
    />
  );
}
