import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { listAll, tyresApi } from '../../api/client';
import { Alert, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import PrintReportButton from '../../components/PrintReport';
import { ACTIONS, AddSparesForm, TyreActionForm, TyreStatusBadge, TyreWhere, actionsFor } from '../../components/tyres/TyreForms';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import useLastValidPage from '../../hooks/useLastValidPage';
import { STATUS_BY_VALUE, TYRE_STATUSES, formatCurrency, formatNumber, formatRunTotals, formatWhen, meterUnit } from '../../config/tyres';

const EMPTY = {
  new: 'The New Tyre Store is empty. Tyres you buy are added here.',
  spare: 'The Spare Tyre Store is empty. Tyres taken off, and the spare tyres of vehicles and machines, are kept here.',
  fitted: 'No tyres are fitted right now.',
  remould: 'No tyres are away for remoulding.',
  scrapped: 'No tyres have been scrapped.',
};

function StoreTabs({ active, counts, onChange }) {
  return (
    <div className="relative mb-3 flex gap-1 overflow-x-auto border-b border-steel-200" role="tablist">
      {TYRE_STATUSES.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${active === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-steel-500 hover:text-steel-800'}`}
        >
          {tab.label}
          {counts && <span className="ml-1.5 rounded-full bg-steel-100 px-2 py-0.5 text-xs text-steel-600 tabular-nums">{counts[tab.value] ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

// The small line under a tyre's total cost: the repairs included in it.
function costNotes(t) {
  return t.repairCost > 0 ? [`incl. repairs ${formatCurrency(t.repairCost)}`] : [];
}

// Scrapped tab only: what the scrap dealer paid for the tyre.
function scrapValueText(t) {
  return t.scrapValue != null ? formatCurrency(t.scrapValue) : '—';
}

// "Where" as plain text for the PDF (an array is printed as lines).
function whereText(t) {
  if (t.status === 'fitted') return [t.assetLabel ?? t.assetId, t.position, `Since ${formatWhen(t.fittedAt, t.fittedTime)} · ${formatNumber(t.fitReading)} ${meterUnit(t.meterType)}`];
  if (t.status === 'scrapped') return `Scrapped ${formatWhen(t.scrappedAt, t.scrappedTime)}`;
  return [`${STATUS_BY_VALUE[t.status]?.label} · ${t.siteName ?? '—'}`, t.ownerLabel ? `Spare of ${t.ownerLabel}` : null];
}

// The Scrapped tab adds a Scrap Value column; its "Where" is just the scrap date, so it gives up the room.
export function storePrintColumns(status) {
  const scrapped = status === 'scrapped';
  return [
    { key: 'tyre', label: 'Tyre', width: '15%', render: (t) => [t.tyreCode, t.serialNumber ? `SN ${t.serialNumber}` : null] },
    { key: 'brand', label: 'Brand', width: '10%', render: (t) => t.tyreBrand ?? '—' },
    { key: 'pattern', label: 'Pattern / Model', width: '10%', render: (t) => t.tyrePattern ?? '—' },
    { key: 'size', label: 'Size', width: '8%', render: (t) => t.tyreSize ?? '—' },
    { key: 'status', label: 'Status', width: '7%', render: (t) => STATUS_BY_VALUE[t.status]?.short ?? t.status },
    { key: 'where', label: 'Where', width: scrapped ? '16%' : '28%', render: (t) => whereText(t) },
    { key: 'run', label: 'Run', align: 'right', width: '8%', render: (t) => formatRunTotals(t) },
    { key: 'cost', label: 'Total cost', align: 'right', width: '14%', render: (t) => [formatCurrency(t.totalCost), ...costNotes(t)] },
    ...(scrapped ? [{ key: 'scrapValue', label: 'Scrap Value', align: 'right', width: '12%', render: scrapValueText }] : []),
  ];
}

// Totals at the top of the PDF: how many tyres it lists, their total cost, and for scrapped tyres the scrap value.
export function storePrintSummary(rows) {
  const add = (pick) => Math.round(rows.reduce((sum, t) => sum + (Number(pick(t)) || 0), 0) * 100) / 100;
  const scrapped = rows.filter((t) => t.status === 'scrapped');
  return [
    { label: 'Total records', value: formatNumber(rows.length) },
    { label: 'Total cost', value: formatCurrency(add((t) => t.totalCost)) },
    ...(scrapped.length > 0 ? [{ label: 'Scrap value received', value: formatCurrency(add((t) => (t.status === 'scrapped' ? t.scrapValue : 0))) }] : []),
  ];
}

export default function TyreStoresPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ status: location.state?.status ?? 'new', search: '', siteId: '', page: 1 });
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [acting, setActing] = useState(null);
  const [addingSpares, setAddingSpares] = useState(false);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      const [list, counts] = await Promise.all([
        tyresApi.list({ status: active.status, search: active.search || undefined, siteId: active.siteId || undefined, page: active.page }),
        tyresApi.summary({ siteId: active.siteId || undefined }),
      ]);
      setResult(list);
      setSummary(counts.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 250);
    return () => clearTimeout(timer);
  }, [filters, load]);

  useLastValidPage(result, filters.page, setFilters);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const done = (message) => {
    setActing(null);
    setAddingSpares(false);
    setNotice(message);
    load(filters);
  };

  const columns = [
    {
      key: 'tyre',
      label: 'Tyre',
      render: (t) => (
        <div className="flex flex-col">
          <Link to={`/tyres/${t.id}`} className="font-semibold whitespace-nowrap text-brand-600 hover:underline">
            {t.tyreCode}
          </Link>
          {t.serialNumber && <span className="text-xs text-steel-500">SN {t.serialNumber}</span>}
        </div>
      ),
    },
    { key: 'brand', label: 'Brand', render: (t) => t.tyreBrand ?? '—' },
    { key: 'pattern', label: 'Pattern / Model', render: (t) => t.tyrePattern ?? '—' },
    { key: 'size', label: 'Size', render: (t) => <span className="whitespace-nowrap">{t.tyreSize ?? '—'}</span> },
    { key: 'status', label: 'Status', render: (t) => <TyreStatusBadge status={t.status} /> },
    { key: 'where', label: 'Where', render: (t) => <TyreWhere tyre={t} /> },
    { key: 'run', label: 'Run', align: 'right', render: (t) => <span className="whitespace-nowrap tabular-nums">{formatRunTotals(t)}</span> },
    {
      key: 'cost',
      label: 'Total cost',
      align: 'right',
      render: (t) => (
        <div className="flex flex-col items-end">
          <span className="font-semibold tabular-nums">{formatCurrency(t.totalCost)}</span>
          {costNotes(t).map((note) => (
            <span key={note} className="text-xs whitespace-nowrap text-steel-500 tabular-nums">
              {note}
            </span>
          ))}
        </div>
      ),
    },
    ...(filters.status === 'scrapped'
      ? [{ key: 'scrapValue', label: 'Scrap Value', align: 'right', render: (t) => <span className="whitespace-nowrap tabular-nums">{scrapValueText(t)}</span> }]
      : []),
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (t) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {actionsFor(t).map((a, index) => (
            <Can key={a} resource="TYRE" action="UPDATE">
              <Button size="sm" variant={index === 0 ? 'primary' : 'secondary'} onClick={() => setActing({ action: a, tyre: t })}>
                {ACTIONS[a].label}
              </Button>
            </Can>
          ))}
        </div>
      ),
    },
  ];

  // The PDF lists every tyre in the open tab that matches the search and site, not just this page.
  async function buildPrintReport() {
    const params = { status: filters.status, search: filters.search.trim() || undefined, siteId: filters.siteId || undefined, sort: 'updatedAt:desc' };
    const { data } = await listAll(tyresApi.list, params);
    const applied = [{ label: 'Store', value: STATUS_BY_VALUE[filters.status]?.label }];
    if (filters.search.trim()) applied.push({ label: 'Search', value: filters.search.trim() });
    if (filters.siteId) applied.push({ label: 'Site', value: siteNames[filters.siteId] ?? filters.siteId });
    return {
      title: `Tyre Stores — ${STATUS_BY_VALUE[filters.status]?.label}`,
      filters: applied,
      summary: storePrintSummary(data),
      sections: [
        {
          title: STATUS_BY_VALUE[filters.status]?.label,
          rows: data,
          getRowKey: (t) => t.id,
          emptyMessage: EMPTY[filters.status],
          columns: storePrintColumns(filters.status),
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Tyre Stores</h1>
          <p className="mt-1 text-steel-500">Every tyre and where it is.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="TYRE" action="CREATE">
            <div className="flex flex-wrap gap-2">
              <Can resource="TYRE" action="TRANSFER">
                <Button variant="secondary" as={Link} to="/tyres/transfers/new">
                  Transfer tyres
                </Button>
              </Can>
              <Button variant="secondary" onClick={() => setAddingSpares(true)}>
                + Add spare tyres
              </Button>
              <Button as={Link} to="/tyres/purchases/new">
                + Buy tyres
              </Button>
            </div>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <StoreTabs active={filters.status} counts={summary?.counts} onChange={(status) => setFilter('status', status)} />

      <div className={`mb-3 grid gap-3 ${picksSite ? 'sm:grid-cols-2 lg:max-w-3xl' : 'sm:max-w-md'}`}>
        <Input placeholder="Search tyre ID, serial, brand, size or vehicle no." value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        {picksSite && (
          <Select aria-label="Site" value={filters.siteId} onChange={(e) => setFilter('siteId', e.target.value)}>
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
          <Spinner label="Loading tyres" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(t) => t.id} emptyMessage={filters.search || filters.siteId ? 'No tyres match your search.' : EMPTY[filters.status]} />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      <TyreActionForm key={acting ? `${acting.action}-${acting.tyre.id}` : 'none'} action={acting?.action} tyre={acting?.tyre} onClose={() => setActing(null)} onDone={done} />
      {addingSpares && <AddSparesForm onClose={() => setAddingSpares(false)} onDone={done} />}
    </div>
  );
}
