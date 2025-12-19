/**
 * QuickActionChips - Action-oriented quick prompts
 *
 * Jobs-to-be-done approach: users think in tasks, not org charts.
 */

import { motion } from 'framer-motion';
import { PenLine, FileSearch, Rocket, Scale, Users, TrendingUp } from 'lucide-react';
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

export function QuickActionChips({ onSelect }) {
  return (
    <div className="quick-action-chips">
      {QUICK_ACTIONS.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.label}
            className="quick-action-chip"
            onClick={() => onSelect?.(action.prompt)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index, duration: 0.2 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
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
