/**
 * QuickActionChips - Action-oriented quick prompts
 *
 * Jobs-to-be-done approach: users think in tasks, not org charts.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PenLine, FileSearch, Rocket, Scale, Users, TrendingUp, LucideIcon } from 'lucide-react';
import { springs, interactionStates, staggerDelay } from '../../lib/animations';
import './QuickActionChips.css';

interface QuickAction {
  icon: LucideIcon;
  labelKey: string;
  promptKey: string;
}

const QUICK_ACTION_KEYS = [
  {
    icon: PenLine,
    labelKey: 'landing.quickActions.writePitch' as const,
    promptKey: 'landing.quickActions.writePitchPrompt' as const,
  },
  {
    icon: FileSearch,
    labelKey: 'landing.quickActions.reviewDocument' as const,
    promptKey: 'landing.quickActions.reviewDocumentPrompt' as const,
  },
  {
    icon: Rocket,
    labelKey: 'landing.quickActions.planLaunch' as const,
    promptKey: 'landing.quickActions.planLaunchPrompt' as const,
  },
  {
    icon: Scale,
    labelKey: 'landing.quickActions.analyzeDecision' as const,
    promptKey: 'landing.quickActions.analyzeDecisionPrompt' as const,
  },
  {
    icon: Users,
    labelKey: 'landing.quickActions.handleSituation' as const,
    promptKey: 'landing.quickActions.handleSituationPrompt' as const,
  },
  {
    icon: TrendingUp,
    labelKey: 'landing.quickActions.improveMetrics' as const,
    promptKey: 'landing.quickActions.improveMetricsPrompt' as const,
  },
] satisfies QuickAction[];

interface QuickActionChipsProps {
  onSelect?: ((prompt: string) => void) | undefined;
}

export function QuickActionChips({ onSelect }: QuickActionChipsProps) {
  const { t } = useTranslation();

  // Build translated actions
  const actions = useMemo(
    () =>
      QUICK_ACTION_KEYS.map((action) => ({
        icon: action.icon,
        label: t(action.labelKey),
        prompt: t(action.promptKey),
      })),
    [t]
  );

  return (
    <div className="quick-action-chips">
      {actions.map((action, index) => {
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
