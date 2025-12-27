/**
 * QuickActionChips - Action-oriented quick prompts
 *
 * Jobs-to-be-done approach: users think in tasks, not org charts.
 */

import { motion } from 'framer-motion';
import { PenLine, FileSearch, Rocket, Scale, Users, TrendingUp } from 'lucide-react';
import { springs, interactionStates, staggerDelay } from '../../lib/animations';
import './QuickActionChips.css';

const QUICK_ACTIONS = [
  {
    icon: PenLine,
    label: 'Write a pitch',
    prompt: 'Help me write a compelling pitch for ',
  },
  {
    icon: FileSearch,
    label: 'Review a document',
    prompt: 'Please review this document and identify any issues: ',
  },
  {
    icon: Rocket,
    label: 'Plan a launch',
    prompt: 'Help me plan the launch strategy for ',
  },
  {
    icon: Scale,
    label: 'Analyze a decision',
    prompt: 'I need to make a decision about ',
  },
  {
    icon: Users,
    label: 'Handle a situation',
    prompt: 'Help me handle this situation: ',
  },
  {
    icon: TrendingUp,
    label: 'Improve metrics',
    prompt: 'How can I improve ',
  },
];

interface QuickActionChipsProps {
  onSelect?: ((prompt: string) => void) | undefined;
}

export function QuickActionChips({ onSelect }: QuickActionChipsProps) {
  return (
    <div className="quick-action-chips">
      {QUICK_ACTIONS.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.label}
            className="quick-action-chip"
            onClick={() => onSelect?.(action.prompt)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.smooth, delay: staggerDelay(index, 0.06) }}
            whileHover={interactionStates.cardHover}
            whileTap={interactionStates.chipTap}
          >
            <Icon size={14} className="quick-action-icon" />
            <span>{action.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default QuickActionChips;
