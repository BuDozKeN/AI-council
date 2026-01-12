/**
 * LLMPresetSelect - Select component for LLM behavior presets
 *
 * Uses Radix Popover for desktop and BottomSheet for mobile.
 * Matches ResponseStyleSelector design for consistency.
 * Includes link to LLM Hub for customization.
 *
 * Usage:
 * <LLMPresetSelect
 *   value={selectedPreset}
 *   onValueChange={setSelectedPreset}
 *   onOpenLLMHub={() => openSettings('llm-hub')}
 * />
 */

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, ChevronDown, Target, Zap, Sparkles, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import { LLM_PRESETS, type LLMPresetId, type LLMPreset } from '../../types/business';
import './Tooltip.css';
import './LLMPresetSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Preset configuration with icons - matches ResponseStyleSelector
const PRESET_CONFIG: Record<LLMPresetId, { icon: typeof Target; colorClass: string }> = {
  conservative: { icon: Target, colorClass: 'preset-conservative' },
  balanced: { icon: Zap, colorClass: 'preset-balanced' },
  creative: { icon: Sparkles, colorClass: 'preset-creative' },
};

// Preset colors for trigger button
const PRESET_COLORS: Record<LLMPresetId, { bg: string; text: string; border: string }> = {
  conservative: {
    bg: 'var(--color-blue-50)',
    text: 'var(--color-blue-700)',
    border: 'var(--color-blue-200)',
  },
  balanced: {
    bg: 'var(--color-amber-50)',
    text: 'var(--color-amber-700)',
    border: 'var(--color-amber-200)',
  },
  creative: {
    bg: 'var(--color-purple-50)',
    text: 'var(--color-purple-700)',
    border: 'var(--color-purple-200)',
  },
};

interface LLMPresetSelectProps {
  value: LLMPresetId | undefined;
  onValueChange: (value: LLMPresetId) => void;
  disabled?: boolean;
  className?: string;
  showDescription?: boolean;
  /** Callback to open LLM Hub settings */
  onOpenLLMHub?: (() => void) | undefined;
}

export function LLMPresetSelect({
  value,
  onValueChange,
  disabled = false,
  className,
  showDescription = true,
  onOpenLLMHub,
}: LLMPresetSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  // Get current preset info - default to balanced (index 1)
  const defaultPreset = LLM_PRESETS[1]!; // balanced is always at index 1
  const selectedPreset = LLM_PRESETS.find((p: LLMPreset) => p.id === value) ?? defaultPreset;
  const selectedConfig = PRESET_CONFIG[selectedPreset.id];
  const selectedColor = PRESET_COLORS[selectedPreset.id]!;
  const SelectedIcon = selectedConfig.icon;

  const handleSelect = (presetId: string) => {
    onValueChange(presetId as LLMPresetId);
    setOpen(false);
  };

  const handleOpenLLMHub = React.useCallback(() => {
    setOpen(false);
    onOpenLLMHub?.();
  }, [onOpenLLMHub]);

  // Dropdown content (shared between popover and bottom sheet)
  const dropdownContent = (
    <div className="llm-preset-list">
      {LLM_PRESETS.map((preset: LLMPreset) => {
        const isSelected = preset.id === value;
        const config = PRESET_CONFIG[preset.id];
        const PresetIcon = config.icon;

        return (
          <button
            key={preset.id}
            type="button"
            className={cn('llm-preset-item', config.colorClass, isSelected && 'selected')}
            onClick={() => handleSelect(preset.id)}
          >
            <div className="llm-preset-item-icon">
              <PresetIcon size={14} />
            </div>
            <div className="llm-preset-item-content">
              <span className="llm-preset-item-name">{preset.name}</span>
              {showDescription && (
                <span className="llm-preset-item-desc">{preset.description}</span>
              )}
            </div>
            {isSelected && (
              <div className="llm-preset-item-check">
                <Check size={14} />
              </div>
            )}
          </button>
        );
      })}

      {/* LLM Hub Link */}
      {onOpenLLMHub && (
        <>
          <div className="llm-preset-separator" />
          <button type="button" className="llm-preset-item llm-hub-link" onClick={handleOpenLLMHub}>
            <div className="llm-preset-item-icon llm-hub-icon">
              <Settings2 size={14} />
            </div>
            <div className="llm-preset-item-content">
              <span className="llm-preset-item-name">
                {t('chat.responseStyle.llmHubLink', 'LLM Hub Settings')}
              </span>
              <span className="llm-preset-item-desc">
                {t('chat.responseStyle.llmHubDesc', 'Customize AI models and behavior')}
              </span>
            </div>
          </button>
        </>
      )}
    </div>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('llm-preset-trigger', selectedConfig.colorClass, className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          style={{
            background: selectedColor.bg,
            color: selectedColor.text,
            borderColor: selectedColor.border,
          }}
          type="button"
        >
          <SelectedIcon size={14} className="llm-preset-trigger-icon" />
          <span>{selectedPreset.name}</span>
          <ChevronDown size={14} className="llm-preset-chevron" />
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title={t('modals.responseStyle', 'Response Style')}
        >
          {dropdownContent}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Radix Popover
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                className={cn('llm-preset-trigger', selectedConfig.colorClass, className)}
                disabled={disabled}
                style={{
                  background: selectedColor.bg,
                  color: selectedColor.text,
                  borderColor: selectedColor.border,
                }}
                type="button"
              >
                <SelectedIcon size={14} className="llm-preset-trigger-icon" />
                <span>{selectedPreset.name}</span>
                <ChevronDown size={14} className={cn('llm-preset-chevron', open && 'open')} />
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="tooltip-content" sideOffset={8}>
              {selectedPreset.description}
              <Tooltip.Arrow className="tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
          <Popover.Portal>
            <Popover.Content
              className="llm-preset-popover"
              side="bottom"
              align="start"
              sideOffset={4}
            >
              {dropdownContent}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export default LLMPresetSelect;
