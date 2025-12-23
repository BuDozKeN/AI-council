import { ChevronLeft } from 'lucide-react';
import './MobileHeader.css';

/**
 * MobileHeader - Reusable mobile header with back button
 *
 * Provides consistent mobile navigation across the app.
 * Shows back button on left, title in center, optional actions on right.
 *
 * @param {string} title - Header title
 * @param {Function} onBack - Callback when back button clicked
 * @param {string} backLabel - Label for back button (default: "Back")
 * @param {ReactNode} actions - Optional actions on right side
 * @param {boolean} sticky - Whether header should be sticky (default: true)
 * @param {string} className - Additional CSS classes
 */
export function MobileHeader({
  title,
  onBack,
  backLabel = "Back",
  actions,
  sticky = true,
  className = "",
}) {
  return (
    <div className={`mobile-header ${sticky ? 'sticky' : ''} ${className}`}>
      <button
        className="mobile-header-back"
        onClick={onBack}
        aria-label={backLabel}
      >
        <ChevronLeft size={20} />
        <span>{backLabel}</span>
      </button>

      <h1 className="mobile-header-title">{title}</h1>

      {actions && (
        <div className="mobile-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}

export default MobileHeader;
