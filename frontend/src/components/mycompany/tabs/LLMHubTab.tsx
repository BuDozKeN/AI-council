/**
 * LLMHubTab - AI Configuration Hub
 *
 * Premium, modern UI for AI configuration.
 * Clean, spacious, intuitive.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import {
  Users,
  FileText,
  Wrench,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Target,
  Zap,
  MessageSquare,
  Edit3,
  RotateCcw as Reset,
  SlidersHorizontal,
  Cpu,
  Bot,
} from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Skeleton } from '../../ui/Skeleton';
import { Button } from '../../ui/button';
import { RangeSlider } from '../../ui/RangeSlider';
import { Tooltip } from '../../ui/Tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { api, type Persona } from '../../../api';
import { toast } from '../../ui/sonner';
import { invalidateCouncilStats } from '../../../hooks/useCouncilStats';
import { logger } from '../../../utils/logger';
import type { LLMPresetFull, ModelRegistryEntry, StageConfig } from '../../../types/business';
import '../styles/tabs/llm-hub/index.css';

// Persona icon mapping - labels and hints come from translations (llmHub.personas.{personaKey})
const PERSONA_ICONS: Record<string, typeof FileText> = {
  sop_writer: FileText,
  framework_author: FileText,
  policy_writer: FileText,
  persona_architect: Bot,
  sarah: MessageSquare,
  ai_write_assist: Edit3,
};

// ============================================================================
// Helpers
// ============================================================================

type CreativityLevel = 'precise' | 'balanced' | 'creative';

function getCreativityLevel(temp: number): CreativityLevel {
  if (temp <= 0.35) return 'precise';
  if (temp <= 0.6) return 'balanced';
  return 'creative';
}

// Type-safe creativity keys
const CREATIVITY_KEYS = {
  precise: 'llmHub.creativity.precise',
  balanced: 'llmHub.creativity.balanced',
  creative: 'llmHub.creativity.creative',
} as const;

// Returns translation key for creativity level
function getCreativityKey(temp: number): (typeof CREATIVITY_KEYS)[CreativityLevel] {
  const level = getCreativityLevel(temp);
  return CREATIVITY_KEYS[level];
}

// Type-safe length keys
const LENGTH_KEYS = {
  oneParagraph: 'llmHub.length.oneParagraph',
  halfPage: 'llmHub.length.halfPage',
  onePage: 'llmHub.length.onePage',
  oneToTwoPages: 'llmHub.length.oneToTwoPages',
  twoToThreePages: 'llmHub.length.twoToThreePages',
  fourPlusPages: 'llmHub.length.fourPlusPages',
} as const;

// Type-safe preset keys
const PRESET_KEYS = {
  conservative: {
    label: 'llmHub.presets.conservative.label',
    desc: 'llmHub.presets.conservative.desc',
  },
  balanced: { label: 'llmHub.presets.balanced.label', desc: 'llmHub.presets.balanced.desc' },
  creative: { label: 'llmHub.presets.creative.label', desc: 'llmHub.presets.creative.desc' },
} as const;

// Type-safe stage keys
const STAGE_NAME_KEYS = {
  stage1: { label: 'llmHub.stageNames.stage1.label', hint: 'llmHub.stageNames.stage1.hint' },
  stage2: { label: 'llmHub.stageNames.stage2.label', hint: 'llmHub.stageNames.stage2.hint' },
  stage3: { label: 'llmHub.stageNames.stage3.label', hint: 'llmHub.stageNames.stage3.hint' },
} as const;

// Type-safe group keys
const GROUP_KEYS = {
  core: { label: 'llmHub.groups.core.label', desc: 'llmHub.groups.core.desc' },
  content: { label: 'llmHub.groups.content.label', desc: 'llmHub.groups.content.desc' },
  utility: { label: 'llmHub.groups.utility.label', desc: 'llmHub.groups.utility.desc' },
} as const;

// Type-safe role keys
const ROLE_KEYS = {
  council_member: {
    label: 'llmHub.roles.council_member.label',
    hint: 'llmHub.roles.council_member.hint',
  },
  stage2_reviewer: {
    label: 'llmHub.roles.stage2_reviewer.label',
    hint: 'llmHub.roles.stage2_reviewer.hint',
  },
  chairman: { label: 'llmHub.roles.chairman.label', hint: 'llmHub.roles.chairman.hint' },
  document_writer: {
    label: 'llmHub.roles.document_writer.label',
    hint: 'llmHub.roles.document_writer.hint',
  },
  utility: { label: 'llmHub.roles.utility.label', hint: 'llmHub.roles.utility.hint' },
} as const;

// Type-safe persona keys
const PERSONA_KEYS = {
  sop_writer: {
    label: 'llmHub.personas.sop_writer.label',
    hint: 'llmHub.personas.sop_writer.hint',
  },
  framework_author: {
    label: 'llmHub.personas.framework_author.label',
    hint: 'llmHub.personas.framework_author.hint',
  },
  policy_writer: {
    label: 'llmHub.personas.policy_writer.label',
    hint: 'llmHub.personas.policy_writer.hint',
  },
  persona_architect: {
    label: 'llmHub.personas.persona_architect.label',
    hint: 'llmHub.personas.persona_architect.hint',
  },
  sarah: { label: 'llmHub.personas.sarah.label', hint: 'llmHub.personas.sarah.hint' },
  ai_write_assist: {
    label: 'llmHub.personas.ai_write_assist.label',
    hint: 'llmHub.personas.ai_write_assist.hint',
  },
} as const;

// Returns translation key for length label
function getLengthKey(tokens: number): (typeof LENGTH_KEYS)[keyof typeof LENGTH_KEYS] {
  if (tokens <= 512) return LENGTH_KEYS.oneParagraph;
  if (tokens <= 1024) return LENGTH_KEYS.halfPage;
  if (tokens <= 1536) return LENGTH_KEYS.onePage;
  if (tokens <= 2048) return LENGTH_KEYS.oneToTwoPages;
  if (tokens <= 4096) return LENGTH_KEYS.twoToThreePages;
  return LENGTH_KEYS.fourPlusPages;
}

// ============================================================================
// Defaults (Our recommended starting points)
// Note: OpenRouter's default temperature is 1.0 if not specified.
// We use lower temperatures for more consistent, reliable outputs.
// ============================================================================

const DEFAULTS: Record<string, { stage1: StageConfig; stage2: StageConfig; stage3: StageConfig }> =
  {
    conservative: {
      stage1: { temperature: 0.2, max_tokens: 8192 },
      stage2: { temperature: 0.15, max_tokens: 2048 },
      stage3: { temperature: 0.25, max_tokens: 8192 },
    },
    balanced: {
      stage1: { temperature: 0.5, max_tokens: 8192 },
      stage2: { temperature: 0.3, max_tokens: 2048 },
      stage3: { temperature: 0.4, max_tokens: 8192 },
    },
    creative: {
      stage1: { temperature: 0.8, max_tokens: 8192 },
      stage2: { temperature: 0.5, max_tokens: 2048 },
      stage3: { temperature: 0.7, max_tokens: 8192 },
    },
  };

// ============================================================================
// Config
// ============================================================================

interface LLMHubTabProps {
  companyId: string;
}

// Icon mapping for presets (labels come from translations)
const PRESET_ICONS: Record<string, { icon: typeof Target; isDefault?: boolean }> = {
  conservative: { icon: Target },
  balanced: { icon: Zap, isDefault: true },
  creative: { icon: Sparkles },
};

// Stage keys for iteration (labels come from translations)
const STAGE_KEYS = ['stage1', 'stage2', 'stage3'] as const;

// Length options with translation keys
const LENGTH_OPTIONS = [
  { value: '512', key: LENGTH_KEYS.oneParagraph },
  { value: '1024', key: LENGTH_KEYS.halfPage },
  { value: '1536', key: LENGTH_KEYS.onePage },
  { value: '2048', key: LENGTH_KEYS.oneToTwoPages },
  { value: '4096', key: LENGTH_KEYS.twoToThreePages },
  { value: '8192', key: LENGTH_KEYS.fourPlusPages },
];

// Role configuration
// - multi: true = all models run in parallel (grid layout)
// - multi: false/undefined = primary + fallback chain
interface RoleConfig {
  group: string;
  multi?: boolean;
  minModels?: number;
  maxModels?: number;
}

// CONSOLIDATED ROLES - Simplified model configuration
// The LLM model is just the engine; the PERSONA/PROMPT defines the expertise
// Labels and hints come from translations (llmHub.roles.{roleKey})
const ROLES: Record<string, RoleConfig> = {
  // Core - Question Answering (keep separate - different requirements)
  council_member: {
    group: 'core',
    multi: true,
    minModels: 1, // Allow down to 1 model (user's choice)
    maxModels: 14, // Allow all available models
  },
  stage2_reviewer: {
    group: 'core',
    multi: true,
    minModels: 1, // Allow down to 1 model (user's choice)
    maxModels: 14, // Allow all available models
  },
  chairman: {
    group: 'core',
    multi: false,
    minModels: 1,
    maxModels: 3, // Primary + 2 fallbacks (enough for redundancy)
  },

  // CONSOLIDATED: Document Writing - ONE shared model config for all document types
  // Individual document types (SOP, Framework, Policy) are differentiated by PERSONA, not model
  document_writer: {
    group: 'content',
    multi: false,
    minModels: 1,
    maxModels: 3,
  },

  // CONSOLIDATED: Utility Tools - ONE shared model config for helper tasks
  // Handles: titles, summaries, text polish, routing, playbook assistance
  utility: {
    group: 'utility',
    multi: false,
    minModels: 1,
    maxModels: 3,
  },
};

// Explicit order for roles in each group
const CORE_ROLE_ORDER = ['council_member', 'stage2_reviewer', 'chairman'];
const CONTENT_ROLE_ORDER = ['document_writer'];
const UTILITY_ROLE_ORDER = ['utility'];

// Groups config - labels and descriptions come from translations (llmHub.groups.{groupKey})
const GROUPS: Record<string, { icon: typeof Users; color: string; order: string[] }> = {
  core: {
    icon: Users,
    color: 'blue',
    order: CORE_ROLE_ORDER,
  },
  content: {
    icon: FileText,
    color: 'green',
    order: CONTENT_ROLE_ORDER,
  },
  utility: {
    icon: Wrench,
    color: 'purple',
    order: UTILITY_ROLE_ORDER,
  },
};

// Provider to icon mapping (icons are in /public/icons/)
const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  'x-ai': '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
  meta: '/icons/meta.svg',
  moonshot: '/icons/moonshot.svg',
};

function getProviderIcon(modelId: string): string {
  const provider = modelId.split('/')[0] ?? '';
  // Return provider icon or a generic bot icon as fallback
  return PROVIDER_ICONS[provider] ?? '/icons/anthropic.svg';
}

const MODELS = [
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude Sonnet 3.5' },
  { id: 'anthropic/claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'x-ai/grok-4', name: 'Grok 4' },
  { id: 'x-ai/grok-4-fast', name: 'Grok 4 Fast' },
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3' },
  { id: 'moonshot/kimi-k2', name: 'Kimi K2' },
];

// Default models for each role when database has no entries
// These MUST match backend/model_registry.py FALLBACK_MODELS
const DEFAULT_MODELS: Record<string, string[]> = {
  document_writer: [
    'openai/gpt-4o',
    'anthropic/claude-3-5-sonnet-20241022',
    'google/gemini-2.0-flash-001',
  ],
  utility: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-haiku-20241022'],
};

// Generate placeholder entries from defaults when DB has no data
// These have special IDs starting with "default-" to indicate they need to be created
function getEffectiveModels(
  role: string,
  dbModels: ModelRegistryEntry[]
): { models: ModelRegistryEntry[]; isUsingDefaults: boolean } {
  if (dbModels.length > 0) {
    return { models: dbModels, isUsingDefaults: false };
  }

  const defaults = DEFAULT_MODELS[role];
  if (!defaults) {
    return { models: [], isUsingDefaults: false };
  }

  // Create virtual entries from defaults
  // Omit optional properties instead of setting them to undefined
  const virtualModels: ModelRegistryEntry[] = defaults.map((modelId, idx) => ({
    id: `default-${role}-${idx}`,
    role,
    model_id: modelId,
    priority: idx,
    is_active: true,
    is_global: true, // Defaults are "global"
  }));

  return { models: virtualModels, isUsingDefaults: true };
}

// ============================================================================
// ModelPill - Model selector with delete via dropdown option
// ============================================================================

interface ModelPillProps {
  entry: ModelRegistryEntry;
  canRemove: boolean;
  disabled: boolean;
  onModelChange: (modelId: string) => void;
  onRemove: () => void;
}

function ModelPill({ entry, canRemove, disabled, onModelChange, onRemove }: ModelPillProps) {
  const { t } = useTranslation();
  const model = MODELS.find((m) => m.id === entry.model_id);

  const handleValueChange = (value: string) => {
    if (value === '__remove__') {
      onRemove();
    } else {
      onModelChange(value);
    }
  };

  return (
    <div className="llm-model-item" data-llm-select>
      <Select value={entry.model_id} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger className="llm-model-select select-trigger--llm-model">
          <img src={getProviderIcon(entry.model_id)} alt="" className="llm-model-icon" />
          <span className="llm-model-name">{model?.name ?? t('common.select')}</span>
        </SelectTrigger>
        <SelectContent className="llm-model-dropdown">
          {/* Remove option at TOP for quick access - no scrolling needed */}
          {canRemove && (
            <>
              <SelectItem value="__remove__" className="llm-model-remove-option">
                {t('llmHub.remove')}
              </SelectItem>
              <div className="llm-model-dropdown-separator" />
            </>
          )}
          {MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <img src={getProviderIcon(m.id)} alt="" className="llm-model-icon" />
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// AddModelSelect - Dropdown to select which model to add
// ============================================================================

interface AddModelSelectProps {
  usedModelIds: string[];
  disabled: boolean;
  onAdd: (modelId: string) => void;
}

function AddModelSelect({ usedModelIds, disabled, onAdd }: AddModelSelectProps) {
  const { t } = useTranslation();
  const availableModels = MODELS.filter((m) => !usedModelIds.includes(m.id));

  // All models already in use - show disabled state with feedback
  if (availableModels.length === 0) {
    return (
      <div data-llm-select data-add-trigger>
        <button
          type="button"
          className="llm-model-select llm-model-add-trigger llm-model-add-exhausted"
          disabled
          title={t('llmHub.allModelsUsed')}
        >
          <span className="llm-model-add-text">{t('llmHub.allUsed')}</span>
        </button>
      </div>
    );
  }

  return (
    <div data-llm-select data-add-trigger>
      <Select
        value=""
        onValueChange={(value) => {
          if (value) onAdd(value);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="llm-model-select llm-model-add-trigger select-trigger--llm-model">
          <span className="llm-model-add-text">{t('llmHub.add')}</span>
        </SelectTrigger>
        <SelectContent className="llm-model-dropdown">
          {availableModels.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <img src={getProviderIcon(m.id)} alt="" className="llm-model-icon" />
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function LLMHubTab({ companyId }: LLMHubTabProps) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<LLMPresetFull[]>([]);
  const [models, setModels] = useState<Record<string, ModelRegistryEntry[]>>({});
  // Note: roles from API are no longer used - we derive groups from local ROLES/GROUPS config
  // This ensures all configured roles show in UI even before database has entries
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Top-level section expansion state (two-level hierarchy)
  type SectionId = 'response-styles' | 'ai-models' | 'ai-personas';
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);

  // Editing state
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    stage1: StageConfig;
    stage2: StageConfig;
    stage3: StageConfig;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Persona editing state
  const [editingPersona, setEditingPersona] = useState<string | null>(null);
  const [personaEditValue, setPersonaEditValue] = useState<string>('');
  const [savingPersona, setSavingPersona] = useState(false);

  // Toggle top-level section
  const toggleSection = (id: SectionId) => {
    setExpandedSection((prev) => (prev === id ? null : id));
    // Reset inner states when collapsing
    if (expandedSection === id) {
      setExpandedPreset(null);
      setEditValues(null);
      setEditingPersona(null);
      setPersonaEditValue('');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch core data (presets and models) - these are required
      const [presetsRes, modelsRes] = await Promise.all([
        api.getLLMPresets(companyId),
        api.getModelRegistry(companyId),
      ]);
      setPresets(presetsRes.presets);
      setModels(modelsRes.models);

      // Fetch personas separately - failure shouldn't break the page
      try {
        const personasRes = await api.getPersonas(companyId);
        setPersonas(personasRes.personas);
      } catch (personaErr) {
        logger.error('Error loading personas:', personaErr);
        // Personas are optional - continue without them
        setPersonas([]);
      }
    } catch (err) {
      setError(t('llmHub.errors.loadFailed'));
      logger.error('Failed to load LLM hub data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const togglePreset = (id: string) => {
    if (expandedPreset === id) {
      setExpandedPreset(null);
      setEditValues(null);
    } else {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        setExpandedPreset(id);
        setEditValues({
          stage1: { ...preset.config.stage1 },
          stage2: { ...preset.config.stage2 },
          stage3: { ...preset.config.stage3 },
        });
      }
    }
  };

  // Debounced auto-save ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save function (debounced)
  const autoSave = useCallback(
    async (presetId: string, values: typeof editValues) => {
      if (!values) return;
      try {
        await api.updateLLMPreset(companyId, presetId, { config: values });
        // Update local presets state to reflect saved values
        setPresets((prev) => prev.map((p) => (p.id === presetId ? { ...p, config: values } : p)));
      } catch {
        toast.error(t('common.failedToSave'));
      }
    },
    [companyId, t]
  );

  const updateValue = (
    stage: 'stage1' | 'stage2' | 'stage3',
    field: 'temperature' | 'max_tokens',
    value: number
  ) => {
    if (!editValues || !expandedPreset) return;
    const newValues = {
      ...editValues,
      [stage]: { ...editValues[stage], [field]: value },
    };
    setEditValues(newValues);

    // Debounced auto-save (500ms after last change)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(expandedPreset, newValues);
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const resetDefaults = async () => {
    if (!expandedPreset || !DEFAULTS[expandedPreset]) return;
    const defaultValues = { ...DEFAULTS[expandedPreset] };
    setEditValues(defaultValues);
    // Save immediately on reset
    await autoSave(expandedPreset, defaultValues);
    toast.success(t('llmHub.toast.resetDefaults'));
  };

  // Keep saveChanges for desktop (button still visible there)
  const saveChanges = async () => {
    if (!expandedPreset || !editValues) return;
    setSaving(true);
    try {
      await api.updateLLMPreset(companyId, expandedPreset, { config: editValues });
      toast.success(t('common.saved'));
      setExpandedPreset(null);
      setEditValues(null);
      fetchData();
    } catch {
      toast.error(t('common.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const changeModel = async (entry: ModelRegistryEntry, modelId: string) => {
    if (modelId === entry.model_id) return;

    // Check if this is a virtual entry (defaults not yet in DB)
    const isVirtual = entry.id.startsWith('default-');

    if (isVirtual) {
      // For virtual entries, we need to CREATE all defaults in DB with the change applied
      setSavingModel(true);
      try {
        const defaults = DEFAULT_MODELS[entry.role] || [];
        const newModels: ModelRegistryEntry[] = [];

        for (let i = 0; i < defaults.length; i++) {
          // Apply the change to the entry being modified
          const defaultModel = defaults[i];
          if (!defaultModel) continue;
          const actualModelId = i === entry.priority ? modelId : defaultModel;
          const result = await api.createModelRegistryEntry(companyId, {
            role: entry.role,
            model_id: actualModelId,
            priority: i,
          });
          if (result.model) {
            newModels.push(result.model);
          }
        }

        // Update state with real DB entries
        setModels((prev) => ({
          ...prev,
          [entry.role]: newModels,
        }));
        toast.success(t('common.saved'));
      } catch {
        toast.error(t('llmHub.toast.failedUpdate'));
      } finally {
        setSavingModel(false);
      }
      return;
    }

    // Optimistic update - update local state immediately for smooth UX
    const oldModelId = entry.model_id;
    setModels((prev) => {
      const updated = { ...prev };
      const roleModels = (updated[entry.role] || []).map((m) =>
        m.id === entry.id ? ({ ...m, model_id: modelId } as ModelRegistryEntry) : m
      );
      updated[entry.role] = roleModels;
      return updated;
    });

    try {
      await api.updateModelRegistryEntry(companyId, entry.id, { model_id: modelId });
      // No need to refetch - state already updated
    } catch {
      // Rollback on error
      setModels((prev) => {
        const updated = { ...prev };
        const roleModels = (updated[entry.role] || []).map((m) =>
          m.id === entry.id ? ({ ...m, model_id: oldModelId } as ModelRegistryEntry) : m
        );
        updated[entry.role] = roleModels;
        return updated;
      });
      toast.error(t('llmHub.toast.failedUpdate'));
    }
  };

  const addModel = async (role: string, modelId: string) => {
    const roleModels = models[role] || [];
    const cfg = ROLES[role];
    const maxModels = cfg?.maxModels ?? 5;

    if (roleModels.length >= maxModels) {
      toast.error(t('llmHub.toast.maxModels', { count: maxModels }));
      return;
    }

    setSavingModel(true);
    try {
      const result = await api.createModelRegistryEntry(companyId, {
        role,
        model_id: modelId,
        priority: roleModels.length,
      });

      // Add new model to state (server returns the created model with ID)
      if (result.model) {
        setModels((prev) => {
          const updated = { ...prev };
          updated[role] = [...(updated[role] || []), result.model];
          return updated;
        });
        // Invalidate hero page stats if council members changed
        if (role === 'council_member') {
          invalidateCouncilStats(companyId);
        }
      }
    } catch {
      toast.error(t('llmHub.toast.failedAddModel'));
    } finally {
      setSavingModel(false);
    }
  };

  const removeModel = async (entry: ModelRegistryEntry) => {
    const roleModels = models[entry.role] || [];
    const cfg = ROLES[entry.role];
    const minModels = cfg?.minModels ?? 1;

    if (roleModels.length <= minModels) {
      toast.error(t('llmHub.toast.minModels', { count: minModels }));
      return;
    }

    // Optimistic update - remove from state immediately
    const removedEntry = entry;
    setModels((prev) => {
      const updated = { ...prev };
      updated[entry.role] = (updated[entry.role] || []).filter((m) => m.id !== entry.id);
      return updated;
    });

    try {
      await api.deleteModelRegistryEntry(companyId, entry.id);
      // Invalidate hero page stats if council members changed
      if (entry.role === 'council_member') {
        invalidateCouncilStats(companyId);
      }
    } catch {
      // Rollback on error
      setModels((prev) => {
        const updated = { ...prev };
        updated[removedEntry.role] = [...(updated[removedEntry.role] || []), removedEntry].sort(
          (a, b) => a.priority - b.priority
        );
        return updated;
      });
      toast.error(t('llmHub.toast.failedRemoveModel'));
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Persona editing functions
  const startEditingPersona = (persona: Persona) => {
    setEditingPersona(persona.persona_key);
    setPersonaEditValue(persona.system_prompt);
  };

  const cancelEditingPersona = () => {
    setEditingPersona(null);
    setPersonaEditValue('');
  };

  const savePersona = async (personaKey: string) => {
    if (!personaEditValue.trim()) {
      toast.error(t('llmHub.toast.promptEmpty'));
      return;
    }

    setSavingPersona(true);
    try {
      const result = await api.updatePersona(companyId, personaKey, {
        system_prompt: personaEditValue,
      });

      // Update local state
      setPersonas((prev) =>
        prev.map((p) =>
          p.persona_key === personaKey
            ? { ...p, system_prompt: personaEditValue, is_global: false }
            : p
        )
      );

      toast.success(
        result.created ? t('llmHub.toast.customizationSaved') : t('llmHub.toast.promptUpdated')
      );
      setEditingPersona(null);
      setPersonaEditValue('');
    } catch {
      toast.error(t('common.failedToSave'));
    } finally {
      setSavingPersona(false);
    }
  };

  const resetPersona = async (personaKey: string) => {
    setSavingPersona(true);
    try {
      await api.resetPersona(companyId, personaKey);

      // Refetch to get the global version
      const personasRes = await api.getPersonas(companyId);
      setPersonas(personasRes.personas);

      toast.success(t('llmHub.toast.resetToDefault'));
      setEditingPersona(null);
      setPersonaEditValue('');
    } catch {
      toast.error(t('llmHub.toast.failedReset'));
    } finally {
      setSavingPersona(false);
    }
  };

  // Group roles and enforce order using the group's order array
  // Show ALL configured roles from ROLES, not just those returned by API
  // This ensures new roles appear in UI even before database has entries
  const groupedRoles = Object.entries(GROUPS)
    .map(([id, group]) => {
      // Use the group's defined order directly - these are all the roles we want to show
      // Filter to only roles that exist in ROLES config (defensive)
      const orderedRoles = group.order.filter((r) => ROLES[r]?.group === id);

      return {
        id,
        ...group,
        roles: orderedRoles,
      };
    })
    .filter((g) => g.roles.length > 0);

  if (loading) {
    return (
      <div className="llm-loading">
        <Skeleton height={200} className="llm-skeleton" />
        <Skeleton height={150} className="llm-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="settings-card">
        <CardContent>
          <div className="llm-error">
            <AlertTriangle size={32} />
            <p>{error}</p>
            <Button onClick={fetchData}>
              <RotateCcw size={14} />
              {t('common.tryAgain')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Count summary for collapsed state
  const presetsCount = presets.length;
  const modelsCount = Object.values(models).flat().length;
  const personasCount = personas.length;

  return (
    <div className="llm-hub">
      {/* ================================================================
          RESPONSE STYLES - Top-level collapsible card
          ================================================================ */}
      <div
        className={`llm-card llm-card--top ${expandedSection === 'response-styles' ? 'llm-card--expanded' : ''}`}
        data-color="indigo"
      >
        <button
          type="button"
          className="llm-card-header"
          onClick={() => toggleSection('response-styles')}
          aria-expanded={expandedSection === 'response-styles'}
        >
          <div className="llm-card-icon" data-color="indigo">
            <SlidersHorizontal size={20} aria-hidden="true" />
          </div>
          <div className="llm-card-info">
            <h3>{t('llmHub.responseStyles.title')}</h3>
            <p>{t('llmHub.responseStyles.description', { count: presetsCount })}</p>
          </div>
          <ChevronRight
            size={18}
            className={`llm-card-chevron ${expandedSection === 'response-styles' ? 'rotated' : ''}`}
            aria-hidden="true"
          />
        </button>

        {expandedSection === 'response-styles' && (
          <div className="llm-card-body">
            {/* Desktop-only hint explaining what creativity/temperature means - shown once */}
            <p className="llm-creativity-hint">{t('llmHub.stages.creativityHint')}</p>

            <div className="llm-inner-cards">
              {presets.map((preset) => {
                const iconConfig = PRESET_ICONS[preset.id];
                const Icon = iconConfig?.icon ?? Zap;
                const isExpanded = expandedPreset === preset.id;
                const values = isExpanded && editValues ? editValues : preset.config;
                const presetKeys = PRESET_KEYS[preset.id as keyof typeof PRESET_KEYS];

                return (
                  <div
                    key={preset.id}
                    className={`llm-inner-card ${isExpanded ? 'llm-inner-card--expanded' : ''}`}
                    data-preset={preset.id}
                  >
                    <button
                      type="button"
                      className="llm-inner-card-header"
                      onClick={() => togglePreset(preset.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="llm-inner-card-icon" data-preset={preset.id}>
                        <Icon size={16} aria-hidden="true" />
                      </div>
                      <div className="llm-inner-card-info">
                        <span className="llm-inner-card-title">
                          {presetKeys ? t(presetKeys.label) : preset.name}
                          {iconConfig?.isDefault && (
                            <span className="llm-default-tag">{t('llmHub.recommended')}</span>
                          )}
                        </span>
                        <span className="llm-inner-card-desc">
                          {presetKeys ? t(presetKeys.desc) : preset.description}
                        </span>
                      </div>
                      <ChevronRight
                        size={18}
                        className={`llm-card-chevron ${isExpanded ? 'rotated' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {isExpanded && (
                      <div className="llm-inner-card-body">
                        <div className="llm-stages">
                          {/* Desktop header row */}
                          <div className="llm-stage-header">
                            <div className="llm-stage-header-cell">
                              {t('llmHub.stages.processStep')}
                            </div>
                            <div className="llm-stage-header-cell">
                              {t('llmHub.stages.creativity')}
                            </div>
                            <div className="llm-stage-header-cell">
                              {t('llmHub.stages.responseLength')}
                            </div>
                          </div>

                          {STAGE_KEYS.map((stageKey) => {
                            const stageData = values[stageKey];
                            const level = getCreativityLevel(stageData.temperature);
                            const stageNameKeys = STAGE_NAME_KEYS[stageKey];

                            return (
                              <div key={stageKey} className="llm-stage-row">
                                {/* Desktop: Column 1 - Stage name */}
                                <div className="llm-stage-label">
                                  <span className="llm-stage-name">{t(stageNameKeys.label)}</span>
                                  <span className="llm-stage-hint">{t(stageNameKeys.hint)}</span>
                                </div>

                                {/* Desktop: Column 2 - Creativity slider with badge */}
                                <div className="llm-stage-controls">
                                  <span className={`llm-badge llm-badge--${level}`}>
                                    {t(getCreativityKey(stageData.temperature))}
                                  </span>
                                  <RangeSlider
                                    value={stageData.temperature}
                                    onChange={(val) => updateValue(stageKey, 'temperature', val)}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    aria-label={`${t(stageNameKeys.label)} creativity`}
                                  />
                                </div>

                                {/* Desktop: Column 3 - Response length dropdown */}
                                <Tooltip
                                  content={`${stageData.max_tokens.toLocaleString(getIntlLocale())} ${t('llmHub.tokens')}`}
                                  side="top"
                                >
                                  <div className="llm-length-wrapper llm-length-wrapper--desktop">
                                    <Select
                                      value={String(stageData.max_tokens)}
                                      onValueChange={(v) =>
                                        updateValue(stageKey, 'max_tokens', parseInt(v))
                                      }
                                    >
                                      <SelectTrigger className="llm-length-select">
                                        <SelectValue>
                                          {t(getLengthKey(stageData.max_tokens))}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {LENGTH_OPTIONS.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>
                                            {t(opt.key)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </Tooltip>

                                {/* Mobile: Label + Badge on top, Slider below */}
                                <div className="llm-mobile-slider-row">
                                  <div className="llm-mobile-slider-header">
                                    <span className="llm-stage-name">{t(stageNameKeys.label)}</span>
                                    <span className={`llm-badge llm-badge--${level}`}>
                                      {t(getCreativityKey(stageData.temperature))}
                                    </span>
                                  </div>
                                  <RangeSlider
                                    value={stageData.temperature}
                                    onChange={(val) => updateValue(stageKey, 'temperature', val)}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    aria-label={`${t(stageNameKeys.label)} creativity`}
                                  />
                                </div>

                                {/* Mobile: Response + dropdown on ONE line */}
                                <div className="llm-mobile-length-row">
                                  <span className="llm-mobile-length-label">
                                    {t('llmHub.stages.response')}
                                  </span>
                                  <Select
                                    value={String(stageData.max_tokens)}
                                    onValueChange={(v) =>
                                      updateValue(stageKey, 'max_tokens', parseInt(v))
                                    }
                                  >
                                    <SelectTrigger className="llm-length-select">
                                      <SelectValue>
                                        {t(getLengthKey(stageData.max_tokens))}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {LENGTH_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {t(opt.key)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="llm-actions">
                          <Tooltip content={t('llmHub.resetToDefault')} side="top">
                            <button
                              type="button"
                              className="llm-btn-reset"
                              onClick={resetDefaults}
                              disabled={saving}
                              aria-label={t('llmHub.resetToDefault')}
                            >
                              <RotateCcw size={10} />
                              <span className="llm-btn-reset-text">{t('llmHub.default')}</span>
                            </button>
                          </Tooltip>
                          {/* Save button - desktop only, hidden on mobile via CSS */}
                          <Button className="llm-btn-save" onClick={saveChanges} disabled={saving}>
                            {saving ? t('common.saving') : t('common.save')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          AI MODELS - Top-level collapsible card
          ================================================================ */}
      <div
        className={`llm-card llm-card--top ${expandedSection === 'ai-models' ? 'llm-card--expanded' : ''}`}
        data-color="blue"
      >
        <button
          type="button"
          className="llm-card-header"
          onClick={() => toggleSection('ai-models')}
          aria-expanded={expandedSection === 'ai-models'}
        >
          <div className="llm-card-icon" data-color="blue">
            <Cpu size={20} aria-hidden="true" />
          </div>
          <div className="llm-card-info">
            <h3>{t('llmHub.aiModels.title')}</h3>
            <p>{t('llmHub.aiModels.description', { count: modelsCount })}</p>
          </div>
          <ChevronRight
            size={18}
            className={`llm-card-chevron ${expandedSection === 'ai-models' ? 'rotated' : ''}`}
            aria-hidden="true"
          />
        </button>

        {expandedSection === 'ai-models' && (
          <div className="llm-card-body">
            <div className="llm-inner-cards">
              {groupedRoles.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const GroupIcon = group.icon;
                const groupId = group.id as keyof typeof GROUP_KEYS;

                return (
                  <div
                    key={group.id}
                    className={`llm-inner-card ${isExpanded ? 'llm-inner-card--expanded' : ''}`}
                    data-color={group.color}
                  >
                    <button
                      type="button"
                      className="llm-inner-card-header"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="llm-inner-card-icon" data-color={group.color}>
                        <GroupIcon size={16} aria-hidden="true" />
                      </div>
                      <div className="llm-inner-card-info">
                        <span className="llm-inner-card-title">
                          {GROUP_KEYS[groupId] ? t(GROUP_KEYS[groupId].label) : group.id}
                        </span>
                        <span className="llm-inner-card-desc">
                          {GROUP_KEYS[groupId] ? t(GROUP_KEYS[groupId].desc) : ''}
                        </span>
                      </div>
                      <ChevronRight
                        size={18}
                        className={`llm-card-chevron ${isExpanded ? 'rotated' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {isExpanded && (
                      <div className="llm-inner-card-body">
                        <div className="llm-model-list">
                          {group.roles.map((role) => {
                            const roleModels = models[role] || [];
                            const cfg = ROLES[role];
                            // Use effective models (defaults if DB empty)
                            const { models: effectiveModels, isUsingDefaults } = getEffectiveModels(
                              role,
                              roleModels
                            );
                            const sortedModels = [...effectiveModels].sort(
                              (a, b) => a.priority - b.priority
                            );
                            const canAdd = sortedModels.length < (cfg?.maxModels ?? 5);
                            // Can't remove defaults - they're virtual entries
                            const canRemove =
                              !isUsingDefaults && sortedModels.length > (cfg?.minModels ?? 1);
                            const isMulti = cfg?.multi !== false;
                            const roleId = role as keyof typeof ROLE_KEYS;

                            return (
                              <div key={role} className="llm-model-row">
                                <div className="llm-model-role">
                                  <span className="llm-model-role-label">
                                    {ROLE_KEYS[roleId] ? t(ROLE_KEYS[roleId].label) : role}
                                  </span>
                                  <span className="llm-model-role-hint">
                                    {ROLE_KEYS[roleId] ? t(ROLE_KEYS[roleId].hint) : ''}
                                  </span>
                                </div>

                                {isMulti ? (
                                  <div className="llm-model-grid">
                                    {sortedModels.map((entry) => (
                                      <ModelPill
                                        key={entry.id}
                                        entry={entry}
                                        canRemove={canRemove}
                                        disabled={savingModel}
                                        onModelChange={(v) => changeModel(entry, v)}
                                        onRemove={() => removeModel(entry)}
                                      />
                                    ))}
                                    {canAdd && (
                                      <AddModelSelect
                                        usedModelIds={sortedModels.map((m) => m.model_id)}
                                        disabled={savingModel}
                                        onAdd={(modelId) => addModel(role, modelId)}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div className="llm-model-chain">
                                    {sortedModels.map((entry, idx) => {
                                      const label =
                                        idx === 0
                                          ? t('llmHub.primary')
                                          : t('llmHub.fallback', { num: idx });
                                      return (
                                        <div key={entry.id} className="llm-model-chain-item">
                                          <span className="llm-model-chain-label">{label}</span>
                                          <ModelPill
                                            entry={entry}
                                            canRemove={canRemove}
                                            disabled={savingModel}
                                            onModelChange={(v) => changeModel(entry, v)}
                                            onRemove={() => removeModel(entry)}
                                          />
                                        </div>
                                      );
                                    })}
                                    {canAdd && (
                                      <AddModelSelect
                                        usedModelIds={sortedModels.map((m) => m.model_id)}
                                        disabled={savingModel}
                                        onAdd={(modelId) => addModel(role, modelId)}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          AI PERSONAS - Top-level collapsible card
          ================================================================ */}
      {personas.length > 0 && (
        <div
          className={`llm-card llm-card--top ${expandedSection === 'ai-personas' ? 'llm-card--expanded' : ''}`}
          data-color="amber"
        >
          <button
            type="button"
            className="llm-card-header"
            onClick={() => toggleSection('ai-personas')}
            aria-expanded={expandedSection === 'ai-personas'}
          >
            <div className="llm-card-icon" data-color="amber">
              <Bot size={20} aria-hidden="true" />
            </div>
            <div className="llm-card-info">
              <h3>{t('llmHub.aiPersonas.title')}</h3>
              <p>{t('llmHub.aiPersonas.description', { count: personasCount })}</p>
            </div>
            <ChevronRight
              size={18}
              className={`llm-card-chevron ${expandedSection === 'ai-personas' ? 'rotated' : ''}`}
              aria-hidden="true"
            />
          </button>

          {expandedSection === 'ai-personas' && (
            <div className="llm-card-body">
              <div className="llm-inner-cards">
                {personas.map((persona) => {
                  const isEditing = editingPersona === persona.persona_key;
                  const PersonaIcon = PERSONA_ICONS[persona.persona_key] || FileText;
                  const personaId = persona.persona_key as keyof typeof PERSONA_KEYS;

                  return (
                    <div
                      key={persona.persona_key}
                      className={`llm-inner-card ${isEditing ? 'llm-inner-card--expanded' : ''}`}
                      data-color="amber"
                    >
                      <button
                        type="button"
                        className="llm-inner-card-header"
                        onClick={() =>
                          isEditing ? cancelEditingPersona() : startEditingPersona(persona)
                        }
                        aria-expanded={isEditing}
                      >
                        <div className="llm-inner-card-icon" data-color="amber">
                          <PersonaIcon size={16} aria-hidden="true" />
                        </div>
                        <div className="llm-inner-card-info">
                          <span className="llm-inner-card-title">
                            {PERSONA_KEYS[personaId]
                              ? t(PERSONA_KEYS[personaId].label)
                              : persona.name}
                            {!persona.is_global && (
                              <span className="llm-customized-tag">{t('llmHub.customized')}</span>
                            )}
                          </span>
                          <span className="llm-inner-card-desc">
                            {PERSONA_KEYS[personaId]
                              ? t(PERSONA_KEYS[personaId].hint)
                              : persona.description}
                          </span>
                        </div>
                        <ChevronRight
                          size={18}
                          className={`llm-card-chevron ${isEditing ? 'rotated' : ''}`}
                          aria-hidden="true"
                        />
                      </button>

                      {isEditing && (
                        <div className="llm-inner-card-body">
                          <textarea
                            className="llm-persona-textarea"
                            value={personaEditValue}
                            onChange={(e) => setPersonaEditValue(e.target.value)}
                            placeholder={t('llmHub.placeholders.systemPrompt')}
                            rows={10}
                            disabled={savingPersona}
                          />
                          <div className="llm-actions">
                            {!persona.is_global && (
                              <button
                                type="button"
                                className="llm-btn-reset"
                                onClick={() => resetPersona(persona.persona_key)}
                                disabled={savingPersona}
                              >
                                <Reset size={12} />
                                {t('common.reset')}
                              </button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditingPersona}
                              disabled={savingPersona}
                            >
                              {t('common.cancel')}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => savePersona(persona.persona_key)}
                              disabled={savingPersona}
                            >
                              {savingPersona ? t('common.saving') : t('common.save')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
