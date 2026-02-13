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
import { toast } from '../ui/sonner';
import type { LLMPresetId } from '../../types/business';
import '../ui/Tooltip.css';
import styles from './ResponseStyleSelector.module.css';

// Check if we're on mobile/tablet for bottom sheet vs popover
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Preset configuration with icons
const PRESET_CONFIG: Record<LLMPresetId, { icon: typeof Target; colorClass: string | undefined }> =
  {
    conservative: { icon: Target, colorClass: styles.presetConservative },
    balanced: { icon: Zap, colorClass: styles.presetBalanced },
    creative: { icon: Sparkles, colorClass: styles.presetCreative },
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

  // Handle preset selection — show toast on mobile so users know what changed
  const handleSelect = useCallback(
    (preset: LLMPresetId | null) => {
      onSelectPreset(preset);
      setOpen(false);
      if (isMobile) {
        const label = preset ? getLabel(preset) : t('chat.responseStyle.departmentDefault', 'Department Default');
        toast.info(
          t('chat.responseStyle.switched', 'Response style: {{style}}', { style: label }),
          { duration: 3000 }
        );
      }
    },
    [onSelectPreset, isMobile, getLabel, t]
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
        styles.trigger,
        config.colorClass,
        isUsingOverride && styles.hasOverride,
        disabled && styles.disabled,
        compact && styles.compact
      )}
      disabled={disabled}
      aria-label={t('chat.responseStyle.label', 'Response style')}
      aria-expanded={open}
    >
      <Icon size={compact ? 14 : 12} className={styles.icon} />
      {!compact && (
        <>
          <span className={styles.label}>{getLabel(effectivePreset)}</span>
          <ChevronDown size={10} className={cn(styles.chevron, open && styles.open)} />
        </>
      )}
    </button>
  );

  // Dropdown content (shared between popover and bottom sheet)
  const dropdownContent = (
    <div className={styles.list}>
      {/* Title heading - ISS-077 */}
      <div className={styles.title}>{t('chat.responseStyle.title', 'Response Style')}</div>

      {/* Department Default Option */}
      <label
        className={cn(styles.item, styles.departmentDefault, !isUsingOverride && styles.selected)}
      >
        <input
          type="radio"
          name="response-style"
          value="department-default"
          checked={!isUsingOverride}
          onChange={() => handleSelect(null)}
          className={styles.radio}
          aria-label={t('chat.responseStyle.departmentDefault', 'Department Default')}
        />
        <div
          className={styles.itemIcon}
          title={t('chat.responseStyle.usesDefault', 'Uses department defaults')}
        >
          <Building2 size={14} aria-hidden="true" />
        </div>
        <div className={styles.itemContent}>
          <span className={styles.itemLabel}>
            {t('chat.responseStyle.departmentDefault', 'Department Default')}
          </span>
          <span className={styles.itemDesc}>
            {/* ISS-078: Clarify this is an auto-inherited setting */}
            {t('chat.responseStyle.inheritFromDept', 'Auto: uses {{dept}} settings', {
              dept: departmentName || t('common.department', 'department'),
            })}
          </span>
        </div>
        {!isUsingOverride && (
          <div className={styles.itemCheck} aria-hidden="true">
            <Check size={14} />
          </div>
        )}
      </label>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Preset Options */}
      {(['conservative', 'balanced', 'creative'] as LLMPresetId[]).map((presetId) => {
        const presetConfig = PRESET_CONFIG[presetId];
        const PresetIcon = presetConfig.icon;
        const isSelected = selectedPreset === presetId;

        const iconTooltips: Record<LLMPresetId, string> = {
          conservative: t('chat.responseStyle.tooltip.precise', 'Precise and focused'),
          balanced: t('chat.responseStyle.tooltip.balanced', 'Balanced approach'),
          creative: t('chat.responseStyle.tooltip.creative', 'Creative and imaginative'),
        };

        return (
          <label
            key={presetId}
            className={cn(styles.item, presetConfig.colorClass, isSelected && styles.selected)}
          >
            <input
              type="radio"
              name="response-style"
              value={presetId}
              checked={isSelected}
              onChange={() => handleSelect(presetId)}
              className={styles.radio}
              aria-label={getLabel(presetId)}
            />
            <div className={styles.itemIcon} title={iconTooltips[presetId]}>
              <PresetIcon size={14} aria-hidden="true" />
            </div>
            <div className={styles.itemContent}>
              <span className={styles.itemLabel}>{getLabel(presetId)}</span>
              <span className={styles.itemDesc}>
                {t(`chat.responseStyle.descriptions.${presetId}`, '')}
              </span>
            </div>
            {isSelected && (
              <div className={styles.itemCheck} aria-hidden="true">
                <Check size={14} />
              </div>
            )}
          </label>
        );
      })}

      {/* LLM Hub Link */}
      {onOpenLLMHub && (
        <>
          <div className={styles.separator} />
          <button
            type="button"
            className={cn(styles.item, styles.llmHubLink)}
            onClick={handleOpenLLMHub}
            title={t('chat.responseStyle.llmHubTooltip', 'Configure LLM models and presets')}
          >
            <div className={styles.itemIcon}>
              <Settings2 size={14} aria-hidden="true" />
            </div>
            <div className={styles.itemContent}>
              <span className={styles.itemLabel}>
                {t('chat.responseStyle.llmHubLink', 'LLM Hub Settings')}
              </span>
            </div>
          </button>
        </>
      )}
    </div>
  );

  // Wrap trigger with tooltip - mum-friendly: explain WHAT it does, not just current state
  const tooltipContent = isUsingOverride
    ? t(
        'chat.responseStyle.tooltipOverride',
        'AI is set to {{preset}} mode - click to change how creative the responses are',
        {
          preset: getLabel(effectivePreset),
        }
      )
    : t(
        'chat.responseStyle.tooltipDefault',
        "Click to control how creative vs precise the AI's answers are"
      );

  if (isMobile) {
    // Mobile: use button directly with onClick to open BottomSheet
    // This avoids nested interactive elements (button inside span with makeClickable)
    return (
      <>
        <Tooltip.Provider delayDuration={400}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className={cn(
                  styles.trigger,
                  config.colorClass,
                  isUsingOverride && styles.hasOverride,
                  disabled && styles.disabled,
                  compact && styles.compact
                )}
                disabled={disabled}
                onClick={() => !disabled && setOpen(true)}
                aria-label={t('chat.responseStyle.label', 'Response style')}
                aria-expanded={open}
              >
                <Icon size={compact ? 14 : 12} className={styles.icon} />
                {!compact && (
                  <>
                    <span className={styles.label}>{getLabel(effectivePreset)}</span>
                    <ChevronDown size={10} className={cn(styles.chevron, open && styles.open)} />
                  </>
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" sideOffset={8}>
                {tooltipContent}
                <Tooltip.Arrow className="tooltip-arrow" />
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
            <Tooltip.Content className="tooltip-content" sideOffset={8}>
              {tooltipContent}
              <Tooltip.Arrow className="tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
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
