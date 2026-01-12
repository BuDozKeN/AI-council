/**
 * ConversationModifierChips - Toggle chips for per-message LLM behavior tweaks
 *
 * Allows users to adjust the AI behavior for the current message:
 * - Creative: More varied, imaginative responses
 * - Cautious: More careful, precise responses
 * - Concise: Shorter, to-the-point answers
 * - Detailed: Longer, comprehensive answers
 *
 * Only one modifier can be active at a time. Clicking an active chip deselects it.
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';
import { CONVERSATION_MODIFIERS, type ConversationModifier } from '../../types/business';
import '../ui/Tooltip.css';
import './ConversationModifierChips.css';

interface ConversationModifierChipsProps {
  selectedModifier: ConversationModifier | null;
  onSelectModifier: (modifier: ConversationModifier | null) => void;
  disabled?: boolean;
}

export function ConversationModifierChips({
  selectedModifier,
  onSelectModifier,
  disabled = false,
}: ConversationModifierChipsProps) {
  const handleClick = (modifierId: ConversationModifier) => {
    // Toggle: clicking active chip deselects it
    if (selectedModifier === modifierId) {
      onSelectModifier(null);
    } else {
      onSelectModifier(modifierId);
    }
  };

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="modifier-chips" role="group" aria-label="Response style">
        {CONVERSATION_MODIFIERS.map((mod) => {
          const isSelected = selectedModifier === mod.id;
          return (
            <Tooltip.Root key={mod.id}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    'modifier-chip',
                    isSelected && 'active',
                    mod.id // for individual styling
                  )}
                  onClick={() => handleClick(mod.id)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                >
                  <span className="modifier-icon">{mod.icon}</span>
                  <span className="modifier-label">{mod.label}</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="tooltip-content" sideOffset={8}>
                  {mod.description}
                  <Tooltip.Arrow className="tooltip-arrow" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
