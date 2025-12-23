/**
 * Model Personas Configuration
 *
 * Centralized metadata for AI models including colors and display names.
 * Used throughout the deliberation view for consistent branding.
 */

// Provider colors for consistent branding
// Only includes providers we actually use in the council
export const PROVIDER_COLORS = {
  openai: '#10a37f',      // Green
  anthropic: '#d97706',   // Orange/amber
  google: '#4285f4',      // Blue
  xai: '#1da1f2',         // Twitter blue
  deepseek: '#6366f1',    // Indigo
  council: '#10b981',     // Emerald (chairman)
  unknown: '#6b7280'      // Gray (fallback)
};

// Provider labels for collapsed summary pills
export const PROVIDER_LABELS = {
  openai: 'GPT',
  anthropic: 'Claude',
  google: 'Gemini',
  xai: 'Grok',
  deepseek: 'DeepSeek',
  council: 'Council',
  unknown: 'AI'
};

export const MODEL_PERSONAS = {
  // OpenAI Models
  'gpt-4': {
    color: PROVIDER_COLORS.openai,
    shortName: 'GPT-4',
    fullName: 'GPT-4',
    tagline: 'Reasoning Expert',
    provider: 'openai'
  },
  'gpt-4-turbo': {
    color: PROVIDER_COLORS.openai,
    shortName: 'GPT-4T',
    fullName: 'GPT-4 Turbo',
    tagline: 'Speed & Power',
    provider: 'openai'
  },
  'gpt-4o': {
    color: PROVIDER_COLORS.openai,
    shortName: 'GPT-4o',
    fullName: 'GPT-4 Omni',
    tagline: 'Multimodal Master',
    provider: 'openai'
  },
  'gpt-4o-mini': {
    color: PROVIDER_COLORS.openai,
    shortName: 'GPT-4o Mini',
    fullName: 'GPT-4o Mini',
    tagline: 'Quick Thinker',
    provider: 'openai'
  },
  'o1': {
    color: PROVIDER_COLORS.openai,
    shortName: 'o1',
    fullName: 'OpenAI o1',
    tagline: 'Deep Reasoner',
    provider: 'openai'
  },
  'o1-mini': {
    color: PROVIDER_COLORS.openai,
    shortName: 'o1-mini',
    fullName: 'OpenAI o1 Mini',
    tagline: 'Fast Reasoner',
    provider: 'openai'
  },

  // Anthropic Models
  'claude-3-opus': {
    color: PROVIDER_COLORS.anthropic,
    shortName: 'Opus',
    fullName: 'Claude 3 Opus',
    tagline: 'Creative Powerhouse',
    provider: 'anthropic'
  },
  'claude-3-sonnet': {
    color: PROVIDER_COLORS.anthropic,
    shortName: 'Sonnet',
    fullName: 'Claude 3 Sonnet',
    tagline: 'Balanced Expert',
    provider: 'anthropic'
  },
  'claude-3-haiku': {
    color: PROVIDER_COLORS.anthropic,
    shortName: 'Haiku',
    fullName: 'Claude 3 Haiku',
    tagline: 'Swift & Precise',
    provider: 'anthropic'
  },
  'claude-3.5-sonnet': {
    color: PROVIDER_COLORS.anthropic,
    shortName: 'Sonnet 3.5',
    fullName: 'Claude 3.5 Sonnet',
    tagline: 'Next-Gen Balance',
    provider: 'anthropic'
  },
  'claude-sonnet-4': {
    color: PROVIDER_COLORS.anthropic,
    shortName: 'Sonnet 4',
    fullName: 'Claude Sonnet 4',
    tagline: 'Latest Generation',
    provider: 'anthropic'
  },
  'claude-opus-4.5': {
    color: PROVIDER_COLORS.anthropic,
    shortName: 'Opus 4.5',
    fullName: 'Claude Opus 4.5',
    tagline: 'Most Capable',
    provider: 'anthropic'
  },

  // Google Models
  'gemini-pro': {
    color: PROVIDER_COLORS.google,
    shortName: 'Gemini',
    fullName: 'Gemini Pro',
    tagline: 'Versatile Mind',
    provider: 'google'
  },
  'gemini-1.5-pro': {
    color: PROVIDER_COLORS.google,
    shortName: 'Gemini 1.5',
    fullName: 'Gemini 1.5 Pro',
    tagline: 'Long Context King',
    provider: 'google'
  },
  'gemini-2.0-flash': {
    color: PROVIDER_COLORS.google,
    shortName: 'Gemini 2',
    fullName: 'Gemini 2.0 Flash',
    tagline: 'Speed Champion',
    provider: 'google'
  },
  'gemini-2.5-pro': {
    color: PROVIDER_COLORS.google,
    shortName: 'Gemini 2.5',
    fullName: 'Gemini 2.5 Pro',
    tagline: 'Advanced Reasoning',
    provider: 'google'
  },
  'gemini-2.5-flash': {
    color: PROVIDER_COLORS.google,
    shortName: 'Gemini 2.5',
    fullName: 'Gemini 2.5 Flash',
    tagline: 'Fast & Smart',
    provider: 'google'
  },
  'gemini-3-pro-preview': {
    color: PROVIDER_COLORS.google,
    shortName: 'Gemini 3',
    fullName: 'Gemini 3 Pro Preview',
    tagline: 'Next Generation',
    provider: 'google'
  },

  // xAI Models
  'grok-2': {
    color: PROVIDER_COLORS.xai,
    shortName: 'Grok',
    fullName: 'Grok 2',
    tagline: 'Bold Innovator',
    provider: 'xai'
  },
  'grok-4': {
    color: PROVIDER_COLORS.xai,
    shortName: 'Grok',
    fullName: 'Grok 4',
    tagline: 'Bold Innovator',
    provider: 'xai'
  },

  // DeepSeek Models
  'deepseek-chat': {
    color: PROVIDER_COLORS.deepseek,
    shortName: 'DeepSeek',
    fullName: 'DeepSeek Chat',
    tagline: 'Deep Diver',
    provider: 'deepseek'
  },
  'deepseek-r1': {
    color: PROVIDER_COLORS.deepseek,
    shortName: 'DeepSeek R1',
    fullName: 'DeepSeek R1',
    tagline: 'Research Pioneer',
    provider: 'deepseek'
  },

  // Chairman (synthesis)
  'chairman': {
    color: PROVIDER_COLORS.council,
    shortName: 'Chairman',
    fullName: 'Council Chairman',
    tagline: 'Final Synthesizer',
    provider: 'council'
  }
};

