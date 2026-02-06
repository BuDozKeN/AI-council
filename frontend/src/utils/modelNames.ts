/**
 * Model Name Display Utility
 *
 * Maps technical model IDs (e.g., "anthropic/claude-opus-4.5") to
 * user-friendly display names (e.g., "Claude Opus 4.5").
 *
 * Used by Leaderboard and Analytics to show readable model names.
 */

// Mapping of full model IDs to display names
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Anthropic
  'anthropic/claude-opus-4.5': 'Claude Opus 4.5',
  'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
  'anthropic/claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'anthropic/claude-3-5-haiku-20241022': 'Claude Haiku 3.5',
  // OpenAI
  'openai/gpt-5.1': 'GPT-5.1',
  'openai/gpt-4o': 'GPT-4o',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  // Google
  'google/gemini-3-pro-preview': 'Gemini 3 Pro',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
  'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
  // xAI
  'x-ai/grok-4': 'Grok 4',
  'x-ai/grok-4-fast': 'Grok 4 Fast',
  // DeepSeek
  'deepseek/deepseek-chat-v3-0324': 'DeepSeek V3',
  // Moonshot
  'moonshotai/kimi-k2': 'Kimi K2',
  'moonshotai/kimi-k2.5': 'Kimi K2.5',
};

/**
 * Format a model ID into a user-friendly display name.
 *
 * @param model - The full model ID (e.g., "anthropic/claude-opus-4.5")
 * @returns User-friendly name (e.g., "Claude Opus 4.5")
 *
 * @example
 * formatModelName('anthropic/claude-opus-4.5') // "Claude Opus 4.5"
 * formatModelName('unknown/some-model')        // "Some Model"
 */
export function formatModelName(model: string): string {
  // Check for exact match first
  if (MODEL_DISPLAY_NAMES[model]) {
    return MODEL_DISPLAY_NAMES[model];
  }

  // Fallback: Extract the model name part and format it
  const parts = model.split('/');
  const name = parts[parts.length - 1] || model;

  // Convert "some-model-name" to "Some Model Name"
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
