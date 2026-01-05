/**
 * RangeSlider - Custom range input component
 *
 * A thin, elegant slider with a draggable thumb.
 * Shows value tooltip on hover/drag.
 * Built from scratch for consistent cross-browser behavior.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import './RangeSlider.css';

interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Format the value for display in tooltip. Default shows 2 decimal places. */
  formatValue?: (value: number) => string;
  /** Label to show after the value (e.g., "temp", "%"). */
  valueLabel?: string;
}

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
  formatValue = (v) => v.toFixed(2),
  valueLabel = '',
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Calculate percentage position
  const percentage = ((value - min) / (max - min)) * 100;

  // Show tooltip when hovering or dragging
  const showTooltip = isHovering || isDragging;

  // Convert pixel position to value
  const positionToValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;

      const rect = track.getBoundingClientRect();
      const x = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const rawValue = min + percent * (max - min);

      // Snap to step
      const stepped = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step, value]
  );

  // Handle mouse/touch start
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);

      const newValue = positionToValue(e.clientX);
      if (newValue !== value) {
        onChange(newValue);
      }

      // Capture pointer for smooth dragging
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, positionToValue, onChange, value]
  );

  // Handle drag
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || disabled) return;

      const newValue = positionToValue(e.clientX);
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [isDragging, disabled, positionToValue, onChange, value]
  );

  // Handle release
  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      let newValue = value;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          newValue = Math.min(max, value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue = Math.max(min, value - step);
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
        default:
          return;
      }

      e.preventDefault();
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [disabled, value, min, max, step, onChange]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => setIsDragging(false);
  }, []);

  return (
    <div
      className={`range-slider ${isDragging ? 'range-slider--dragging' : ''} ${disabled ? 'range-slider--disabled' : ''} ${className}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={trackRef}
        className="range-slider__track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="range-slider__thumb" style={{ left: `${percentage}%` }}>
          {showTooltip && (
            <div className="range-slider__tooltip">
              {formatValue(value)}
              {valueLabel && ` ${valueLabel}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
