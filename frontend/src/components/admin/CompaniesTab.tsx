/**
 * CompaniesTab - Company management tab
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, Mail, MessageSquare, Calendar } from 'lucide-react';
import { api } from '../../api';
import type { AdminCompanyInfo } from '../../api';
import { SortableTableHeader } from './SortableTableHeader';
import { useSortState, sortData } from './tableSortUtils';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { SkeletonCell, Pagination } from './adminUtils';
import { formatDate } from './adminConstants';

// =============================================================================
// Skeleton
// =============================================================================

const CompaniesTableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell />
        <SkeletonCell />
        <SkeletonCell short />
        <SkeletonCell short />
      </tr>
    ))}
  </>
);

// =============================================================================
// DUMMY DATA
// =============================================================================

const DUMMY_COMPANIES: AdminCompanyInfo[] = [
  {
    id: 'demo-company-1',
    name: 'TechCorp Solutions',
    owner_email: 'ozpaniard+techcorp@gmail.com',
    user_count: 12,
    conversation_count: 47,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-2',
    name: 'StartupHub Inc',
    owner_email: 'ozpaniard+startup@gmail.com',
    user_count: 5,
    conversation_count: 23,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-3',
    name: 'Enterprise Global',
    owner_email: 'ozpaniard+enterprise@gmail.com',
    user_count: 45,
    conversation_count: 156,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-4',
    name: 'Creative Agency Co',
    owner_email: 'ozpaniard+agency@gmail.com',
    user_count: 3,
    conversation_count: 12,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-5',
    name: 'Consulting Partners',
    owner_email: 'ozpaniard+consulting@gmail.com',
    user_count: 8,
    conversation_count: 89,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// =============================================================================
// Component
// =============================================================================

export function CompaniesTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sort state for companies table
  type CompanySortColumn = 'name' | 'owner' | 'conversations' | 'created_at';
  const [companySortState, setCompanySortState] = useSortState<CompanySortColumn>(
    'created_at',
    'desc'
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'companies', { page, search }],
    queryFn: () =>
      api.listAdminCompanies({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
      }),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiCompanies = data?.companies ?? [];
  const useDummyData = error || (apiCompanies.length === 0 && !isLoading);

  const filteredDummyData = useDummyData
    ? DUMMY_COMPANIES.filter((company) => {
        const matchesSearch = !search || company.name.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      })
    : [];

  // Apply sorting
  const companySortGetters: Record<
    CompanySortColumn,
    (c: AdminCompanyInfo) => string | number | null
  > = {
    name: (c) => c.name.toLowerCase(),
    owner: (c) => c.owner_email?.toLowerCase() ?? '',
    conversations: (c) => c.conversation_count,
    created_at: (c) => new Date(c.created_at).getTime(),
  };

  const unsortedCompanies = useDummyData ? filteredDummyData : apiCompanies;
  const companies = sortData(unsortedCompanies, companySortState, companySortGetters);
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Keyboard navigation for companies table
  const { tableBodyRef: companiesTableBodyRef, getRowProps: getCompanyRowProps } =
    useTableKeyboardNav({
      rowCount: companies.length,
    });

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">
            {t('admin.companies.title', 'Company Management')}
          </h2>
          <p className="admin-section-desc">
            {t('admin.companies.description', 'View and manage all companies on the platform.')}
          </p>
        </div>
        <div className="admin-search-box">
          <Search className="admin-search-icon h-4 w-4" />
          <input
            type="text"
            placeholder={t('admin.companies.searchPlaceholder', 'Search by name...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-search-input"
          />
        </div>
      </div>

      {!isLoading && companies.length === 0 ? (
        <div className="admin-table-empty">
          <Building2 className="h-8 w-8" />
          <span>{t('admin.companies.noCompanies', 'No companies found')}</span>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table
              className="admin-table"
              aria-label={t('admin.companies.title', 'Companies List')}
            >
              <caption className="sr-only">
                {t(
                  'admin.companies.tableCaption',
                  'List of all companies with owner information and conversation count'
                )}
              </caption>
              <thead>
                <tr>
                  <SortableTableHeader
                    column="name"
                    label={t('admin.companies.name', 'Company Name')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                  <SortableTableHeader
                    column="owner"
                    label={t('admin.companies.owner', 'Owner')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                  <SortableTableHeader
                    column="conversations"
                    label={t('admin.companies.conversations', 'Conversations')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                  <SortableTableHeader
                    column="created_at"
                    label={t('admin.companies.createdAt', 'Created')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                </tr>
              </thead>
              <tbody ref={companiesTableBodyRef}>
                {isLoading ? (
                  <CompaniesTableSkeleton />
                ) : (
                  companies.map((company: AdminCompanyInfo, rowIndex: number) => (
                    <tr
                      key={company.id}
                      className={useDummyData ? 'admin-demo-row' : ''}
                      {...getCompanyRowProps(rowIndex)}
                      aria-label={`${company.name}, Owner: ${company.owner_email || 'Unknown'}, Conversations: ${company.conversation_count}, Created: ${formatDate(company.created_at)}`}
                    >
                      <td>
                        <div className="admin-company-cell">
                          <Building2 className="h-4 w-4" aria-hidden="true" />
                          <span>{company.name}</span>
                          {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                        </div>
                      </td>
                      <td>
                        <div className="admin-user-cell">
                          <Mail className="h-4 w-4" aria-hidden="true" />
                          <span>{company.owner_email || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-count-cell">
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          <span>{company.conversation_count}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-date-cell">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          <span>{formatDate(company.created_at)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
