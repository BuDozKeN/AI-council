/**
 * LLMPresetSelect - Select component for LLM behavior presets
 *
 * Uses Radix Select for desktop and BottomSheet for mobile.
 * Follows the DepartmentSelect pattern for consistency.
 *
 * Usage:
 * <LLMPresetSelect
 *   value={selectedPreset}
 *   onValueChange={setSelectedPreset}
 *   disabled={false}
 * />
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, ChevronDown, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import { LLM_PRESETS, type LLMPresetId, type LLMPreset } from '../../types/business';
import './LLMPresetSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Preset colors for visual differentiation - using design system tokens
const PRESET_COLORS: Record<LLMPresetId, { bg: string; text: string; border: string }> = {
  conservative: {
    bg: 'var(--color-blue-50)',
    text: 'var(--color-blue-700)',
    border: 'var(--color-blue-200)',
  },
  balanced: {
    bg: 'var(--color-gray-100)',
    text: 'var(--color-gray-700)',
    border: 'var(--color-gray-300)',
  },
  creative: {
    bg: 'var(--color-purple-100)',
    text: 'var(--color-purple-600)',
    border: 'var(--color-purple-200)',
  },
};

interface LLMPresetSelectProps {
  value: LLMPresetId | undefined;
  onValueChange: (value: LLMPresetId) => void;
  disabled?: boolean;
  className?: string;
  showDescription?: boolean;
}

export function LLMPresetSelect({
  value,
  onValueChange,
  disabled = false,
  className,
  showDescription = true,
}: LLMPresetSelectProps) {
  const [open, setOpen] = React.useState(false);

  // Get current preset info - default to balanced (index 1)
  const defaultPreset = LLM_PRESETS[1]!; // balanced is always at index 1
  const selectedPreset = LLM_PRESETS.find((p: LLMPreset) => p.id === value) ?? defaultPreset;
  const selectedColor = PRESET_COLORS[selectedPreset.id]!;

  const handleSelect = (presetId: string) => {
    onValueChange(presetId as LLMPresetId);
    setOpen(false);
  };

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('llm-preset-trigger', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          style={{
            background: selectedColor.bg,
            color: selectedColor.text,
            borderColor: selectedColor.border,
          }}
          type="button"
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>{selectedPreset.name}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="LLM Behavior Preset">
          <div className="llm-preset-list-mobile">
            {LLM_PRESETS.map((preset: LLMPreset) => {
              const isSelected = preset.id === value;
              const colors = PRESET_COLORS[preset.id]!;
              return (
                <button
                  key={preset.id}
                  className={cn('llm-preset-item-mobile', isSelected && 'selected')}
                  onClick={() => handleSelect(preset.id)}
                  style={
                    {
                      '--preset-bg': colors.bg,
                      '--preset-text': colors.text,
                      '--radio-checked-bg': colors.text,
                      '--radio-checked-border': colors.text,
                    } as React.CSSProperties
                  }
                  type="button"
                >
                  <div className={cn('llm-preset-radio', isSelected && 'checked')}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="llm-preset-item-content">
                    <span className="llm-preset-item-name">{preset.name}</span>
                    {showDescription && (
                      <span className="llm-preset-item-desc">{preset.description}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Radix Select with tooltip
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <SelectPrimitive.Root
          value={value || 'balanced'}
          onValueChange={(v) => onValueChange(v as LLMPresetId)}
          disabled={disabled}
        >
          <Tooltip.Trigger asChild>
            <SelectPrimitive.Trigger
              className={cn('llm-preset-trigger', className)}
              style={{
                background: selectedColor.bg,
                color: selectedColor.text,
                borderColor: selectedColor.border,
              }}
            >
              <Cpu className="h-3.5 w-3.5" />
              <SelectPrimitive.Value>{selectedPreset.name}</SelectPrimitive.Value>
              <SelectPrimitive.Icon asChild>
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="omni-tooltip" sideOffset={8}>
              {selectedPreset.description}
              <Tooltip.Arrow className="omni-tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className="llm-preset-content"
              position="popper"
              side="bottom"
              align="start"
              sideOffset={4}
            >
              <SelectPrimitive.Viewport className="llm-preset-viewport">
                {LLM_PRESETS.map((preset: LLMPreset) => {
                  const colors = PRESET_COLORS[preset.id]!;
                  return (
                    <SelectPrimitive.Item
                      key={preset.id}
                      value={preset.id}
                      className="llm-preset-item"
                      style={
                        {
                          '--preset-hover-bg': colors.bg,
                          '--preset-checked-bg': colors.bg,
                          '--preset-checked-text': colors.text,
                        } as React.CSSProperties
                      }
                    >
                      <div className="llm-preset-item-content">
                        <span className="llm-preset-item-name">
                          <SelectPrimitive.ItemText>{preset.name}</SelectPrimitive.ItemText>
                        </span>
                        {showDescription && (
                          <span className="llm-preset-item-desc">{preset.description}</span>
                        )}
                      </div>
                      <span className="llm-preset-item-indicator">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="h-4 w-4" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                    </SelectPrimitive.Item>
                  );
                })}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export default LLMPresetSelect;
