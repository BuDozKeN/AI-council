import { memo, useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { CopyButton } from '../ui/CopyButton';
import { CheckCircle2 } from 'lucide-react';
import { hapticSuccess } from '../../lib/haptics';
import { CELEBRATION } from '../../lib/animation-constants';
import { celebrateCouncilComplete } from '../../lib/celebrate';
import { formatCostAuto } from '../../lib/currencyUtils';
import type { Stage3ContentProps, CodeBlockProps } from '../../types/stages';
import type { UsageData } from '../../types/conversation';
// Import shared prose styling for consistent rendering with playbooks/SOPs
import '../MarkdownViewer.css';

// Model pricing (per 1M tokens) - display estimates only.
// Backend fetches live pricing from OpenRouter; these are fallback values for the UI.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'anthropic/claude-opus-4.5': { input: 5, output: 25 },
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 }, // Fixed: was 1/5
  // OpenAI
  'openai/gpt-4o': { input: 5, output: 15 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-5.1': { input: 1.25, output: 10 }, // Fixed: was 5/20
  // Google
  'google/gemini-3-pro-preview': { input: 2, output: 12 },
  'google/gemini-2.5-flash': { input: 0.3, output: 2.5 }, // Fixed: was 0.075/0.30
  // xAI
  'x-ai/grok-4': { input: 3, output: 15 },
  'x-ai/grok-4-fast': { input: 0.2, output: 0.5 },
  // DeepSeek
  'deepseek/deepseek-chat-v3-0324': { input: 0.28, output: 0.42 },
  // Meta (Llama) - Stage 2 reviewer
  'meta-llama/llama-4-maverick': { input: 0.15, output: 0.6 },
  // Moonshot (Kimi)
  'moonshotai/kimi-k2': { input: 0.456, output: 1.84 }, // Stage 2 reviewer
  'moonshotai/kimi-k2.5': { input: 0.57, output: 2.85 }, // Stage 1 analyst
  default: { input: 2, output: 8 },
};

function getModelPricing(model: string): { input: number; output: number } {
  const exact = MODEL_PRICING[model];
  if (exact) return exact;
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (key !== 'default' && (model.includes(key) || key.includes(model))) return pricing;
  }
  return { input: 2, output: 8 }; // Default fallback
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

function formatCost(cost: number): string {
  return formatCostAuto(cost);
}

// Custom code block renderer with hover-reveal copy button
function CodeBlock({ children, className }: CodeBlockProps) {
  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  const isActualCodeBlock = language || code.includes('\n') || code.length > 60;

  if (!isActualCodeBlock) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block-wrapper copyable">
      {language && <span className="code-language">{language}</span>}
      <CopyButton text={code} size="sm" />
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * Stage3Content - Renders the markdown content and header row
 *
 * Note: Uses custom celebration logic instead of useCelebration hook
 * because it has a multi-stage animation (cursor fade -> celebration).
 */
function Stage3Content({
  displayText,
  hasError,
  wasTruncated,
  isStreaming,
  isComplete,
  chairmanIconPath,
  usage,
}: Stage3ContentProps) {
  const { t } = useTranslation();

  // Calculate cost from usage data
  const costDisplay = useMemo(() => {
    if (!usage || !isComplete) return null;
    const cost = calculateCost(usage);
    return formatCost(cost);
  }, [usage, isComplete]);

  // Track completion celebration
  const [showCompleteCelebration, setShowCompleteCelebration] = useState(false);
  const [cursorFading, setCursorFading] = useState(false);
  const wasStreamingRef = useRef(false);
  const hasCelebratedRef = useRef(false);

  // Trigger celebration when streaming completes (only once per session)
  // Multi-stage: cursor fades out first, then celebration triggers
  useEffect(() => {
    if (
      wasStreamingRef.current &&
      !isStreaming &&
      isComplete &&
      displayText &&
      !hasCelebratedRef.current
    ) {
      hasCelebratedRef.current = true;

      // Use requestAnimationFrame to batch state updates outside effect sync phase
      const frameId = requestAnimationFrame(() => {
        // Fade out cursor first
        setCursorFading(true);
      });

      // Then trigger celebration after cursor fades
      const celebrationTimer = setTimeout(() => {
        setShowCompleteCelebration(true);
        hapticSuccess();
        celebrateCouncilComplete(); // 🎉 Confetti celebration!
      }, CELEBRATION.CURSOR_FADE);

      // Reset celebration after animation
      const resetTimer = setTimeout(() => {
        setShowCompleteCelebration(false);
      }, CELEBRATION.COUNCIL_COMPLETE);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(celebrationTimer);
        clearTimeout(resetTimer);
      };
    }
    wasStreamingRef.current = isStreaming;
    return undefined;
  }, [isStreaming, isComplete, displayText]);

  return (
    <>
      {/* Header row: Chairman LLM icon + status + cost badge */}
      <div className="stage3-header-row">
        <div className={`chairman-indicator ${showCompleteCelebration ? 'celebrating' : ''}`}>
          {chairmanIconPath && (
            <img
              src={chairmanIconPath}
              alt=""
              className="chairman-icon"
              loading="lazy"
              decoding="async"
            />
          )}
          {isStreaming && <span className="typing-indicator">●</span>}
          {isComplete && (
            <CheckCircle2
              className={`h-4 w-4 text-green-600 ${showCompleteCelebration ? 'animate-success-pop' : ''}`}
            />
          )}
          {hasError && <span className="error-badge">{t('common.error')}</span>}
        </div>
        {costDisplay && (
          <span className="stage3-cost-badge" title={t('stages.costTooltip')}>
            {costDisplay}
          </span>
        )}
      </div>

      {/* Truncation warning - response was cut off */}
      {wasTruncated && (
        <div className="truncation-warning">
          <span className="truncation-warning-text">{t('stages.responseTruncated')}</span>
        </div>
      )}

      {/* Content wrapper */}
      <div className={`final-content-wrapper ${showCompleteCelebration ? 'complete-glow' : ''}`}>
        <div className={`final-text ${hasError ? 'error-text' : ''}`}>
          {hasError ? (
            <p className="empty-message">{displayText || t('stages.synthesisError')}</p>
          ) : (
            <>
              <article className="prose prose-slate max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSlug]}
                  components={{
                    pre({ children: _children, node }) {
                      const codeElement = node?.children?.[0] as
                        | { properties?: { className?: string[] }; children?: { value?: string }[] }
                        | undefined;
                      const className = codeElement?.properties?.className?.[0] || '';
                      const codeContent = codeElement?.children?.[0]?.value || '';
                      return <CodeBlock className={className}>{codeContent}</CodeBlock>;
                    },
                    code({ className, children, ...props }) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    table({ children, ...props }) {
                      return (
                        <div className="table-scroll-wrapper">
                          <table {...props}>{children}</table>
                        </div>
                      );
                    },
                  }}
                >
                  {displayText}
                </ReactMarkdown>
              </article>
              {isStreaming && (
                <span className={`cursor ${cursorFading ? 'animate-cursor-fade' : ''}`}>▊</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI Disclaimer - subtle note after complete responses */}
      {isComplete && !hasError && (
        <p className="ai-disclaimer" title={t('stages.aiDisclaimerFull')}>
          {t('stages.aiDisclaimer')}
        </p>
      )}
    </>
  );
}

export default memo(Stage3Content);
