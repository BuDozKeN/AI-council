/**
 * Model Personas Configuration
 *
 * Centralized metadata for AI models including colors and display names.
 * Used throughout the deliberation view for consistent branding.
 */

type Provider = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'meta' | 'moonshot' | 'council' | 'unknown';

interface ModelPersona {
  color: string;
  shortName: string;
  fullName: string;
  tagline: string;
  provider: Provider;
}

interface ModelPersonaWithLabel extends ModelPersona {
  providerLabel: string;
}

// Provider colors for consistent branding
// Only includes providers we actually use in the council
export const PROVIDER_COLORS: Record<Provider, string> = {
  openai: '#10a37f',      // Green
  anthropic: '#d97706',   // Orange/amber
  google: '#4285f4',      // Blue
  xai: '#1da1f2',         // Twitter blue
  deepseek: '#6366f1',    // Indigo
  meta: '#0668E1',        // Meta blue
  moonshot: '#6B4EE6',    // Moonshot purple
  council: '#10b981',     // Emerald (chairman)
  unknown: '#6b7280'      // Gray (fallback)
};

// Provider labels for collapsed summary pills
export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  google: 'Gemini',
  xai: 'Grok',
  deepseek: 'DeepSeek',
  meta: 'Llama',
  moonshot: 'Kimi',
  council: 'Council',
  unknown: 'AI'
};

export const MODEL_PERSONAS: Record<string, ModelPersona> = {
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
  'grok-4-fast': {
    color: PROVIDER_COLORS.xai,
    shortName: 'Grok Fast',
    fullName: 'Grok 4 Fast',
    tagline: 'Speed Optimized',
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

  // Meta (Llama) Models
  'llama-4-maverick': {
    color: PROVIDER_COLORS.meta,
    shortName: 'Llama 4',
    fullName: 'Llama 4 Maverick',
    tagline: 'Open Source Leader',
    provider: 'meta'
  },

  // Moonshot (Kimi) Models
  'kimi-k2': {
    color: PROVIDER_COLORS.moonshot,
    shortName: 'Kimi K2',
    fullName: 'Kimi K2',
    tagline: 'Chinese AI Pioneer',
    provider: 'moonshot'
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
const DEFAULT_PERSONA: ModelPersona = {
  color: PROVIDER_COLORS.unknown,
  shortName: 'AI',
  fullName: 'AI Model',
  tagline: 'Council Member',
  provider: 'unknown'
};

/**
 * Get persona configuration for a model
 */
export function getModelPersona(modelId: string | null | undefined): ModelPersonaWithLabel {
  if (!modelId) return { ...DEFAULT_PERSONA, providerLabel: PROVIDER_LABELS[DEFAULT_PERSONA.provider] };

  // Try exact match first
  if (MODEL_PERSONAS[modelId]) {
    const persona = MODEL_PERSONAS[modelId];
    return { ...persona, providerLabel: PROVIDER_LABELS[persona.provider] ?? persona.provider.toUpperCase() };
  }

  // Extract model name from provider/model format (e.g., 'x-ai/grok-4' → 'grok-4')
  const modelName = modelId.includes('/') ? modelId.split('/')[1] ?? modelId : modelId;
  const lowerModelName = modelName.toLowerCase();

  // Try exact match on model name part
  if (MODEL_PERSONAS[modelName]) {
    const persona = MODEL_PERSONAS[modelName];
    return { ...persona, providerLabel: PROVIDER_LABELS[persona.provider] ?? persona.provider.toUpperCase() };
  }

  // Try partial match (e.g., 'gpt-4-turbo-preview' → 'gpt-4-turbo')
  for (const [key, persona] of Object.entries(MODEL_PERSONAS)) {
    if (lowerModelName.includes(key.toLowerCase())) {
      return { ...persona, providerLabel: PROVIDER_LABELS[persona.provider] ?? persona.provider.toUpperCase() };
    }
  }

  // Detect provider from model ID for unknown models
  const lowerModelId = modelId.toLowerCase();
  let detectedProvider: Provider = 'unknown';
  if (lowerModelId.includes('openai') || lowerModelId.includes('gpt') || lowerModelId.includes('o1')) {
    detectedProvider = 'openai';
  } else if (lowerModelId.includes('anthropic') || lowerModelId.includes('claude')) {
    detectedProvider = 'anthropic';
  } else if (lowerModelId.includes('google') || lowerModelId.includes('gemini')) {
    detectedProvider = 'google';
  } else if (lowerModelId.includes('x-ai') || lowerModelId.includes('grok')) {
    detectedProvider = 'xai';
  } else if (lowerModelId.includes('deepseek')) {
    detectedProvider = 'deepseek';
  } else if (lowerModelId.includes('meta') || lowerModelId.includes('llama')) {
    detectedProvider = 'meta';
  } else if (lowerModelId.includes('moonshot') || lowerModelId.includes('kimi')) {
    detectedProvider = 'moonshot';
  }

  // Return default with dynamic name and detected provider
  return {
    ...DEFAULT_PERSONA,
    shortName: (modelName.split('-')[0] ?? modelName).toUpperCase(),
    fullName: modelId,
    provider: detectedProvider,
    color: PROVIDER_COLORS[detectedProvider],
    providerLabel: PROVIDER_LABELS[detectedProvider]
  };
}

/**
 * Get color for a model
 */
export function getModelColor(modelId: string | null | undefined): string {
  return getModelPersona(modelId).color;
}

/**
 * Get first letter/initials for avatar display
 */
export function getModelInitials(modelId: string | null | undefined): string {
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
  if (name.includes('Llama')) return 'L';
  if (name.includes('Kimi')) return 'K';
  if (name === 'Chairman') return 'C';

  // Default: first letter
  return name.charAt(0).toUpperCase();
}

/**
 * Get all personas for a specific provider
 */
export function getPersonasByProvider(provider: Provider): Record<string, ModelPersona> {
  return Object.entries(MODEL_PERSONAS)
    .filter(([, persona]) => persona.provider === provider)
    .reduce((acc: Record<string, ModelPersona>, [id, persona]) => {
      acc[id] = persona;
      return acc;
    }, {});
}
