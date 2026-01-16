/**
 * Accessibility utilities for keyboard navigation
 *
 * Use these helpers to make non-button elements keyboard accessible
 * when semantic button elements can't be used due to styling/layout constraints.
 */

import type { KeyboardEvent, MouseEvent, SyntheticEvent } from 'react';

/**
 * Flexible callback type that accepts various event handler signatures.
 * Supports handlers that:
 * - Take no arguments: () => void
 * - Take MouseEvent: (e: MouseEvent) => void
 * - Take KeyboardEvent: (e: KeyboardEvent) => void
 * - Take either: (e: MouseEvent | KeyboardEvent) => void
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InteractiveCallback = ((e: any) => void) | (() => void) | undefined;

/**
 * Creates keyboard-accessible props for clickable divs/spans
 *
 * @example
 * // Instead of:
 * <div onClick={handleClick}>Click me</div>
 *
 * // Use:
 * <div {...makeClickable(handleClick)}>Click me</div>
 *
 * // Result:
 * <div
 *   role="button"
 *   tabIndex={0}
 *   onClick={handleClick}
 *   onKeyDown={handleKeyDown}
 * >
 */
export function makeClickable(onClick: InteractiveCallback) {
  if (!onClick) {
    return {};
  }

  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onClick as (e: MouseEvent<HTMLElement>) => void,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // Prevent space from scrolling
        (onClick as (e: SyntheticEvent) => void)(e);
      }
    },
  };
}

/**
 * Keyboard event handler for Enter/Space keys
 *
 * @example
 * <div
 *   role="button"
 *   tabIndex={0}
 *   onClick={handleClick}
 *   onKeyDown={handleKeyPress(handleClick)}
 * >
 */
export function handleKeyPress(callback: InteractiveCallback) {
  if (!callback) {
    return undefined;
  }

  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (callback as (e: SyntheticEvent) => void)(e);
    }
  };
}
