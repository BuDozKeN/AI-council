/**
 * Accessibility utilities for keyboard navigation
 *
 * Use these helpers to make non-button elements keyboard accessible
 * when semantic button elements can't be used due to styling/layout constraints.
 */

import type { KeyboardEvent, MouseEvent } from 'react';

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
export function makeClickable(
  onClick: (e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void
) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // Prevent space from scrolling
        onClick(e);
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
export function handleKeyPress(
  callback: (e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void
) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback(e);
    }
  };
}
