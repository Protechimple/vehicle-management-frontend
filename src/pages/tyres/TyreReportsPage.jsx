import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Input, Select, Spinner, Tabs } from '../../components/ui';
import ReportTable from '../../components/ReportTable';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { assetTyresPath, formatCurrency, formatNumber, meterUnit, todayDateOnly } from '../../config/tyres';

const TABS = [
  { value: 'assets', label: 'By vehicle & machine' },
  { value: 'costs', label: 'Tyre costs' },
];

function Tiles({ items }) {
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded border border-steel-200 bg-surface px-3 py-2.5">
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
          {hint && <dd className="text-xs text-steel-500">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

const money = (v) => <span className="tabular-nums">{formatCurrency(v)}</span>;
const num = (v) => <span className="tabular-nums">{v}</span>;
const count = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

export function AssetReport({ data }) {
  const t = data.totals;
  const columns = [
    {
      key: 'asset',
      label: 'Vehicle / machine',
      sortable: true,
      sortValue: (r) => r.assetLabel ?? '',
      render: (r) => (
        <div className="flex flex-col">
          <Link to={assetTyresPath(r.assetType, r.assetId)} className="font-semibold text-brand-600 hover:underline">
            {r.assetLabel}
          </Link>
          <span className="text-xs text-steel-500">
            {r.assetKind}
            {r.siteName ? ` · ${r.siteName}` : ''}
          </span>
        </div>
      ),
    },
    { key: 'on', label: 'Tyres on now', align: 'right', sortable: true, sortValue: (r) => r.tyresOnNow, render: (r) => num(r.tyresNeeded ? `${r.tyresOnNow} / ${r.tyresNeeded}` : r.tyresOnNow) },
    { key: 'fitted', label: 'Fitted', align: 'right', sortable: true, sortValue: (r) => r.fitted, render: (r) => num(r.fitted) },
    { key: 'punctures', label: 'Punctures', align: 'right', sortable: true, sortValue: (r) => r.punctures, render: (r) => num(r.punctures) },
    { key: 'run', label: 'Tyre run', align: 'right', sortable: true, sortValue: (r) => r.run, render: (r) => num(r.run ? `${formatNumber(r.run)} ${meterUnit(r.meterType)}` : '—') },
    { key: 'tyreCost', label: 'Tyre cost', align: 'right', sortable: true, sortValue: (r) => r.tyreCost, render: (r) => money(r.tyreCost) },
    { key: 'punctureCost', label: 'Puncture cost', align: 'right', sortable: true, sortValue: (r) => r.punctureCost, render: (r) => money(r.punctureCost) },
    { key: 'total', label: 'Total', align: 'right', sortable: true, sortValue: (r) => r.totalCost, render: (r) => <span className="font-semibold">{money(r.totalCost)}</span> },
  ];
  return (
    <>
      <Tiles
        items={[
          ['Vehicles & machines', String(t.assets)],
          ['Tyres fitted', String(t.tyresFitted), 'New and spare'],
          ['Punctures', String(t.punctures), formatCurrency(t.punctureCost)],
          ['Total tyre cost', formatCurrency(t.totalCost), 'Tyres + punctures'],
        ]}
      />
      <ReportTable
        title="By vehicle & machine"
        subtitle={() =>
          `${data.rows.length} ${data.rows.length === 1 ? 'vehicle or machine' : 'vehicles & machines'} · tyre cost = each tyre's purchase cost when first fitted (refitted spares add nothing)`
        }
        noun="vehicle"
        rows={data.rows}
        columns={columns}
        getRowKey={(r) => r.key}
        searchText={(r) => `${r.assetLabel ?? ''} ${r.assetId} ${r.siteName ?? ''}`}
        emptyMessage="No tyres were fitted or punctured in this period."
      />
    </>
  );
}

export function CostReport({ data }) {
  const t = data.totals;
  const typeColumns = [
    {
      key: 'type',
      label: 'Tyre type',
      sortable: true,
      sortValue: (r) => r.tyreTypeLabel ?? '',
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-steel-900">{r.tyreTypeLabel}</span>
          <span className="text-xs text-steel-500">{r.tyreSize}</span>
        </div>
      ),
    },
    { key: 'bought', label: 'Bought', align: 'right', sortable: true, sortValue: (r) => r.bought, render: (r) => num(r.bought) },
    { key: 'purchaseCost', label: 'Purchase cost', align: 'right', sortable: true, sortValue: (r) => r.purchaseCost, render: (r) => money(r.purchaseCost) },
    { key: 'newStore', label: 'New Store', align: 'right', sortable: true, sortValue: (r) => r.newStore, render: (r) => num(r.newStore) },
    { key: 'spareStore', label: 'Spare Store', align: 'right', sortable: true, sortValue: (r) => r.spareStore, render: (r) => num(r.spareStore) },
    { key: 'fitted', label: 'Fitted', align: 'right', sortable: true, sortValue: (r) => r.fitted, render: (r) => num(r.fitted) },
    { key: 'scrapped', label: 'Scrapped', align: 'right', sortable: true, sortValue: (r) => r.scrapped, render: (r) => num(r.scrapped) },
    { key: 'repairCost', label: 'Puncture & remould', align: 'right', sortable: true, sortValue: (r) => r.repairCost, render: (r) => money(r.repairCost) },
  ];
  const supplierColumns = [
    { key: 'supplierName', label: 'Supplier', sortable: true, sortValue: (r) => r.supplierName ?? '', render: (r) => <span className="font-semibold text-steel-900">{r.supplierName}</span> },
    { key: 'purchases', label: 'Purchases', align: 'right', sortable: true, sortValue: (r) => r.purchases, render: (r) => num(r.purchases) },
    { key: 'tyres', label: 'Tyres', align: 'right', sortable: true, sortValue: (r) => r.tyres, render: (r) => num(r.tyres) },
    { key: 'beforeTax', label: 'Before GST', align: 'right', sortable: true, sortValue: (r) => r.beforeTax, render: (r) => money(r.beforeTax) },
    { key: 'tax', label: 'GST', align: 'right', sortable: true, sortValue: (r) => r.tax, render: (r) => money(r.tax) },
    { key: 'total', label: 'Total', align: 'right', sortable: true, sortValue: (r) => r.total, render: (r) => <span className="font-semibold">{money(r.total)}</span> },
  ];

  return (
    <>
      <Tiles
        items={[
          ['Bought', formatCurrency(t.purchaseCost), `${t.tyresBought} tyres · GST ${formatCurrency(t.purchaseTax)}`],
          ['Punctures', formatCurrency(t.punctureCost), count(t.punctures, 'repair')],
          ['Remould / renewal', formatCurrency(t.remouldCost), count(t.remoulds, 'tyre')],
          ['Scrapped', count(t.scrapped, 'tyre'), `Cost ${formatCurrency(t.scrappedTyreCost)} · scrap value ${formatCurrency(t.scrapValue)}`],
        ]}
      />
      <p className="mb-4 text-sm text-steel-600">
        Now in stores: <span className="font-semibold">{t.newStore}</span> new ({formatCurrency(t.newStoreValue)}) · <span className="font-semibold">{t.spareStore}</span> spare ·{' '}
        <span className="font-semibold">{t.fitted}</span> fitted · <span className="font-semibold">{t.atRemould}</span> at remould
        {t.sparesAdded ? ` · ${t.sparesAdded} spare tyres added in this period` : ''}
      </p>
      <ReportTable title="By tyre type" noun="tyre type" rows={data.byType} columns={typeColumns} getRowKey={(r) => r.tyreTypeId} searchText={(r) => `${r.tyreTypeLabel ?? ''} ${r.tyreSize ?? ''}`} emptyMessage="No tyres yet." />
      <ReportTable className="mt-4" title="By supplier" noun="supplier" rows={data.bySupplier} columns={supplierColumns} getRowKey={(r) => r.key} searchText={(r) => r.supplierName ?? ''} emptyMessage="No tyre purchases in this period." />
    </>
  );
}

const LOADERS = { assets: tyresApi.assetReport, costs: tyresApi.costReport };

export default function TyreReportsPage() {
  const { role, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const siteNames = useSiteNames();
  const [tab, setTab] = useState('assets');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', siteId: '', assetType: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    LOADERS[tab]({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      siteId: filters.siteId || undefined,
      assetType: tab === 'assets' ? filters.assetType || undefined : undefined,
    })
      .then((r) => !cancelled && setData({ tab, report: r.data }))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tab, filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-steel-900">Tyre Reports</h1>
        <p className="mt-1 text-steel-500">Tyre cost for each vehicle and machine, and where the tyre money went. Leave the dates empty to see all records.</p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} max={filters.dateTo || todayDateOnly()} onChange={set('dateFrom')} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} min={filters.dateFrom || undefined} max={todayDateOnly()} onChange={set('dateTo')} />
        {picksSite && (
          <Select aria-label="Site" value={filters.siteId} onChange={set('siteId')}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        {tab === 'assets' && (
          <Select aria-label="Asset type" value={filters.assetType} onChange={set('assetType')}>
            <option value="">Vehicles &amp; machinery</option>
            <option value="VEHICLE">Vehicles</option>
            <option value="MACHINERY">Machinery</option>
          </Select>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <Alert tone="error">{error}</Alert>
      {data?.tab !== tab && !error && <Spinner label="Loading report" />}
      {data?.tab === tab && tab === 'assets' && <AssetReport data={data.report} />}
      {data?.tab === tab && tab === 'costs' && <CostReport data={data.report} />}
    </div>
  );
}
