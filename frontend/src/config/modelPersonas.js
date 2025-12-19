/**
 * Model Persona Configuration
 *
 * Centralized configuration for all AI model personalities and branding.
 * This file defines visual identity, icons, and metadata for each model.
 *
 * Usage:
 *   import { getModelPersona } from '@/config/modelPersonas';
 *   const persona = getModelPersona('openai/gpt-4o');
 */

export const MODEL_PERSONAS = {
  // OpenAI Models
  'openai/gpt-4o': {
    icon: '🧠',
    name: 'GPT-4o',
    shortName: 'GPT-4o',
    tagline: 'Deep Thinker',
    description: 'Advanced reasoning and analysis',
    cssVar: '--model-gpt4o-color',
    vendor: 'OpenAI'
  },
  'openai/gpt-4o-mini': {
    icon: '⚡',
    name: 'GPT-4o Mini',
    shortName: 'GPT-4o Mini',
    tagline: 'Quick Response',
    description: 'Fast and efficient',
    cssVar: '--model-gpt4o-color',
    vendor: 'OpenAI'
  },
  'openai/o1': {
    icon: '🔬',
    name: 'OpenAI o1',
    shortName: 'o1',
    tagline: 'Reasoning Expert',
    description: 'Extended reasoning capabilities',
    cssVar: '--model-gpt4o-color',
    vendor: 'OpenAI'
  },
  'openai/o1-mini': {
    icon: '💡',
    name: 'OpenAI o1-mini',
    shortName: 'o1-mini',
    tagline: 'Smart Reasoner',
    description: 'Compact reasoning model',
    cssVar: '--model-gpt4o-color',
    vendor: 'OpenAI'
  },

  // Anthropic Models
  'anthropic/claude-sonnet-4-5': {
    icon: '🎭',
    name: 'Claude Sonnet 4.5',
    shortName: 'Claude 4.5',
    tagline: 'Balanced Expert',
    description: 'Balanced performance and insight',
    cssVar: '--model-claude-color',
    vendor: 'Anthropic'
  },
  'anthropic/claude-sonnet-4': {
    icon: '🎨',
    name: 'Claude Sonnet 4',
    shortName: 'Claude 4',
    tagline: 'Creative Analyst',
    description: 'Creative problem solving',
    cssVar: '--model-claude-color',
    vendor: 'Anthropic'
  },
  'anthropic/claude-opus-4': {
    icon: '👑',
    name: 'Claude Opus 4',
    shortName: 'Opus 4',
    tagline: 'Premium Advisor',
    description: 'Most capable Claude model',
    cssVar: '--model-claude-color',
    vendor: 'Anthropic'
  },

  // Google Models
  'google/gemini-3-pro-preview': {
    icon: '💎',
    name: 'Gemini 3 Pro',
    shortName: 'Gemini 3',
    tagline: 'Multimodal Pro',
    description: 'Advanced multimodal reasoning',
    cssVar: '--model-gemini-color',
    vendor: 'Google'
  },
  'google/gemini-2-flash-thinking': {
    icon: '⚡',
    name: 'Gemini 2 Flash',
    shortName: 'Flash 2',
    tagline: 'Rapid Thinker',
    description: 'Fast reasoning capabilities',
    cssVar: '--model-gemini-color',
    vendor: 'Google'
  },
  'google/gemini-2-pro': {
    icon: '🌟',
    name: 'Gemini 2 Pro',
    shortName: 'Gemini 2',
    tagline: 'Pro Analyst',
    description: 'Professional-grade insights',
    cssVar: '--model-gemini-color',
    vendor: 'Google'
  },

  // Meta Models
  'meta/llama-3.3-70b': {
    icon: '🦙',
    name: 'Llama 3.3 70B',
    shortName: 'Llama 3.3',
    tagline: 'Open Powerhouse',
    description: 'Open-source excellence',
    cssVar: '--model-llama-color',
    vendor: 'Meta'
  },

  // Mistral Models
  'mistral/mistral-large': {
    icon: '🌊',
    name: 'Mistral Large',
    shortName: 'Mistral',
    tagline: 'European Expert',
    description: 'Powerful European AI',
    cssVar: '--model-mistral-color',
    vendor: 'Mistral AI'
  },

  // DeepSeek Models
  'deepseek/deepseek-chat': {
    icon: '🔍',
    name: 'DeepSeek Chat',
    shortName: 'DeepSeek',
    tagline: 'Research Focus',
    description: 'Research-oriented analysis',
    cssVar: '--model-deepseek-color',
    vendor: 'DeepSeek'
  },
  'deepseek/deepseek-reasoner': {
    icon: '🧮',
    name: 'DeepSeek Reasoner',
    shortName: 'DS Reasoner',
    tagline: 'Logic Master',
    description: 'Advanced logical reasoning',
    cssVar: '--model-deepseek-color',
    vendor: 'DeepSeek'
  }
};

/**
 * Get persona configuration for a model
 * @param {string} modelId - Full model ID (e.g., 'openai/gpt-4o')
 * @returns {Object} Persona configuration with fallback to default
 */
export function getModelPersona(modelId) {
  // Direct match
  if (MODEL_PERSONAS[modelId]) {
    return MODEL_PERSONAS[modelId];
  }

  // Try partial match (e.g., match 'gpt-4o' in 'openai/gpt-4o-2024-05-13')
  const partialMatch = Object.keys(MODEL_PERSONAS).find(key =>
    modelId.includes(key.split('/')[1]?.split('-')[0] || '')
  );

  if (partialMatch) {
    return MODEL_PERSONAS[partialMatch];
  }

  // Extract short name from model ID
  const shortName = modelId.split('/')[1] || modelId;

  // Default fallback
  return {
    icon: '🤖',
    name: shortName,
    shortName: shortName,
    tagline: 'AI Advisor',
    description: 'Advanced AI model',
    cssVar: '--model-default-color',
    vendor: 'Unknown'
  };
}

/**
 * Get CSS variable value for a model's color
 * @param {string} modelId - Full model ID
 * @returns {string} CSS variable name (e.g., 'var(--model-gpt4o-color)')
 */
export function getModelColor(modelId) {
  const persona = getModelPersona(modelId);
  return `var(${persona.cssVar})`;
}

/**
 * Get all personas grouped by vendor
 * @returns {Object} Personas grouped by vendor
 */
export function getPersonasByVendor() {
  const grouped = {};

  Object.entries(MODEL_PERSONAS).forEach(([modelId, persona]) => {
    const vendor = persona.vendor;
    if (!grouped[vendor]) {
      grouped[vendor] = [];
    }
    grouped[vendor].push({ modelId, ...persona });
  });

  return grouped;
}

/**
 * Trophy/Medal assignments based on ranking
 */
export const RANKING_MEDALS = {
  0: { emoji: '🥇', label: 'Gold', cssVar: '--trophy-gold' },
  1: { emoji: '🥈', label: 'Silver', cssVar: '--trophy-silver' },
  2: { emoji: '🥉', label: 'Bronze', cssVar: '--trophy-bronze' }
};

/**
 * Get medal for a ranking position
 * @param {number} position - Zero-based position (0 = first place)
 * @returns {Object|null} Medal configuration or null
 */
export function getRankingMedal(position) {
  return RANKING_MEDALS[position] || null;
}
