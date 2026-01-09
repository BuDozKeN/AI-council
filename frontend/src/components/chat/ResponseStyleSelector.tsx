/**
 * ResponseStyleSelector - Quick toggle for AI response style
 *
 * Shows current preset (Precise/Balanced/Creative) with option to override.
 * Matches the omni-inline-mode-toggle visual pattern.
 *
 * - Clicking opens dropdown with preset options
 * - "Department Default" option uses the department's configured preset
 * - Link to LLM Hub for full configuration
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Target, Zap, Sparkles, Settings2, Check, ChevronDown, Building2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from '../ui/BottomSheet';
import type { LLMPresetId } from '../../types/business';
import './ResponseStyleSelector.css';

// Check if we're on mobile/tablet for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Preset configuration with icons
const PRESET_CONFIG: Record<LLMPresetId, { icon: typeof Target; colorClass: string }> = {
  conservative: { icon: Target, colorClass: 'preset-conservative' },
  balanced: { icon: Zap, colorClass: 'preset-balanced' },
  creative: { icon: Sparkles, colorClass: 'preset-creative' },
};

// Labels are fetched from i18n
const PRESET_LABELS: Record<LLMPresetId, string> = {
  conservative: 'Precise',
  balanced: 'Balanced',
  creative: 'Creative',
};

export interface ResponseStyleSelectorProps {
  /** Current override value, or null to use department default */
  selectedPreset: LLMPresetId | null;
  /** The department's configured preset (shown as default option) */
  departmentPreset: LLMPresetId;
  /** Department name for display */
  departmentName?: string | undefined;
  /** Callback when preset is changed */
  onSelectPreset: (preset: LLMPresetId | null) => void;
  /** Callback to open LLM Hub settings */
  onOpenLLMHub?: (() => void) | undefined;
  /** Disable the selector */
  disabled?: boolean | undefined;
  /** Compact mode - icon only, no label (like Perplexity) */
  compact?: boolean | undefined;
}

export function ResponseStyleSelector({
  selectedPreset,
  departmentPreset,
  departmentName,
  onSelectPreset,
  onOpenLLMHub,
  disabled = false,
  compact = true, // Default to compact (icon only) like Perplexity
}: ResponseStyleSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isMobile = isMobileDevice();

  // Effective preset is either the override or the department default
  const effectivePreset = selectedPreset ?? departmentPreset;
  const isUsingOverride = selectedPreset !== null;
  const config = PRESET_CONFIG[effectivePreset];
  const Icon = config.icon;

  // Get translated label or fallback
  const getLabel = useCallback(
    (presetId: LLMPresetId) => {
      return t(`chat.responseStyle.presets.${presetId}`, PRESET_LABELS[presetId]);
    },
    [t]
  );

  // Handle preset selection
  const handleSelect = useCallback(
    (preset: LLMPresetId | null) => {
      onSelectPreset(preset);
      setOpen(false);
    },
    [onSelectPreset]
  );

  // Handle LLM Hub click
  const handleOpenLLMHub = useCallback(() => {
    setOpen(false);
    onOpenLLMHub?.();
  }, [onOpenLLMHub]);

  // The trigger button
  const triggerButton = (
    <button
      type="button"
      className={cn(
        'response-style-trigger',
        config.colorClass,
        isUsingOverride && 'has-override',
        disabled && 'disabled',
        compact && 'compact'
      )}
      disabled={disabled}
      aria-label={t('chat.responseStyle.label', 'Response style')}
      aria-expanded={open}
    >
      <Icon size={compact ? 14 : 12} className="response-style-icon" />
      {!compact && (
        <>
          <span className="response-style-label">{getLabel(effectivePreset)}</span>
          <ChevronDown size={10} className={cn('response-style-chevron', open && 'open')} />
        </>
      )}
    </button>
  );

  // Dropdown content (shared between popover and bottom sheet)
  const dropdownContent = (
    <div className="response-style-list">
      {/* Department Default Option */}
      <button
        type="button"
        className={cn('response-style-item', 'department-default', !isUsingOverride && 'selected')}
        onClick={() => handleSelect(null)}
      >
        <div className="response-style-item-icon">
          <Building2 size={14} />
        </div>
        <div className="response-style-item-content">
          <span className="response-style-item-label">
            {t('chat.responseStyle.departmentDefault', 'Department Default')}
          </span>
          <span className="response-style-item-desc">
            {departmentName
              ? t('chat.responseStyle.departmentUsing', '{{dept}}: {{preset}}', {
                  dept: departmentName,
                  preset: getLabel(departmentPreset),
                })
              : getLabel(departmentPreset)}
          </span>
        </div>
        {!isUsingOverride && (
          <div className="response-style-item-check">
            <Check size={14} />
          </div>
        )}
      </button>

      {/* Separator */}
      <div className="response-style-separator" />

      {/* Preset Options */}
      {(['conservative', 'balanced', 'creative'] as LLMPresetId[]).map((presetId) => {
        const presetConfig = PRESET_CONFIG[presetId];
        const PresetIcon = presetConfig.icon;
        const isSelected = selectedPreset === presetId;

        return (
          <button
            key={presetId}
            type="button"
            className={cn('response-style-item', presetConfig.colorClass, isSelected && 'selected')}
            onClick={() => handleSelect(presetId)}
          >
            <div className="response-style-item-icon">
              <PresetIcon size={14} />
            </div>
            <div className="response-style-item-content">
              <span className="response-style-item-label">{getLabel(presetId)}</span>
              <span className="response-style-item-desc">
                {t(`chat.responseStyle.descriptions.${presetId}`, '')}
              </span>
            </div>
            {isSelected && (
              <div className="response-style-item-check">
                <Check size={14} />
              </div>
            )}
          </button>
        );
      })}

      {/* LLM Hub Link */}
      {onOpenLLMHub && (
        <>
          <div className="response-style-separator" />
          <button
            type="button"
            className="response-style-item llm-hub-link"
            onClick={handleOpenLLMHub}
          >
            <div className="response-style-item-icon">
              <Settings2 size={14} />
            </div>
            <div className="response-style-item-content">
              <span className="response-style-item-label">
                {t('chat.responseStyle.llmHubLink', 'LLM Hub Settings')}
              </span>
            </div>
          </button>
        </>
      )}
    </div>
  );

  // Wrap trigger with tooltip
  const tooltipContent = isUsingOverride
    ? t('chat.responseStyle.tooltipOverride', 'Override: {{preset}}', {
        preset: getLabel(effectivePreset),
      })
    : t('chat.responseStyle.tooltipDefault', 'Using department default');

  if (isMobile) {
    return (
      <>
        <Tooltip.Provider delayDuration={400}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span onClick={() => !disabled && setOpen(true)}>{triggerButton}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="omni-tooltip" sideOffset={8}>
                {tooltipContent}
                <Tooltip.Arrow className="omni-tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title={t('chat.responseStyle.title', 'Response Style')}
        >
          {dropdownContent}
        </BottomSheet>
      </>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Provider delayDuration={400}>
        <Tooltip.Root>
          <Popover.Trigger asChild>
            <Tooltip.Trigger asChild>{triggerButton}</Tooltip.Trigger>
          </Popover.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="omni-tooltip" sideOffset={8}>
              {tooltipContent}
              <Tooltip.Arrow className="omni-tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Popover.Portal>
        <Popover.Content
          className="response-style-popover"
          align="start"
          sideOffset={8}
          collisionPadding={16}
        >
          {dropdownContent}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
