import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { batteriesApi, listAll } from '../../api/client';
import { Alert, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import PrintReportButton from '../../components/PrintReport';
import { formatReading } from '../../components/batteries/BatteryForms';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { EVENT_LABELS, OUTCOME_LABELS, batteryName, formatCurrency, formatDateOnly, todayDateOnly } from '../../config/batteries';

// One plain sentence for each history entry.
export function eventSentence(e) {
  const asset = e.assetLabel ?? e.assetId;
  const at = e.position ? ` (${e.position})` : '';
  const reading = e.meterReading != null ? ` at ${formatReading(e.meterReading, e.meterType)}` : '';
  switch (e.eventType) {
    case 'purchased':
      return `Bought${e.vendor ? ` from ${e.vendor}` : ''} for ${formatCurrency(e.amount)}${e.siteName ? `, kept at ${e.siteName}` : ''}`;
    case 'fitted':
      return `Fitted to ${asset}${at}${reading}${e.relatedBatteryCode ? `, in place of ${e.relatedBatteryCode}` : ''}`;
    case 'removed':
      return `Taken off ${asset}${at}${reading}${e.relatedBatteryCode ? `, ${e.relatedBatteryCode} put in` : ''} — ${OUTCOME_LABELS[e.outcome] ?? e.outcome}`;
    case 'sent_for_repair':
      return 'Sent for repair from store';
    case 'repaired':
      return `Repaired${e.vendor ? ` by ${e.vendor}` : ''}${e.amount != null ? ` for ${formatCurrency(e.amount)}` : ''}, back in store`;
    case 'scrapped':
      return `Scrapped${e.notes ? `: ${e.notes}` : ''}${e.amount != null ? ` (sold for ${formatCurrency(e.amount)})` : ''}`;
    default:
      return EVENT_LABELS[e.eventType] ?? e.eventType;
  }
}

// The money of one history entry: what was paid for a battery or a repair, or what a scrapped battery sold for.
export function eventAmount(e) {
  if (e.amount == null) return null;
  if (e.eventType === 'purchased') return { text: formatCurrency(e.amount), note: 'Cost' };
  if (e.eventType === 'repaired') return { text: formatCurrency(e.amount), note: 'Repair cost' };
  if (e.eventType === 'scrapped') return { text: formatCurrency(e.amount), note: 'Scrap sale' };
  return null;
}

export default function BatteryHistoryPage() {
  const { canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ search: '', eventType: '', dateFrom: '', dateTo: '', siteId: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      setResult(
        await batteriesApi.events({
          dateFrom: active.dateFrom || undefined,
          dateTo: active.dateTo || undefined,
          siteId: active.siteId || undefined,
          search: active.search || undefined,
          eventType: active.eventType || undefined,
          page: active.page,
        })
      );
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 250);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }));

  const columns = [
    { key: 'eventDate', label: 'Date', render: (e) => <span className="whitespace-nowrap">{formatDateOnly(e.eventDate)}</span> },
    {
      key: 'battery',
      label: 'Battery',
      render: (e) => (
        <div className="flex flex-col">
          <Link to={`/batteries/${e.batteryId}`} className="font-semibold text-brand-600 hover:underline">
            {e.batteryCode}
          </Link>
          <span className="text-xs text-steel-500">{batteryName(e)}</span>
        </div>
      ),
    },
    {
      key: 'what',
      label: 'What happened',
      render: (e) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{EVENT_LABELS[e.eventType] ?? e.eventType}</span>
          <span className="text-xs text-steel-600">{eventSentence(e)}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (e) => {
        const money = eventAmount(e);
        if (!money) return <span className="text-steel-400">—</span>;
        return (
          <div className="flex flex-col items-end whitespace-nowrap">
            <span className={`font-semibold tabular-nums ${e.eventType === 'scrapped' ? 'text-success-600' : 'text-steel-900'}`}>{money.text}</span>
            <span className="text-xs text-steel-500">{money.note}</span>
          </div>
        );
      },
    },
    { key: 'siteName', label: 'Site', render: (e) => e.siteName ?? '—' },
    { key: 'by', label: 'Entered by', render: (e) => <span className="text-xs">{e.createdByName ?? '—'}</span> },
  ];

  const filtered = filters.search || filters.eventType || filters.dateFrom || filters.dateTo || filters.siteId;

  // Every entry matching the filters, not just this page of them.
  async function buildPrintReport() {
    const { data } = await listAll(batteriesApi.events, {
      search: filters.search || undefined,
      eventType: filters.eventType || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      siteId: filters.siteId || undefined,
    });
    return {
      title: 'Battery History',
      filters: [
        ...(filters.search.trim() ? [{ label: 'Search', value: filters.search.trim() }] : []),
        ...(filters.eventType ? [{ label: 'What happened', value: EVENT_LABELS[filters.eventType] ?? filters.eventType }] : []),
        ...(filters.dateFrom ? [{ label: 'From', value: formatDateOnly(filters.dateFrom) }] : []),
        ...(filters.dateTo ? [{ label: 'To', value: formatDateOnly(filters.dateTo) }] : []),
        ...(filters.siteId ? [{ label: 'Site', value: siteNames[filters.siteId] ?? '—' }] : []),
      ],
      summary: [{ label: 'Entries', value: String(data.length) }],
      sections: [
        {
          title: 'History',
          rows: data,
          getRowKey: (e) => e.id,
          emptyMessage: 'Nothing matches these filters.',
          columns: [
            { key: 'date', label: 'Date', width: '11%', render: (e) => formatDateOnly(e.eventDate) },
            { key: 'battery', label: 'Battery', width: '16%', render: (e) => [e.batteryCode, batteryName(e)] },
            { key: 'what', label: 'What happened', width: '35%', render: (e) => [EVENT_LABELS[e.eventType] ?? e.eventType, eventSentence(e)] },
            {
              key: 'amount',
              label: 'Amount',
              align: 'right',
              width: '13%',
              render: (e) => {
                const money = eventAmount(e);
                return money ? [money.text, money.note] : '—';
              },
            },
            { key: 'site', label: 'Site', width: '14%', render: (e) => e.siteName ?? '—' },
            { key: 'by', label: 'Entered by', width: '11%', render: (e) => e.createdByName ?? '—' },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Battery History</h1>
          <p className="mt-1 text-steel-500">Everything that happened to your batteries, newest first. Leave the dates empty to see all.</p>
        </div>
        <PrintReportButton buildReport={buildPrintReport} onError={setError} />
      </div>

      <Alert tone="error">{error}</Alert>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input placeholder="Battery no., serial or vehicle no." value={filters.search} onChange={setFilter('search')} />
        <Select aria-label="What happened" value={filters.eventType} onChange={setFilter('eventType')}>
          <option value="">Everything</option>
          {Object.entries(EVENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} max={filters.dateTo || todayDateOnly()} onChange={setFilter('dateFrom')} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} min={filters.dateFrom || undefined} max={todayDateOnly()} onChange={setFilter('dateTo')} />
        {picksSite && (
          <Select aria-label="Site" value={filters.siteId} onChange={setFilter('siteId')}>
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
          <Spinner label="Loading battery history" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(e) => e.id} emptyMessage={filtered ? 'Nothing matches these filters.' : 'No battery history yet.'} />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>
    </div>
  );
}
