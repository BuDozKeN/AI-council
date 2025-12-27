import { ChevronDown, ChevronLeft, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
  return (
    <header
      className="mc-header mc-header-dismissible"
      onClick={onHeaderClick}
      role="button"
      tabIndex={0}
      aria-label="Click to close, or press Escape"
    >
      <button
        className="mc-mobile-back-btn"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose?.(); }}
        aria-label="Close My Company"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="mc-dismiss-hint">
        <ChevronDown size={16} />
        <span>tap to close</span>
      </div>
      <div className="mc-header-content">
        <div className="mc-title-row">
          <h1>
            <span
              className={`mc-status-indicator ${pendingDecisionsCount === 0 ? 'all-good' : pendingDecisionsCount !== null && pendingDecisionsCount > 0 ? 'pending' : ''}`}
              title={
                pendingDecisionsCount === 0
                  ? 'All decisions promoted'
                  : pendingDecisionsCount !== null && pendingDecisionsCount > 0
                    ? `${pendingDecisionsCount} pending decision${pendingDecisionsCount !== 1 ? 's' : ''}`
                    : 'Loading...'
              }
            />
            {companyName || 'Your Company'}
          </h1>
          <span className="mc-title-suffix">Command Center</span>
        </div>
        {allCompanies.length > 1 && (
          <div className="mc-company-switcher">
            <Select
              value={companyId}
              onValueChange={(val) => { if (val !== companyId) onSelectCompany?.(val); }}
            >
              <SelectTrigger className="mc-company-select-trigger">
                <Building2 size={14} />
                <SelectValue placeholder="Switch company" />
              </SelectTrigger>
              <SelectContent>
                {allCompanies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <button className="mc-close-btn" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose?.(); }}>&times;</button>
    </header>
  );
}
