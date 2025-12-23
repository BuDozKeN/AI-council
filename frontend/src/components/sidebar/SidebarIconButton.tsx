/**
 * SidebarIconButton - Reusable icon button for collapsed sidebar
 *
 * Single source of truth for sidebar icon button styling and behavior.
 * Supports badges, active states, and disabled states.
 */

/**
 * @param {Object} props
 * @param {React.ReactNode} props.icon - The icon component to render
 * @param {string} props.title - Tooltip/aria-label text
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onMouseEnter - Mouse enter handler (for hover expansion)
 * @param {Function} props.onMouseLeave - Mouse leave handler (for hover collapse)
 * @param {boolean} props.isActive - Whether button is in active state
 * @param {boolean} props.isPrimary - Whether button uses primary (gradient) styling
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {number|string} props.badge - Optional badge content (e.g., count)
 * @param {string} props.className - Additional CSS classes
 */
export function SidebarIconButton({
  icon,
  title,
  onClick,
  onMouseEnter,
  onMouseLeave,
  isActive = false,
  isPrimary = false,
  disabled = false,
  badge,
  className = '',
}) {
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
      {badge !== undefined && badge !== null && (
        <span className="sidebar-icon-badge">
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
