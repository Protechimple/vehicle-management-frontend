import { useCallback, useEffect, useState } from 'react';
import { platformApi } from '../../api/platformClient';
import { listAll } from '../../api/client';
import { Alert, Pagination, Select, Spinner, Tabs } from '../../components/ui';
import ActivityFeed from './ActivityFeed';
import { PageHeader } from './tenantDisplay';

const PAGE_SIZE = 25;

const CATEGORY_TABS = [
  { value: '', label: 'All' },
  { value: 'signins', label: 'Sign-ins' },
  { value: 'changes', label: 'Changes' },
  { value: 'platform', label: 'Super Admin' },
];

export default function PlatformActivityPage() {
  const [filters, setFilters] = useState({ category: '', tenantId: '', page: 1 });
  const [organizations, setOrganizations] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listAll(platformApi.listTenants, { sort: 'organizationName:asc' })
      .then(({ data }) => {
        if (!cancelled) setOrganizations(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (current) => {
    setError(null);
    try {
      setResult(await platformApi.activity({ ...current, limit: PAGE_SIZE }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  return (
    <div>
      <PageHeader title="Activity" description="Everything recorded across all organizations, newest first." />

      <Alert tone="error">{error}</Alert>

      <div className="rounded border border-steel-200 bg-surface">
        <div className="flex flex-col gap-3 px-5 pt-4 md:flex-row md:items-start md:justify-between">
          <Tabs
            tabs={CATEGORY_TABS}
            active={filters.category}
            onChange={(category) => setFilters((f) => ({ ...f, category, page: 1 }))}
          />
          <div className="md:w-72">
            <Select
              aria-label="Organization"
              value={filters.tenantId}
              onChange={(e) => setFilters((f) => ({ ...f, tenantId: e.target.value, page: 1 }))}
            >
              <option value="">All organizations</option>
              {organizations.map((org) => (
                <option key={org.tenantId} value={org.tenantId}>
                  {org.organizationName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {!result ? (
          <Spinner label="Loading activity" />
        ) : (
          <>
            <ActivityFeed
              entries={result.data}
              showOrganization={!filters.tenantId}
              emptyMessage="Nothing recorded for these filters."
            />
            {result.pagination.total > 0 && (
              <Pagination
                page={result.pagination.page}
                pages={result.pagination.pages}
                total={result.pagination.total}
                pageSize={PAGE_SIZE}
                showPageNumbers
                onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
