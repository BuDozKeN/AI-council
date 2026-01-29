/**
 * SessionCostSummary - Shows cumulative LLM costs for the entire session
 *
 * Displays:
 * - Total session cost (all council queries + follow-ups)
 * - Number of council queries
 * - Number of follow-ups
 * - Cost breakdown by type
 *
 * Only visible when "Show Token Usage" is enabled (auto-enabled for super admins).
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, MessageSquare, Sparkles } from 'lucide-react';
import { useShowTokenUsage } from '../../hooks/useShowTokenUsage';
import { formatCostAuto } from '../../lib/currencyUtils';
import type { UsageData } from '../../types/conversation';
import './SessionCostSummary.css';

// Model pricing (per 1M tokens) - Same as TokenUsageDisplay
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4.5': { input: 5, output: 25 },
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-3-5-haiku-20241022': { input: 1, output: 5 },
  'openai/gpt-4o': { input: 5, output: 15 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-5.1': { input: 1.25, output: 10 },
  'google/gemini-3-pro-preview': { input: 2, output: 12 },
  'google/gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'x-ai/grok-4': { input: 3, output: 15 },
  'x-ai/grok-4-fast': { input: 0.2, output: 0.5 },
  'deepseek/deepseek-chat-v3-0324': { input: 0.28, output: 0.42 },
  'meta-llama/llama-4-maverick': { input: 0.15, output: 0.6 },
  'moonshotai/kimi-k2': { input: 0.456, output: 1.84 },
  'moonshotai/kimi-k2.5': { input: 0.57, output: 2.85 },
  default: { input: 2, output: 8 },
};

function getModelPricing(model: string): { input: number; output: number } {
  const exact = MODEL_PRICING[model];
  if (exact) return exact;
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (key !== 'default' && (model.includes(key) || key.includes(model))) return pricing;
  }
  return { input: 2, output: 8 };
}

function calculateCost(usage: UsageData): number {
  let totalCost = 0;
  for (const [model, modelUsage] of Object.entries(usage.by_model)) {
    const pricing = getModelPricing(model);
    const inputCost = (modelUsage.prompt_tokens / 1_000_000) * pricing.input;
    const outputCost = (modelUsage.completion_tokens / 1_000_000) * pricing.output;
    totalCost += inputCost + outputCost;
  }
  return totalCost;
}

interface MessageWithUsage {
  role: 'user' | 'assistant';
  usage?: UsageData;
  isChat?: boolean;
  loading?: { stage1?: boolean; stage2?: boolean; stage3?: boolean };
}

interface SessionCostSummaryProps {
  messages: MessageWithUsage[];
  className?: string;
}

export function SessionCostSummary({ messages, className = '' }: SessionCostSummaryProps) {
  const { t } = useTranslation();
  const { showTokenUsage: isVisible } = useShowTokenUsage();

  const stats = useMemo(() => {
    // Only count completed assistant messages with usage data
    const assistantMessages = messages.filter(
      (m) => m.role === 'assistant' && m.usage && !m.loading?.stage3
    );

    if (assistantMessages.length === 0) return null;

    let totalCost = 0;
    let councilCount = 0;
    let followUpCount = 0;
    let councilCost = 0;
    let followUpCost = 0;

    for (const msg of assistantMessages) {
      if (!msg.usage) continue;

      const cost = calculateCost(msg.usage);
      totalCost += cost;

      if (msg.isChat) {
        followUpCount++;
        followUpCost += cost;
      } else {
        councilCount++;
        councilCost += cost;
      }
    }

    return {
      totalCost,
      councilCount,
      followUpCount,
      councilCost,
      followUpCost,
      messageCount: assistantMessages.length,
    };
  }, [messages]);

  // Don't show if not visible or no stats
  if (!isVisible || !stats || stats.messageCount === 0) {
    return null;
  }

  // Only show if there's more than one interaction (otherwise per-message display is enough)
  if (stats.messageCount < 2) {
    return null;
  }

  return (
    <div className={`session-cost-summary ${className}`}>
      <div className="session-cost-header">
        <DollarSign size={14} className="session-cost-icon" />
        <span className="session-cost-title">{t('usage.sessionTotal', 'Session Total')}</span>
        <span className="session-cost-value">{formatCostAuto(stats.totalCost)}</span>
      </div>

      <div className="session-cost-breakdown">
        {stats.councilCount > 0 && (
          <div className="session-cost-item">
            <Sparkles size={12} />
            <span className="session-cost-item-label">
              {stats.councilCount} council {stats.councilCount === 1 ? 'query' : 'queries'}
            </span>
            <span className="session-cost-item-value">{formatCostAuto(stats.councilCost)}</span>
          </div>
        )}
        {stats.followUpCount > 0 && (
          <div className="session-cost-item">
            <MessageSquare size={12} />
            <span className="session-cost-item-label">
              {stats.followUpCount} follow-{stats.followUpCount === 1 ? 'up' : 'ups'}
            </span>
            <span className="session-cost-item-value">{formatCostAuto(stats.followUpCost)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionCostSummary;
