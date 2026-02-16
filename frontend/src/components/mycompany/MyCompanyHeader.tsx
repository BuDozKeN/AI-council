import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { handleKeyPress } from '../../utils/a11y';

interface Company {
  id: string;
  name: string;
}

interface MyCompanyHeaderProps {
  companyName?: string | undefined;
  companyId: string;
  allCompanies: Company[];
  pendingDecisionsCount: number | null;
  onSelectCompany?: ((companyId: string) => void) | undefined;
  onClose?: (() => void) | undefined;
  onHeaderClick?: (() => void) | undefined;
}

/**
 * MyCompanyHeader - Header with company name, status indicator, and company switcher
 *
 * ISS-221: Avoid nested buttons - move company switcher outside the clickable dismiss area
 * ISS-238: Status indicator now has visible text for clarity
 */
export function MyCompanyHeader({
  companyName,
  companyId,
  allCompanies,
  pendingDecisionsCount,
  onSelectCompany,
  onClose,
  onHeaderClick,
}: MyCompanyHeaderProps) {
  const { t } = useTranslation();

  // ISS-238: Generate human-readable status text
  const statusText =
    pendingDecisionsCount === 0
      ? t('myCompany.statusAllGood', 'All decisions promoted')
      : pendingDecisionsCount !== null && pendingDecisionsCount > 0
        ? t('myCompany.statusPending', '{{count}} pending', { count: pendingDecisionsCount })
        : '';

  const statusClass =
    pendingDecisionsCount === 0
      ? 'all-good'
      : pendingDecisionsCount !== null && pendingDecisionsCount > 0
        ? 'pending'
        : '';

  return (
    <header className="mc-header mc-header-dismissible">
      {/* ISS-221: Dismiss area is a separate element that doesn't contain buttons */}
      <div
        className="mc-header-dismissible-target"
        onClick={onHeaderClick}
        onKeyDown={handleKeyPress(onHeaderClick)}
        role="button"
        tabIndex={0}
        aria-label={t('myCompany.tapToClose', 'Tap to close')}
      >
        <div className="mc-dismiss-hint">
          <ChevronDown size={16} />
          <span>{t('myCompany.tapToClose', 'tap to close')}</span>
        </div>
      </div>
      {/* ISS-221: Header content is now separate from the dismiss button area */}
      <div className="mc-header-content">
        <div className="mc-title-row">
          {/* ISS-238: Status indicator with visible text for clarity */}
          {statusClass && (
            <span
              className={`mc-status-indicator ${statusClass}`}
              aria-label={statusText}
              title={statusText}
            >
              <span className="mc-status-dot" aria-hidden="true" />
              <span className="mc-status-text">{statusText}</span>
            </span>
          )}
          <h1>{companyName || 'Your Company'}</h1>
        </div>
        {/* Company switcher - now outside the dismiss button area (ISS-221) */}
        <div className="mc-company-switcher">
          {allCompanies.length > 1 ? (
            <Select
              value={companyId}
              onValueChange={(val) => {
                if (val !== companyId) onSelectCompany?.(val);
              }}
            >
              <SelectTrigger className="mc-company-select-trigger">
                <Building2 size={16} />
                <SelectValue placeholder={t('myCompany.switchCompany', 'Switch company')} />
              </SelectTrigger>
              <SelectContent>
                {allCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="mc-company-display">
              <Building2 size={16} />
              <span>{companyName || 'Your Company'}</span>
            </div>
          )}
        </div>
      </div>
      <button
        className="mc-mobile-back-btn"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onClose?.();
        }}
        aria-label={t('myCompany.closeMyCompany', 'Close My Company')}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        className="mc-close-btn"
        aria-label={t('common.close', 'Close')}
        title={t('common.close', 'Close')}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        &times;
      </button>
    </header>
  );
}
