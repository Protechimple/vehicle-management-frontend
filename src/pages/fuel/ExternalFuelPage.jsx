import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { externalFuelApi, listAll } from '../../api/client';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { EXTERNAL_CATEGORY, STORABLE_FUEL_TYPES, formatCurrency, formatDateOnly, formatLitres, formatNumber, formatTimeOnly } from '../../config/fuel';

function appliedFilters(active, siteNames) {
  const applied = [];
  if (active.search.trim()) applied.push({ label: 'Search', value: active.search.trim() });
  if (active.category) applied.push({ label: 'Category', value: EXTERNAL_CATEGORY[active.category] ?? active.category });
  if (active.fuelType) applied.push({ label: 'Fuel', value: active.fuelType });
  if (active.siteId) applied.push({ label: 'Site', value: siteNames[active.siteId] ?? active.siteId });
  if (active.dateFrom) applied.push({ label: 'From', value: formatDateOnly(active.dateFrom) });
  if (active.dateTo) applied.push({ label: 'To', value: formatDateOnly(active.dateTo) });
  if (active.status === 'archived') applied.push({ label: 'Records', value: 'Deleted entries' });
  return applied;
}

function listParams(active) {
  return {
    search: active.search || undefined,
    category: active.category || undefined,
    fuelType: active.fuelType || undefined,
    siteId: active.siteId || undefined,
    dateFrom: active.dateFrom || undefined,
    dateTo: active.dateTo || undefined,
    status: active.status || undefined,
    sort: active.sort,
  };
}

