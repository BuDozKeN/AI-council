/**
 * Business-related type definitions
 */

export interface Department {
  id: string;
  name: string;
  slug?: string; // Department slug (e.g., "technology", "sales") - used for conversation grouping
  description?: string;
  context_md?: string; // Department-specific context for AI
  llm_preset?: 'conservative' | 'balanced' | 'creative'; // LLM behavior preset
  roles?: Role[];
  channels?: Channel[];
}

export interface Role {
  id: string;
  name: string;
  title?: string;
  description?: string;
  system_prompt?: string;
  departmentId?: string;
  departmentName?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
}

export interface Style {
  id: string;
  name: string;
  description?: string;
}

export interface Playbook {
  id: string;
  name?: string;
  title?: string;
  type?: 'sop' | 'framework' | 'policy';
  doc_type?: 'sop' | 'framework' | 'policy';
  content?: string;
  description?: string;
  department_id?: string;
  department_ids?: string[];
  additional_departments?: string[];
  tags?: string[];
  version?: number;
  status?: 'active' | 'archived' | 'draft';
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  context?: string;
  status: 'active' | 'completed' | 'archived';
  company_id: string;
  department_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  departments?: Department[];
  styles?: Style[];
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  last_company_id?: string;
  last_department_ids?: string[];
  last_role_ids?: string[];
  last_project_id?: string;
  last_playbook_ids?: string[];
}

// =============================================================================
// LLM Hub Types
// =============================================================================

/**
 * Stage-level configuration for temperature and tokens.
 */
export interface StageConfig {
  temperature: number;
  max_tokens: number;
  top_p?: number;
}

/**
 * Full preset configuration with all 3 stages.
 */
export interface PresetConfigFull {
  stage1: StageConfig;
  stage2: StageConfig;
  stage3: StageConfig;
}

/**
 * Full LLM preset with configuration for all stages.
 */
export interface LLMPresetFull {
  id: string; // 'conservative' | 'balanced' | 'creative'
  name: string;
  description?: string;
  config: PresetConfigFull;
  recommended_for: string[];
  updated_at?: string;
}

/**
 * A model entry in the model registry.
 */
export interface ModelRegistryEntry {
  id: string;
  role: string;
  model_id: string;
  display_name?: string;
  priority: number;
  is_active: boolean;
  is_global?: boolean;
  notes?: string;
}

// =============================================================================
// Conversation Modifiers
// =============================================================================

/**
 * Conversation modifier IDs for per-message LLM behavior tweaks.
 */
export type ConversationModifier = 'creative' | 'cautious' | 'concise' | 'detailed';

/**
 * Modifier definition with display info.
 */
export interface ModifierDefinition {
  id: ConversationModifier;
  label: string;
  icon: string;
  description: string;
}

/**
 * Available conversation modifiers.
 */
export const CONVERSATION_MODIFIERS: ModifierDefinition[] = [
  {
    id: 'creative',
    label: 'Creative',
    icon: '✨',
    description: 'More varied, imaginative responses',
  },
  {
    id: 'cautious',
    label: 'Cautious',
    icon: '🛡️',
    description: 'More careful, precise responses',
  },
  {
    id: 'concise',
    label: 'Concise',
    icon: '📝',
    description: 'Shorter, to-the-point answers',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    icon: '📚',
    description: 'Longer, comprehensive answers',
  },
];

// =============================================================================
// LLM Preset Select Types
// =============================================================================

/**
 * Valid LLM preset IDs for the preset selector.
 */
export type LLMPresetId = 'conservative' | 'balanced' | 'creative';

/**
 * Preset definition for UI display.
 */
export interface LLMPreset {
  id: LLMPresetId;
  name: string;
  description: string;
}

/**
 * Available LLM behavior presets.
 */
export const LLM_PRESETS: LLMPreset[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Lower temperature, safer responses',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default settings for most use cases',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Higher temperature, more varied responses',
  },
];
