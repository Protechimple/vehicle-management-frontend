import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { vehiclesApi } from '../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../components/ui';
import Can from '../components/Can';
import { useAuth } from '../context/AuthContext';
import useSiteNames from '../hooks/useSiteNames';
import AssetPhoto from '../components/AssetPhoto';
import { DOCUMENT_LABELS } from '../config/assetDocuments';

const STATUS_OPTIONS = [
  { value: '', label: 'Active (default)' },
  { value: 'archived', label: 'Archived' },
];

const DOCUMENT_FILTER_OPTIONS = [
  { value: '', label: 'Any documents' },
  { value: 'true', label: 'Documents missing' },
];

function MissingDocsBadge({ vehicle }) {
  if (!vehicle.missingDocTypes?.length) return null;
  return (
    <Badge tone="danger">{vehicle.missingDocTypes.map((docType) => DOCUMENT_LABELS[docType] ?? docType).join(', ')} missing</Badge>
  );
}

function ServiceDueBadge({ vehicle }) {
  if (!vehicle.isServiceDue) return null;
  return <Badge tone="warning">Service due</Badge>;
}

export default function VehiclesListPage() {
  const { role, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    siteId: '',
    docsMissing: searchParams.get('docsMissing') === 'true' ? 'true' : '',
    page: 1,
    sort: 'createdAt:desc',
  });
  const [result, setResult] = useState(null);
  const [overallTotal, setOverallTotal] = useState(null);
  const [error, setError] = useState(null);
  const siteNames = useSiteNames();

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      const response = await vehiclesApi.list({
        search: activeFilters.search || undefined,
        status: activeFilters.status || undefined,
        siteId: activeFilters.siteId || undefined,
        docsMissing: activeFilters.docsMissing || undefined,
        page: activeFilters.page,
        sort: activeFilters.sort,
      });
      setResult(response);
      if (!activeFilters.search && !activeFilters.siteId && !activeFilters.docsMissing) setOverallTotal(response.pagination.total);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  function handleSort(field) {
    setFilters((f) => {
      const [currentField, currentDirection] = f.sort.split(':');
      const direction = currentField === field && currentDirection === 'asc' ? 'desc' : 'asc';
      return { ...f, sort: `${field}:${direction}` };
    });
  }

  const [sortField, sortDirection] = filters.sort.split(':');

  const columns = [
    {
      key: 'photo',
      label: '',
      render: (v) => (
        <AssetPhoto
          assetType="VEHICLE"
          assetId={v.assetId}
          photoId={v.coverPhotoId}
          alt={v.registrationNumber}
          className="size-10 rounded"
        />
      ),
    },
    { key: 'assetId', label: 'Asset ID', sortable: true },
    {
      key: 'registrationNumber',
      label: 'Registration',
      sortable: true,
      render: (v) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{v.registrationNumber}</span>
          <MissingDocsBadge vehicle={v} />
        </div>
      ),
    },
    { key: 'type', label: 'Type' },
    {
      key: 'currentKM',
      label: 'Current meter',
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <span>
            {v.isHoursBased
              ? `${Number(v.currentHours).toLocaleString()} hrs`
              : `${Number(v.currentKM).toLocaleString()} KM`}
          </span>
          <ServiceDueBadge vehicle={v} />
        </div>
      ),
    },
    {
      key: 'currentSiteId',
      label: 'Site',
      render: (v) => siteNames[v.currentSiteId] ?? '—',
    },
    {
      key: 'actions',
      label: '',
      render: (v) => (
        <Link to={`/vehicles/${v.id}`} className="font-semibold text-brand-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-steel-900">
            Vehicles
            {overallTotal !== null && (
              <span
                className="rounded-full bg-steel-100 px-2.5 py-0.5 text-sm font-semibold text-steel-700 tabular-nums"
                aria-label={`${overallTotal.toLocaleString('en-IN')} total`}
              >
                {overallTotal.toLocaleString('en-IN')}
              </span>
            )}
          </h1>
          <p className="mt-1 text-steel-500">Light vehicles tracked in KM, heavy vehicles in hours.</p>
        </div>
        <Can resource="VEHICLE" action="CREATE">
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/vehicles/import" variant="secondary">
              Import from Excel
            </Button>
            <Button as={Link} to="/vehicles/new">
              Add vehicle
            </Button>
          </div>
        </Can>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${picksSite ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <Input
          placeholder="Search asset ID, registration, model..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Documents"
          value={filters.docsMissing}
          onChange={(e) => updateFilter('docsMissing', e.target.value)}
        >
          {DOCUMENT_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {picksSite && (
          <Select aria-label="Site" value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading vehicles" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(v) => v.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No vehicles match these filters."
            />
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