// Default persona for unknown models
const DEFAULT_PERSONA = {
  color: PROVIDER_COLORS.unknown,
  shortName: 'AI',
  fullName: 'AI Model',
  tagline: 'Council Member',
  provider: 'unknown'
};

/**
 * Get persona configuration for a model
 * @param {string} modelId - The model identifier
 * @returns {Object} Persona configuration with providerLabel
 */
export function getModelPersona(modelId) {
  if (!modelId) return { ...DEFAULT_PERSONA, providerLabel: PROVIDER_LABELS[DEFAULT_PERSONA.provider] };

  // Try exact match first
  if (MODEL_PERSONAS[modelId]) {
    const persona = MODEL_PERSONAS[modelId];
    return { ...persona, providerLabel: PROVIDER_LABELS[persona.provider] || persona.provider.toUpperCase() };
  }

  // Extract model name from provider/model format (e.g., 'x-ai/grok-4' → 'grok-4')
  const modelName = modelId.includes('/') ? modelId.split('/')[1] : modelId;
  const lowerModelName = modelName.toLowerCase();

  // Try exact match on model name part
  if (MODEL_PERSONAS[modelName]) {
    const persona = MODEL_PERSONAS[modelName];
    return { ...persona, providerLabel: PROVIDER_LABELS[persona.provider] || persona.provider.toUpperCase() };
  }

  // Try partial match (e.g., 'gpt-4-turbo-preview' → 'gpt-4-turbo')
  for (const [key, persona] of Object.entries(MODEL_PERSONAS)) {
    if (lowerModelName.includes(key.toLowerCase())) {
      return { ...persona, providerLabel: PROVIDER_LABELS[persona.provider] || persona.provider.toUpperCase() };
    }
  }

  // Return default with dynamic name
  return {
    ...DEFAULT_PERSONA,
    shortName: modelName.split('-')[0].toUpperCase(),
    fullName: modelId,
    providerLabel: PROVIDER_LABELS[DEFAULT_PERSONA.provider]
  };
}

/**
 * Get color for a model
 * @param {string} modelId - The model identifier
 * @returns {string} Hex color code
 */
export function getModelColor(modelId) {
  return getModelPersona(modelId).color;
}

/**
 * Get first letter/initials for avatar display
 * @param {string} modelId - The model identifier
 * @returns {string} 1-2 character initials
 */
export function getModelInitials(modelId) {
  const persona = getModelPersona(modelId);
  const name = persona.shortName;

  // Extract meaningful initials
  if (name.startsWith('GPT')) return 'G';
  if (name.startsWith('o1')) return 'O';
  if (name.includes('Opus')) return 'OP';
  if (name.includes('Sonnet')) return 'S';
  if (name.includes('Haiku')) return 'H';
  if (name.includes('Gemini')) return 'Ge';
  if (name.includes('Grok')) return 'Gr';
  if (name.includes('DeepSeek')) return 'D';
  if (name === 'Chairman') return 'C';

  // Default: first letter
  return name.charAt(0).toUpperCase();
}

/**
 * Get all personas for a specific provider
 * @param {string} provider - Provider name (openai, anthropic, google, etc.)
 * @returns {Object} Map of model IDs to personas
 */
export function getPersonasByProvider(provider) {
  return Object.entries(MODEL_PERSONAS)
    .filter(([, persona]) => persona.provider === provider)
    .reduce((acc, [id, persona]) => {
      acc[id] = persona;
      return acc;
    }, {});
}
