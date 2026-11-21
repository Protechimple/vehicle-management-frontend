import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAll, tyresApi } from '../../api/client';
import { Alert, Badge, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { EVENT_LABELS, assetTyresPath, formatCurrency, formatDateOnly, formatNumber, formatTime, formatWhen, meterUnit } from '../../config/tyres';

const TONES = { purchased: 'neutral', added_spare: 'success', fitted: 'brand', removed: 'neutral', puncture: 'warning', remould_sent: 'warning', remould_back: 'success', scrapped: 'danger', transferred: 'brand' };

// The activities in the order they usually happen, for the filter and the summary.
const ACTIVITIES = ['purchased', 'added_spare', 'fitted', 'removed', 'puncture', 'remould_sent', 'remould_back', 'transferred', 'scrapped'];

function listParams(active) {
  return {
    search: active.search.trim() || undefined,
    eventType: active.eventType || undefined,
    assetType: active.assetType || undefined,
    siteId: active.siteId || undefined,
    dateFrom: active.dateFrom || undefined,
    dateTo: active.dateTo || undefined,
    sort: active.sort,
  };
}

function appliedFilters(active, siteNames) {
  const applied = [];
  if (active.search.trim()) applied.push({ label: 'Search', value: active.search.trim() });
  if (active.eventType) applied.push({ label: 'Activity', value: EVENT_LABELS[active.eventType] });
  if (active.assetType) applied.push({ label: 'Asset type', value: active.assetType === 'VEHICLE' ? 'Vehicles' : 'Machinery' });
  if (active.siteId) applied.push({ label: 'Site', value: siteNames[active.siteId] ?? active.siteId });
  if (active.dateFrom) applied.push({ label: 'From', value: formatDateOnly(active.dateFrom) });
  if (active.dateTo) applied.push({ label: 'To', value: formatDateOnly(active.dateTo) });
  return applied;
}

// The KM / Hours reading entered for the entry.
function readingText(e) {
  return e.meterReading == null ? null : `${formatNumber(e.meterReading)} ${meterUnit(e.meterType)}`;
}

// How far the tyre ran on the asset (taken-off entries: removal reading − fitting reading).
function runningText(e) {
  return e.runValue == null ? null : `${formatNumber(e.runValue)} ${meterUnit(e.meterType)}`;
}

export function historyColumns() {
  return [
    { key: 'eventDate', label: 'Date & time', sortable: true, render: (e) => <span className="whitespace-nowrap">{formatWhen(e.eventDate, e.eventTime)}</span> },
    {
      key: 'tyre',
      label: 'Tyre',
      render: (e) => (
        <div className="flex flex-col">
          <Link to={`/tyres/${e.tyreId}`} className="font-semibold whitespace-nowrap text-brand-600 hover:underline">
            {e.tyreCode}
          </Link>
          {e.serialNumber && <span className="text-xs text-steel-500">SN {e.serialNumber}</span>}
        </div>
      ),
    },
    { key: 'brand', label: 'Brand', render: (e) => e.tyreBrand ?? '—' },
    { key: 'pattern', label: 'Pattern / Model', render: (e) => e.tyrePattern ?? '—' },
    { key: 'size', label: 'Size', render: (e) => <span className="whitespace-nowrap">{e.tyreSize ?? '—'}</span> },
    { key: 'activity', label: 'Activity', render: (e) => <Badge tone={TONES[e.eventType]}>{EVENT_LABELS[e.eventType] ?? e.eventType}</Badge> },
    {
      key: 'asset',
      label: 'Vehicle / machine',
      render: (e) =>
        e.assetLabel ? (
          <div className="flex flex-col">
            <Link to={assetTyresPath(e.assetType, e.assetId)} className="font-semibold whitespace-nowrap text-brand-600 hover:underline">
              {e.assetLabel}
            </Link>
            {e.position && <span className="text-xs text-steel-500">{e.position}</span>}
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'reading', label: 'KM / Hours', align: 'right', render: (e) => <span className="tabular-nums">{readingText(e) ?? '—'}</span> },
    { key: 'running', label: 'Tyre Running', align: 'right', render: (e) => <span className="font-semibold tabular-nums">{runningText(e) ?? '—'}</span> },
    { key: 'site', label: 'Site', render: (e) => e.siteName ?? '—' },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right', render: (e) => <span className="tabular-nums">{e.amount ? formatCurrency(e.amount) : '—'}</span> },
    { key: 'by', label: 'By', render: (e) => <span className="text-xs text-steel-500">{e.createdByName ?? '—'}</span> },
  ];
}

// Totals at the top of the PDF: how many entries it lists, and the sum of its Amount column.
export function printSummary(rows) {
  const total = rows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return [
    { label: 'Total records', value: formatNumber(rows.length) },
    { label: 'Total amount', value: formatCurrency(Math.round(total * 100) / 100) },
  ];
}

// The same history in the PDF (plain text; an array is printed as lines).
// Fixed widths (A4 portrait) so every value stays inside its column; they add up to 100%.
export function printColumns() {
  return [
    { key: 'when', label: 'Date & time', width: '10%', render: (e) => [formatDateOnly(e.eventDate), e.eventTime ? formatTime(e.eventTime) : null] },
    { key: 'tyre', label: 'Tyre', width: '9.5%', render: (e) => [e.tyreCode, e.serialNumber ? `SN ${e.serialNumber}` : null] },
    { key: 'brand', label: 'Brand', width: '8.5%', render: (e) => e.tyreBrand ?? '—' },
    { key: 'pattern', label: 'Pattern / Model', width: '9.5%', render: (e) => e.tyrePattern ?? '—' },
    { key: 'size', label: 'Size', width: '7%', render: (e) => e.tyreSize ?? '—' },
    { key: 'activity', label: 'Activity', width: '9%', render: (e) => EVENT_LABELS[e.eventType] ?? e.eventType },
    { key: 'asset', label: 'Vehicle / machine', width: '12.5%', render: (e) => (e.assetLabel ? [e.assetLabel, e.position] : '—') },
    { key: 'reading', label: 'KM / Hours', align: 'right', width: '8.5%', render: (e) => readingText(e) ?? '—' },
    { key: 'running', label: 'Tyre Running', align: 'right', width: '7.5%', render: (e) => runningText(e) ?? '—' },
    { key: 'site', label: 'Site', width: '7.5%', render: (e) => e.siteName ?? '—' },
    { key: 'amount', label: 'Amount', align: 'right', width: '10.5%', render: (e) => (e.amount ? formatCurrency(e.amount) : '—') },
  ];
}

export default function TyreHistoryPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ search: '', eventType: '', assetType: '', siteId: '', dateFrom: '', dateTo: '', page: 1, sort: 'eventDate:desc' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      setResult(await tyresApi.history({ ...listParams(active), page: active.page }));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const [sortField, sortDirection] = filters.sort.split(':');
  function handleSort(field) {
    setFilters((f) => {
      const [currentField, currentDirection] = f.sort.split(':');
      return { ...f, sort: `${field}:${currentField === field && currentDirection === 'desc' ? 'asc' : 'desc'}` };
    });
  }

  const columns = historyColumns();

  async function buildPrintReport() {
    const params = listParams(filters);
    const { data } = await listAll(tyresApi.history, params);
    return {
      title: 'Tyre History',
      filters: [
        ...appliedFilters(filters, siteNames),
        { label: 'Sorted by', value: `${columns.find((c) => c.key === sortField).label}, ${sortDirection === 'asc' ? 'oldest / lowest first' : 'newest / highest first'}` },
      ],
      summary: printSummary(data),
      sections: [
        {
          title: 'Tyre history — all tyres',
          rows: data,
          getRowKey: (e) => e.id,
          emptyMessage: 'No tyre history matches these filters.',
          columns: printColumns(),
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Tyre History</h1>
          <p className="mt-1 text-steel-500">Everything that happened to every tyre, newest first.</p>
        </div>
        <PrintReportButton buildReport={buildPrintReport} onError={setError} />
      </div>

      <Alert tone="error">{error}</Alert>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <Input placeholder="Search tyre ID, brand, size, vehicle no..." title="Search by tyre ID, serial, brand, pattern, size, vehicle / machine number, shop or notes" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        <Select value={filters.eventType} onChange={(e) => updateFilter('eventType', e.target.value)} aria-label="Activity">
          <option value="">All activities</option>
          {ACTIVITIES.map((type) => (
            <option key={type} value={type}>
              {EVENT_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select value={filters.assetType} onChange={(e) => updateFilter('assetType', e.target.value)} aria-label="Asset type">
          <option value="">Vehicles &amp; machinery</option>
          <option value="VEHICLE">Vehicles</option>
          <option value="MACHINERY">Machinery</option>
        </Select>
        {isAdmin && (
          <Select value={filters.siteId} onChange={(e) => updateFilter('siteId', e.target.value)} aria-label="Site">
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
      </div>

      <div className="rounded border border-steel-200 bg-surface">
        {!result ? (
          error ? null : <Spinner label="Loading tyre history" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={result.data}
              getRowKey={(e) => e.id}
              sort={{ field: sortField, direction: sortDirection }}
              onSort={handleSort}
              emptyMessage="No tyre history matches these filters."
            />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>
    </div>
  );
}
