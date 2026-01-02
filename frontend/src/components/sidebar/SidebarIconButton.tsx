/**
 * SidebarIconButton - Reusable icon button for collapsed sidebar
 *
 * Single source of truth for sidebar icon button styling and behavior.
 * Supports active states and disabled states.
 */

import { ReactNode } from 'react';

interface SidebarIconButtonProps {
  icon: ReactNode;
  title: string;
  onClick?: (() => void) | undefined;
  onMouseEnter?: (() => void) | undefined;
  onMouseLeave?: (() => void) | undefined;
  isActive?: boolean | undefined;
  isPrimary?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function SidebarIconButton({
  icon,
  title,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isActive = false,
  isPrimary = false,
  disabled = false,
  className = '',
}: SidebarIconButtonProps) {
  // Build class list
  const classes = [
    'sidebar-icon-btn',
    isPrimary && 'sidebar-icon-btn--primary',
    isActive && 'sidebar-icon-btn--active',
    disabled && 'sidebar-icon-btn--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      onMouseLeave={disabled ? undefined : onMouseLeave}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}
