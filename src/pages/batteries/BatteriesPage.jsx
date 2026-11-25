import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { batteriesApi, listAll } from '../../api/client';
import { Alert, Button, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import PrintReportButton from '../../components/PrintReport';
import { ACTIONS, BatteryForm, BatteryStatusBadge, actionsFor } from '../../components/batteries/BatteryForms';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import useLastValidPage from '../../hooks/useLastValidPage';
import { BATTERY_STATUSES, STATUS_BY_VALUE, batteryName, formatDateOnly } from '../../config/batteries';

const EMPTY = {
  '': 'No batteries yet. Click "Add batteries" to record your first purchase.',
  ready: 'No batteries in store.',
  fitted: 'No batteries are fitted right now.',
  needs_repair: 'No batteries are waiting for repair.',
  scrapped: 'No batteries have been scrapped.',
};

function StatusTabs({ active, counts, onChange }) {
  const total = counts ? Object.values(counts).reduce((t, n) => t + n, 0) : null;
  const tabs = [{ value: '', label: 'All', count: total }, ...BATTERY_STATUSES.map((s) => ({ ...s, count: counts?.[s.value] }))];
  return (
    <div className="mb-4 flex flex-wrap gap-1.5 border-b border-steel-200" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value || 'all'}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${active === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-steel-500 hover:text-steel-800'}`}
        >
          {tab.label}
          {tab.count != null && <span className="ml-1.5 rounded-full bg-steel-100 px-2 py-0.5 text-xs text-steel-600 tabular-nums">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

function WhereNow({ row }) {
  if (row.status === 'fitted') {
    return (
      <div className="flex flex-col">
        <span className="font-semibold text-steel-900">{row.assetLabel ?? row.assetId}</span>
        <span className="text-xs text-steel-500">{[row.position, `since ${formatDateOnly(row.fittedAt)}`].filter(Boolean).join(' · ')}</span>
      </div>
    );
  }
  if (row.status === 'scrapped') return <span className="text-steel-500">Scrapped on {formatDateOnly(row.scrappedAt)}</span>;
  return <span>{row.status === 'ready' ? 'Store' : 'Repair'} · {row.siteName ?? '—'}</span>;
}

export default function BatteriesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ status: location.state?.status ?? '', search: '', siteId: '', page: 1 });
  const [result, setResult] = useState(null);
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.message ?? null);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const load = useCallback(async (active) => {
    setError(null);
    try {
      const [list, summary] = await Promise.all([
        batteriesApi.list({ status: active.status || undefined, search: active.search || undefined, siteId: active.siteId || undefined, page: active.page }),
        batteriesApi.summary({ siteId: active.siteId || undefined }),
      ]);
      setResult(list);
      setCounts(summary.data);
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

  const columns = [
    {
      key: 'battery',
      label: 'Battery',
      render: (r) => (
        <div className="flex flex-col">
          <Link to={`/batteries/${r.id}`} className="font-semibold text-brand-600 hover:underline">
            {r.batteryCode}
          </Link>
          <span className="text-xs text-steel-500">SN {r.serialNumber}</span>
        </div>
      ),
    },
    { key: 'name', label: 'Brand', render: (r) => batteryName(r) },
    { key: 'status', label: 'Status', render: (r) => <BatteryStatusBadge status={r.status} /> },
    { key: 'where', label: 'Where', render: (r) => <WhereNow row={r} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actionsFor(r).map((a, index) => (
            <Can key={a} resource="BATTERY" action={ACTIONS[a].permission}>
              <Button size="sm" variant={index === 0 ? 'primary' : 'secondary'} onClick={() => setActing({ action: a, battery: r })}>
                {ACTIONS[a].label}
              </Button>
            </Can>
          ))}
        </div>
      ),
    },
  ];

  // Every battery matching the filters, not just this page of them.
  async function buildPrintReport() {
    const { data } = await listAll(batteriesApi.list, {
      status: filters.status || undefined,
      search: filters.search || undefined,
      siteId: filters.siteId || undefined,
    });
    const count = (status) => data.filter((b) => b.status === status).length;
    return {
      title: 'Batteries',
      filters: [
        ...(filters.status ? [{ label: 'Status', value: STATUS_BY_VALUE[filters.status]?.label ?? filters.status }] : []),
        ...(filters.search.trim() ? [{ label: 'Search', value: filters.search.trim() }] : []),
        ...(filters.siteId ? [{ label: 'Site', value: siteNames[filters.siteId] ?? '—' }] : []),
      ],
      summary: [
        { label: 'Batteries', value: String(data.length) },
        ...BATTERY_STATUSES.map((s) => ({ label: s.label, value: String(count(s.value)) })),
      ],
      sections: [
        {
          title: 'Batteries',
          rows: data,
          getRowKey: (b) => b.id,
          emptyMessage: 'No batteries match these filters.',
          columns: [
            { key: 'code', label: 'Battery no.', width: '13%', render: (b) => b.batteryCode },
            { key: 'serial', label: 'Serial no.', width: '15%', render: (b) => b.serialNumber },
            { key: 'name', label: 'Brand', width: '20%', render: (b) => batteryName(b) },
            { key: 'status', label: 'Status', width: '12%', render: (b) => STATUS_BY_VALUE[b.status]?.label ?? b.status },
            {
              key: 'where',
              label: 'Where',
              width: '27%',
              render: (b) =>
                b.status === 'fitted'
                  ? [b.assetLabel ?? b.assetId, [b.position, b.fittedAt && `since ${formatDateOnly(b.fittedAt)}`].filter(Boolean).join(' · ')]
                  : b.status === 'scrapped'
                    ? `Scrapped on ${formatDateOnly(b.scrappedAt)}`
                    : b.status === 'ready'
                      ? 'Store'
                      : 'Repair',
            },
            { key: 'site', label: 'Site', width: '13%', render: (b) => b.siteName ?? '—' },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Batteries</h1>
          <p className="mt-1 text-steel-500">Every battery and where it is. Use the button on a row to fit, change, repair or scrap it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintReportButton buildReport={buildPrintReport} onError={setError} />
          <Can resource="BATTERY" action="CREATE">
            <Button as={Link} to="/batteries/add">
              + Add batteries
            </Button>
          </Can>
        </div>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <StatusTabs active={filters.status} counts={counts} onChange={(status) => setFilter('status', status)} />

      <div className={`mb-4 grid gap-3 ${picksSite ? 'sm:grid-cols-2 lg:max-w-3xl' : 'sm:max-w-md'}`}>
        <Input placeholder="Search battery no., serial, brand or vehicle no." value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
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
          <Spinner label="Loading batteries" />
        ) : (
          <>
            <Table columns={columns} rows={result.data} getRowKey={(r) => r.id} emptyMessage={filters.search || filters.siteId ? 'No batteries match your search.' : EMPTY[filters.status]} />
            <Pagination page={result.pagination.page} pages={result.pagination.pages} total={result.pagination.total} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </div>

      <BatteryForm
        key={acting ? `${acting.action}-${acting.battery.id}` : 'none'}
        action={acting?.action}
        battery={acting?.battery}
        onClose={() => setActing(null)}
        onDone={(message) => {
          setActing(null);
          setNotice(message);
          load(filters);
        }}
      />
    </div>
  );
}
