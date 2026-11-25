import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { centringApi, listAll } from '../../api/client';
import { Alert, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useLastValidPage from '../../hooks/useLastValidPage';
import { ENTRY_TYPES, EntryDateCell, EntryTypeBadge, entryDateTime, entryDetail, entryPlace, formatQuantity, useCentringSites } from '../../components/centring/centringCommon';
import { formatCurrency, formatDateOnly } from '../../config/fuel';

// All the items of a movement added up. Items counted in different units are totalled per unit, e.g. "20 Nos + 5 Sqm".
function totalQuantity(entry) {
  const totals = new Map();
  for (const l of entry.lines) {
    const signed = (l.direction === 'out' ? -1 : 1) * Number(l.quantity);
    totals.set(l.unit, (totals.get(l.unit) ?? 0) + signed);
  }
  if (!totals.size) return '—';
  return [...totals]
    .map(([unit, total]) => {
      const rounded = Math.round(total * 1000) / 1000;
      return `${rounded < 0 ? '−' : ''}${formatQuantity(Math.abs(rounded), unit)}`;
    })
    .join(' + ');
}

const itemCount = (entry) => `${entry.lines.length} ${entry.lines.length === 1 ? 'item' : 'items'}`;

export default function CentringMovementsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const seesCost = can('CENTRING', 'VIEW_COST');
  const sites = useCentringSites();
  const [params, setParams] = useSearchParams();
  const itemId = params.get('item') ?? '';
  // Opened from a row of Centring Stock: start on that item at that site.
  const [filters, setFilters] = useState({ search: '', entryType: '', siteId: params.get('site') ?? '', dateFrom: '', dateTo: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notice] = useState(location.state?.message ?? null);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setError(null);
      centringApi
        .listEntries({
          search: filters.search || undefined,
          entryType: filters.entryType || undefined,
          siteId: filters.siteId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          itemId: itemId || undefined,
          page: filters.page,
        })
        .then((r) => !cancelled && setResult(r))
        .catch((err) => !cancelled && setError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, itemId]);

  useLastValidPage(result, filters.page, setFilters);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const columns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Link to={`/centring/movements/${r.id}`} className="font-semibold whitespace-nowrap text-brand-600 hover:underline">
            {r.entryNumber}
          </Link>
          <EntryTypeBadge type={r.entryType} />
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (r) => <EntryDateCell entry={r} by={r.createdByName ?? '—'} />,
    },
    { key: 'site', label: 'Site', render: (r) => <span className="block max-w-44 min-w-24 whitespace-normal">{entryPlace(r)}</span> },
    {
      key: 'details',
      label: 'Details',
      render: (r) => <span className="block max-w-56 min-w-28 text-sm wrap-break-word text-steel-700">{entryDetail(r) || '—'}</span>,
    },
    // The items themselves are on the movement's own page (click the reference).
    {
      key: 'quantity',
      label: 'Total quantity',
      align: 'right',
      render: (r) => (
        <div className="flex flex-col items-end whitespace-nowrap">
          <span className="font-semibold tabular-nums">{totalQuantity(r)}</span>
          {r.lines.length > 1 && <span className="text-xs text-steel-500">{itemCount(r)}</span>}
        </div>
      ),
    },
    ...(seesCost
      ? [{ key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(r.totalAmount)}</span> }]
      : []),
  ];

  // Every movement matching the filters, not just this page of them.
  async function buildPrintReport() {
    const { data } = await listAll(centringApi.listEntries, {
      search: filters.search || undefined,
      entryType: filters.entryType || undefined,
      siteId: filters.siteId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      itemId: itemId || undefined,
    });
    const siteName = filters.siteId ? (sites?.own.find((s) => String(s.id) === String(filters.siteId))?.name ?? '—') : null;
    const itemName = itemId ? data[0]?.lines.find((l) => String(l.itemId) === itemId)?.itemName : null;
    return {
      title: 'Centring Movements',
      filters: [
        ...(filters.search.trim() ? [{ label: 'Search', value: filters.search.trim() }] : []),
        ...(filters.entryType ? [{ label: 'Type', value: ENTRY_TYPES[filters.entryType].label }] : []),
        ...(siteName ? [{ label: 'Site', value: siteName }] : []),
        ...(itemName ? [{ label: 'Item', value: itemName }] : []),
        ...(filters.dateFrom ? [{ label: 'From', value: formatDateOnly(filters.dateFrom) }] : []),
        ...(filters.dateTo ? [{ label: 'To', value: formatDateOnly(filters.dateTo) }] : []),
      ],
      summary: [
        { label: 'Movements', value: String(data.length) },
        ...Object.entries(ENTRY_TYPES).map(([type, meta]) => ({ label: meta.label, value: String(data.filter((e) => e.entryType === type).length) })),
      ],
      sections: [
        {
          title: 'Movements',
          count: data.length,
          rows: data,
          getRowKey: (e) => e.id,
          emptyMessage: 'No movements match these filters.',
          columns: [
            { key: 'reference', label: 'Reference', width: '13%', render: (e) => [e.entryNumber, ENTRY_TYPES[e.entryType]?.label] },
            { key: 'date', label: 'Date', width: '13%', render: (e) => entryDateTime(e) },
            { key: 'site', label: 'Site', width: seesCost ? '18%' : '21%', render: (e) => entryPlace(e) },
            { key: 'details', label: 'Details', width: seesCost ? '19%' : '24%', render: (e) => entryDetail(e) || '—' },
            {
              key: 'quantity',
              label: 'Total quantity',
              align: 'right',
              width: seesCost ? '13%' : '16%',
              render: (e) => (e.lines.length > 1 ? [totalQuantity(e), itemCount(e)] : totalQuantity(e)),
            },
            ...(seesCost ? [{ key: 'amount', label: 'Amount', align: 'right', width: '11%', render: (e) => formatCurrency(e.totalAmount) }] : []),
            { key: 'by', label: 'By', width: '13%', render: (e) => e.createdByName ?? '—' },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Centring Movements</h1>
          <p className="mt-1 text-steel-500">Everything that happened to centring stock at your sites: bought, issued, moved, or adjusted.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          {Object.entries(ENTRY_TYPES).map(([type, meta]) => (
            <Can key={type} resource="CENTRING" action={meta.action}>
              <Button as={Link} to={`/centring/${type}/new`} variant="secondary">
                {meta.button}
              </Button>
            </Can>
          ))}
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Input placeholder="Reference, bill no. or purpose" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        <Select aria-label="Type" value={filters.entryType} onChange={(e) => setFilter('entryType', e.target.value)}>
          <option value="">All types</option>
          {Object.entries(ENTRY_TYPES).map(([type, meta]) => (
            <option key={type} value={type}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Site" value={filters.siteId} onChange={(e) => setFilter('siteId', e.target.value)}>
          <option value="">All sites</option>
          {(sites?.own ?? []).map((s) => (
            <option key={s.id} value={s.id} data-added={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="From date" placeholder="From date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
        <Input type="date" aria-label="To date" placeholder="To date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
      </div>

      {itemId && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-steel-600">
          Showing movements of one item{result?.data[0] ? ': ' : ''}
          <span className="font-semibold text-steel-900">{result?.data[0]?.lines.find((l) => String(l.itemId) === itemId)?.itemName}</span>
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setParams({}, { replace: true })}>
            Show all
          </button>
        </p>
      )}

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          <Spinner label="Loading movements" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(r) => r.id}
              emptyMessage={
                filters.search || filters.entryType || filters.siteId || filters.dateFrom || filters.dateTo
                  ? 'No movements match these filters.'
                  : 'No movements yet. Start with a purchase.'
              }
            />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>
    </div>
  );
}