export default function ExternalFuelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const siteNames = useSiteNames();

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    fuelType: '',
    siteId: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    page: 1,
    sort: 'entryDate:desc',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (location.state?.message) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (activeFilters) => {
    setError(null);
    try {
      setResult(await externalFuelApi.list({ ...listParams(activeFilters), page: activeFilters.page }));
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
      const direction = currentField === field && currentDirection === 'desc' ? 'asc' : 'desc';
      return { ...f, sort: `${field}:${direction}` };
    });
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await externalFuelApi.remove(deleteTarget.id, 'DELETE');
      setNotice(`Entry ${deleteTarget.entryNumber} deleted — ${formatLitres(deleteTarget.quantity)} went back to site stock.`);
      setDeleteTarget(null);
      await load(filters);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const [sortField, sortDirection] = filters.sort.split(':');

  const columns = [
    {
      key: 'entryDate',
      label: 'Date & time',
      sortable: true,
      render: (r) => (
        <div className="flex flex-col">
          <span>{formatDateOnly(r.entryDate)}</span>
          <span className="text-xs text-steel-500 tabular-nums">
            {[r.entryTime ? formatTimeOnly(r.entryTime) : null, r.entryNumber].filter(Boolean).join(' · ')}
          </span>
        </div>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.vehicleNumber}</span>
          {r.vehicleName && <span className="text-xs text-steel-500">{r.vehicleName}</span>}
        </div>
      ),
    },
    {
      key: 'party',
      label: 'Party',
      render: (r) => (
        <div className="flex flex-col items-start">
          <span className="text-steel-900">{r.partyName}</span>
          <Badge tone="neutral">{EXTERNAL_CATEGORY[r.category] ?? r.category}</Badge>
        </div>
      ),
    },
    { key: 'siteId', label: 'Site', render: (r) => r.siteName ?? siteNames[r.siteId] ?? '—' },
    { key: 'fuelType', label: 'Fuel', render: (r) => r.fuelType },
    { key: 'quantity', label: 'Litres', sortable: true, render: (r) => <span className="tabular-nums">{formatLitres(r.quantity)}</span> },
    { key: 'pricePerLitre', label: 'Cost / L', render: (r) => <span className="tabular-nums">{formatCurrency(r.pricePerLitre)}</span> },
    { key: 'amount', label: 'Value', sortable: true, render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.amount)}</span> },
    { key: 'authorisedBy', label: 'Authorised by', render: (r) => r.authorisedBy ?? '—' },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.status === 'archived' ? (
          <Badge tone="neutral">Deleted</Badge>
        ) : (
          <div className="flex items-center gap-3">
            <Can resource="FUEL" action="UPDATE">
              <Link to={`/fuel/external/${r.id}/edit`} className="font-semibold text-brand-600 hover:underline">
                Edit
              </Link>
            </Can>
            <Can resource="FUEL" action="DELETE">
              <button
                type="button"
                className="font-semibold text-danger-600 hover:underline"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(r);
                }}
              >
                Delete
              </button>
            </Can>
          </div>
        ),
    },
  ];

  async function buildPrintReport() {
    const { data } = await listAll(externalFuelApi.list, listParams(filters));
    const total = (pick) => data.reduce((sum, r) => sum + (Number(pick(r)) || 0), 0);

    return {
      title: 'External Vehicle Fuel',
      filters: [
        ...appliedFilters(filters, siteNames),
        {
          label: 'Sorted by',
          value: `${columns.find((c) => c.key === sortField).label}, ${sortDirection === 'asc' ? 'ascending' : 'descending'}`,
        },
      ],
      summary: [
        { label: 'Entries', value: formatNumber(data.length) },
        { label: 'Total litres', value: formatLitres(total((r) => r.quantity)) },
        { label: 'Total value', value: formatCurrency(total((r) => r.amount)) },
      ],
      sections: [
        {
          title: 'External vehicle fuel',
          rows: data,
          getRowKey: (r) => r.id,
          emptyMessage: 'No entries match these filters.',
          columns: [
            { key: 'entryDate', label: 'Date & time', render: (r) => [formatDateOnly(r.entryDate), [r.entryTime ? formatTimeOnly(r.entryTime) : null, r.entryNumber].filter(Boolean).join(' · ')] },
            { key: 'vehicle', label: 'Vehicle', render: (r) => [r.vehicleNumber, r.vehicleName] },
            { key: 'party', label: 'Party', render: (r) => [r.partyName, EXTERNAL_CATEGORY[r.category] ?? r.category] },
            { key: 'siteId', label: 'Site', render: (r) => r.siteName ?? siteNames[r.siteId] ?? '—' },
            { key: 'fuelType', label: 'Fuel', render: (r) => r.fuelType },
            { key: 'quantity', label: 'Litres', align: 'right', render: (r) => formatLitres(r.quantity) },
            { key: 'pricePerLitre', label: 'Cost / L', align: 'right', render: (r) => formatCurrency(r.pricePerLitre) },
            { key: 'amount', label: 'Value', align: 'right', render: (r) => formatCurrency(r.amount) },
            { key: 'authorisedBy', label: 'Authorised by', render: (r) => r.authorisedBy ?? '—' },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">External Vehicle Fuel</h1>
          <p className="mt-1 text-steel-500">Fuel given from site stock to client, guest and other outside vehicles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="FUEL" action="CREATE">
            <Button as={Link} to="/fuel/external/new">
              Record external fuel
            </Button>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${picksSite ? 'lg:grid-cols-7' : 'lg:grid-cols-6'}`}>
        <Input
          placeholder="Search vehicle no, party, driver..."
          title="Search by vehicle number, party name, driver, entry number or slip number"
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <Select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {Object.entries(EXTERNAL_CATEGORY).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={filters.fuelType} onChange={(e) => updateFilter('fuelType', e.target.value)}>
          <option value="">All fuel types</option>
          {STORABLE_FUEL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        {picksSite && (
          <Select value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
        <Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">Active entries</option>
          <option value="archived">Deleted entries</option>
        </Select>
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading external vehicle fuel" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No external vehicle fuel entries match these filters."
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

      <DeleteWordModal
        open={Boolean(deleteTarget)}
        title="Delete this external fuel entry?"
        description={
          deleteTarget
            ? `${deleteTarget.entryNumber}: ${formatLitres(deleteTarget.quantity)} for ${deleteTarget.vehicleNumber} (${deleteTarget.partyName}) on ${formatDateOnly(deleteTarget.entryDate)}. The fuel goes back into site stock at its original cost.`
            : undefined
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        pending={deleting}
        error={deleteError}
      />
    </div>
  );
}
