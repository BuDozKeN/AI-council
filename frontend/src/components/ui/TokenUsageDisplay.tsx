/**
 * TokenUsageDisplay - Developer-only component showing token usage per session
 *
 * Only visible when "Show Token Usage" is enabled in Developer Settings.
 * Displays:
 * - Total tokens used
 * - Breakdown by stage (Stage 1, 2, 3)
 * - Per-model usage
 * - Cache hit rate and savings
 * - Estimated cost
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Zap, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { getShowTokenUsage } from '../settings/tokenUsageSettings';
import { formatCostAuto } from '../../lib/currencyUtils';
import { makeClickable } from '../../utils/a11y';
import './TokenUsageDisplay.css';

// Model pricing (per 1M tokens) - Official provider pricing as of Dec 2025
// Sources:
// - Anthropic: https://www.anthropic.com/pricing
// - OpenAI: https://openai.com/api/pricing/
// - Google: https://ai.google.dev/pricing
// - xAI: https://docs.x.ai/docs/models
// - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude models (official pricing)
  'anthropic/claude-opus-4.5': { input: 5, output: 25 },
  'anthropic/claude-opus-4': { input: 15, output: 75 },
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'anthropic/claude-3-5-haiku-20241022': { input: 1, output: 5 },

  // OpenAI models (official pricing)
  'openai/gpt-4o': { input: 5, output: 15 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-5.1': { input: 5, output: 20 }, // Estimate - not yet released

  // Google Gemini models (official pricing)
  'google/gemini-3-pro-preview': { input: 2, output: 12 }, // Estimate based on 2.5 Pro trajectory
  'google/gemini-2.5-pro-preview': { input: 1.25, output: 10 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'google/gemini-2.0-flash-001': { input: 0.1, output: 0.4 },

  // xAI Grok models (official pricing)
  'x-ai/grok-3': { input: 3, output: 15 },
  'x-ai/grok-4': { input: 3, output: 15 },

  // DeepSeek models (official pricing - V3.2-Exp unified pricing)
  'deepseek/deepseek-chat': { input: 0.28, output: 0.42 },
  'deepseek/deepseek-chat-v3-0324': { input: 0.28, output: 0.42 },

  // Fallback for unknown models
  default: { input: 2, output: 8 },
};

export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  by_model: Record<
    string,
    {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    }
  >;
}

interface TokenUsageDisplayProps {
  usage: UsageData | null;
  stage?: 'complete' | 'stage1' | 'stage2' | 'stage3';
  className?: string;
}

function getModelPricing(model: string): { input: number; output: number } {
  // Try exact match first
  const exactMatch = MODEL_PRICING[model];
  if (exactMatch) return exactMatch;

  // Try partial match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return pricing;
  }

  // Default fallback (always defined)
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

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function formatCost(cost: number): string {
  return formatCostAuto(cost);
}

function getModelShortName(model: string): string {
  const parts = model.split('/');
  const name = parts[parts.length - 1] ?? model;
  // Shorten common model names
  return name
    .replace('claude-opus-4.5', 'Opus 4.5')
    .replace('claude-sonnet-4', 'Sonnet 4')
    .replace('gpt-5.1', 'GPT-5.1')
    .replace('gemini-3-pro-preview', 'Gemini 3')
    .replace('gemini-2.5-flash', 'Flash 2.5')
    .replace('grok-4', 'Grok 4')
    .replace('deepseek-chat-v3-0324', 'DeepSeek');
}

export function TokenUsageDisplay({
  usage,
  stage = 'complete',
  className = '',
}: TokenUsageDisplayProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(getShowTokenUsage());
  const [isExpanded, setIsExpanded] = useState(false);

  // Listen for visibility changes from settings
  useEffect(() => {
    const handleVisibilityChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsVisible(customEvent.detail);
    };

    window.addEventListener('showTokenUsageChanged', handleVisibilityChange);
    return () => {
      window.removeEventListener('showTokenUsageChanged', handleVisibilityChange);
    };
  }, []);

  const stats = useMemo(() => {
    if (!usage) return null;

    const cost = calculateCost(usage);
    const cacheHitRate =
      usage.prompt_tokens > 0 ? (usage.cache_read_input_tokens / usage.prompt_tokens) * 100 : 0;

    // Estimate savings from cache (assuming cached tokens cost 10% of normal)
    const cacheSavings = (usage.cache_read_input_tokens / 1_000_000) * 2 * 0.9; // Rough estimate

    return {
      totalTokens: usage.total_tokens,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
      cacheCreationTokens: usage.cache_creation_input_tokens,
      cacheHitRate,
      cost,
      cacheSavings,
      modelCount: Object.keys(usage.by_model).length,
    };
  }, [usage]);

  // Don't render if not visible or no usage data
  if (!isVisible || !usage || !stats || stats.totalTokens === 0) {
    return null;
  }

  const stageLabel =
    stage === 'complete'
      ? t('usage.sessionTotal')
      : t('usage.stageLabel', { stage: stage.replace('stage', '') });

  return (
    <div className={`token-usage-display ${className}`}>
      <div className="token-usage-header" {...makeClickable(() => setIsExpanded(!isExpanded))}>
        <div className="token-usage-summary">
          <Activity size={14} className="token-usage-icon" />
          <span className="token-usage-label">{stageLabel}:</span>
          <span className="token-usage-total">
            {t('usage.tokensCount', { value: formatTokenCount(stats.totalTokens) })}
          </span>
          {stats.cacheHitRate > 0 && (
            <span className="token-usage-cache">
              <Zap size={12} />
              {t('usage.cachedPercent', { percent: stats.cacheHitRate.toFixed(0) })}
            </span>
          )}
          <span className="token-usage-cost">
            <DollarSign size={12} />
            {formatCost(stats.cost)}
          </span>
        </div>
        <button className="token-usage-expand">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className="token-usage-details">
          <div className="token-usage-breakdown">
            <div className="token-usage-row">
              <span className="token-usage-row-label">{t('usage.inputTokens')}</span>
              <span className="token-usage-row-value">{formatTokenCount(stats.promptTokens)}</span>
            </div>
            <div className="token-usage-row">
              <span className="token-usage-row-label">{t('usage.outputTokens')}</span>
              <span className="token-usage-row-value">
                {formatTokenCount(stats.completionTokens)}
              </span>
            </div>
            {stats.cacheReadTokens > 0 && (
              <div className="token-usage-row cache">
                <span className="token-usage-row-label">
                  <Zap size={12} /> {t('usage.cacheRead')}
                </span>
                <span className="token-usage-row-value">
                  {formatTokenCount(stats.cacheReadTokens)}
                </span>
              </div>
            )}
            {stats.cacheCreationTokens > 0 && (
              <div className="token-usage-row">
                <span className="token-usage-row-label">{t('usage.cacheCreated')}</span>
                <span className="token-usage-row-value">
                  {formatTokenCount(stats.cacheCreationTokens)}
                </span>
              </div>
            )}
          </div>

          {Object.keys(usage.by_model).length > 0 && (
            <div className="token-usage-models">
              <div className="token-usage-models-header">{t('usage.perModel')}</div>
              {Object.entries(usage.by_model).map(([model, modelUsage]) => (
                <div key={model} className="token-usage-model-row">
                  <span className="token-usage-model-name">{getModelShortName(model)}</span>
                  <span className="token-usage-model-tokens">
                    {formatTokenCount(modelUsage.prompt_tokens)} /{' '}
                    {formatTokenCount(modelUsage.completion_tokens)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {stats.cacheSavings > 0 && (
            <div className="token-usage-savings">
              {t('usage.cacheSavings', { amount: formatCost(stats.cacheSavings) })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TokenUsageDisplay;
