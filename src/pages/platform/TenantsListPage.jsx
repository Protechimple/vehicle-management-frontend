import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApi } from '../../api/platformClient';
import { Alert, Button, Input, Pagination, Spinner, Table } from '../../components/ui';
import { Initials, PageHeader, TenantStatusBadge, formatDateTime, formatRelative } from './tenantDisplay';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

function StatusFilter({ value, onChange }) {
  return (
    <div role="group" aria-label="Status" className="inline-flex rounded border border-steel-200 bg-surface p-0.5">
      {STATUS_FILTERS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'rounded px-3 py-1 text-sm font-semibold transition-colors',
            value === option.value ? 'bg-accent text-white' : 'text-steel-600 hover:bg-steel-100',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function TenantsListPage() {
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [changingId, setChangingId] = useState(null);

  const load = useCallback(async (current) => {
    setError(null);
    try {
      setResult(await platformApi.listTenants({ ...current, limit: PAGE_SIZE }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  async function toggleStatus(tenant) {
    setChangingId(tenant.tenantId);
    setError(null);
    try {
      await platformApi.setTenantStatus(tenant.tenantId, tenant.status === 'active' ? 'suspended' : 'active');
      await load(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingId(null);
    }
  }

  const columns = [
    {
      key: 'organizationName',
      label: 'Organization',
      render: (t) => (
        <Link to={`/platform/tenants/${t.tenantId}`} className="group flex items-center gap-3">
          <Initials name={t.organizationName} />
          <span className="min-w-0 leading-tight">
            <span className="block font-semibold text-steel-900 group-hover:text-brand-600 group-hover:underline">
              {t.organizationName}
            </span>
            <span className="block max-w-56 truncate text-xs text-steel-500">{t.address ?? t.email}</span>
          </span>
        </Link>
      ),
    },
    {
      key: 'admin',
      label: 'Admin',
      render: (t) =>
        t.admin ? (
          <div className="leading-tight">
            <p className="text-steel-900">{t.admin.name}</p>
            <p className="max-w-56 truncate text-xs text-steel-500">{t.admin.email}</p>
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'status', label: 'Status', render: (t) => <TenantStatusBadge status={t.status} /> },
    {
      key: 'lastActivity',
      label: 'Last activity',
      render: (t) => (
        <span title={formatDateTime(t.lastActivityAt)} className={t.lastActivityAt ? 'text-steel-900' : 'text-warning-600'}>
          {t.lastActivityAt ? formatRelative(t.lastActivityAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-2">
          <Button as={Link} to={`/platform/tenants/${t.tenantId}`} variant="secondary" size="sm">
            Open
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={changingId === t.tenantId}
            onClick={() => toggleStatus(t)}
            className={t.status === 'active' ? 'text-danger-600 hover:text-danger-600' : 'text-brand-600'}
          >
            {t.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Every organization on VMMS. Only a Super Admin can create one."
        actions={
          <Button as={Link} to="/platform/tenants/new">
            + Create organization
          </Button>
        }
      />

      <Alert tone="error">{error}</Alert>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13.5 13.5 3 3" />
          </svg>
          <Input
            aria-label="Search organizations"
            placeholder="Search name, email or ID"
            className="bg-surface pl-9"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          />
        </div>
        <StatusFilter value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))} />
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading organizations" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(t) => t.tenantId}
              emptyMessage={filters.search || filters.status ? 'No organizations match these filters.' : 'No organizations yet.'}
            />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              pageSize={PAGE_SIZE}
              showPageNumbers
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
