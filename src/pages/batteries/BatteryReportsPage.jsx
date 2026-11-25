import { useEffect, useState } from 'react';
import { batteriesApi } from '../../api/client';
import { Alert, Input, Pagination, Select, Spinner, Table } from '../../components/ui';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, formatDateOnly, todayDateOnly } from '../../config/batteries';

const ASSET_PAGE_SIZE = 20;

const money = (value, strong = false) =>
  !value ? <span className="text-steel-400">—</span> : <span className={`whitespace-nowrap tabular-nums ${strong ? 'font-semibold text-steel-900' : ''}`}>{formatCurrency(value)}</span>;

const count = (value, strong = false) =>
  !value ? <span className="text-steel-400">—</span> : <span className={`tabular-nums ${strong ? 'font-semibold text-steel-900' : ''}`}>{value}</span>;

function Summary({ items }) {
  return (
    <dl className="mb-4 grid gap-4 rounded border border-steel-200 bg-surface px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, detail]) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
          <dd className="mt-0.5 text-xs text-steel-500">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

// What batteries cost each site, and how batteries changed on each vehicle and machine.
export default function BatteryReportsPage() {
  const { canPickSite } = useAuth();
  const siteNames = useSiteNames();
  const [filters, setFilters] = useState({ siteId: '', dateFrom: '', dateTo: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [assetPage, setAssetPage] = useState(1);

  async function fetchReports(active) {
    const params = { siteId: active.siteId || undefined, dateFrom: active.dateFrom || undefined, dateTo: active.dateTo || undefined };
    const [costs, assets] = await Promise.all([batteriesApi.costReport(params), batteriesApi.assetReport(params)]);
    return { costs: costs.data, assets: assets.data };
  }

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setAssetPage(1);
    fetchReports(filters)
      .then((r) => !cancelled && setData(r))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const period = filters.dateFrom || filters.dateTo ? 'In the chosen period' : 'All time';
  const spent = (r) => (r.purchaseCost ?? 0) + (r.repairCost ?? 0);

  const siteColumns = [
    { key: 'site', label: 'Site', render: (r) => <span className={r.isTotal ? 'font-semibold text-steel-900' : 'whitespace-nowrap'}>{r.siteName ?? '—'}</span> },
    { key: 'purchased', label: 'Bought', align: 'right', render: (r) => count(r.purchased, r.isTotal) },
    { key: 'purchaseCost', label: 'Purchase cost', align: 'right', render: (r) => money(r.purchaseCost, r.isTotal) },
    { key: 'repairs', label: 'Repairs', align: 'right', render: (r) => count(r.repairs, r.isTotal) },
    { key: 'repairCost', label: 'Repair cost', align: 'right', render: (r) => money(r.repairCost, r.isTotal) },
    { key: 'scrapped', label: 'Scrapped', align: 'right', render: (r) => count(r.scrapped, r.isTotal) },
    { key: 'scrapValue', label: 'Scrap sale', align: 'right', render: (r) => money(r.scrapValue, r.isTotal) },
    { key: 'spent', label: 'Total spent', align: 'right', render: (r) => money(spent(r), true) },
    { key: 'readyNow', label: 'In store', align: 'right', render: (r) => count(r.readyNow, r.isTotal) },
    { key: 'needsRepairNow', label: 'Under repair', align: 'right', render: (r) => count(r.needsRepairNow, r.isTotal) },
  ];

  const fittedNowText = (r) => r.fittedNow.map((b) => [b.batteryCode, b.position].filter(Boolean).join(' · '));

  const assetColumns = [
    {
      key: 'asset',
      label: 'Vehicle / machine',
      render: (r) => (
        <div className="flex flex-col whitespace-nowrap">
          <span className="font-semibold text-steel-900">{r.assetLabel}</span>
          <span className="text-xs text-steel-500">{r.assetKind}</span>
        </div>
      ),
    },
    { key: 'site', label: 'Site', render: (r) => <span className="whitespace-nowrap">{r.siteName ?? '—'}</span> },
    {
      key: 'fittedNow',
      label: 'Fitted now',
      render: (r) =>
        r.fittedNow.length ? (
          <ul className="whitespace-nowrap">
            {fittedNowText(r).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <span className="text-steel-400">—</span>
        ),
    },
    { key: 'fittings', label: 'Fitted', align: 'right', render: (r) => count(r.fittings) },
    { key: 'removals', label: 'Taken off', align: 'right', render: (r) => count(r.removals) },
    { key: 'toRepair', label: 'Sent to repair', align: 'right', render: (r) => count(r.toRepair) },
    { key: 'scrapped', label: 'Scrapped', align: 'right', render: (r) => count(r.scrapped) },
    { key: 'lastChange', label: 'Last change', render: (r) => <span className="whitespace-nowrap">{r.lastChange ? formatDateOnly(r.lastChange) : '—'}</span> },
  ];

  // The report comes whole; the vehicle / machine table shows it a page at a time. Print / Download still lists all.
  const assetRows = data?.assets.rows ?? [];
  const assetPages = Math.max(1, Math.ceil(assetRows.length / ASSET_PAGE_SIZE));
  const shownAssetPage = Math.min(assetPage, assetPages);
  const assetPageRows = assetRows.slice((shownAssetPage - 1) * ASSET_PAGE_SIZE, shownAssetPage * ASSET_PAGE_SIZE);

  const siteRows = data ? [...data.costs.rows, ...(data.costs.rows.length > 1 ? [{ ...data.costs.totals, siteId: 'total', siteName: 'All sites', isTotal: true }] : [])] : [];

  async function buildPrintReport() {
    const report = await fetchReports(filters);
    const totals = report.costs.totals;
    const amount = (value) => (value ? formatCurrency(value) : '—');
    const number = (value) => (value ? String(value) : '—');
    return {
      title: 'Battery Reports',
      filters: [
        ...(filters.siteId ? [{ label: 'Site', value: siteNames[filters.siteId] ?? '—' }] : []),
        ...(filters.dateFrom ? [{ label: 'From', value: formatDateOnly(filters.dateFrom) }] : []),
        ...(filters.dateTo ? [{ label: 'To', value: formatDateOnly(filters.dateTo) }] : []),
      ],
      summary: [
        { label: 'Total spent', value: formatCurrency(spent(totals)) },
        { label: 'Scrap sale', value: formatCurrency(totals.scrapValue) },
        { label: 'In store now', value: String(totals.readyNow) },
        { label: 'Under repair now', value: String(totals.needsRepairNow) },
      ],
      sections: [
        {
          title: 'By site',
          rows: report.costs.rows,
          getRowKey: (r) => r.siteId,
          emptyMessage: 'No battery costs in this period.',
          columns: [
            { key: 'site', label: 'Site', width: '16%', render: (r) => r.siteName ?? '—' },
            { key: 'purchased', label: 'Bought', align: 'right', width: '7%', render: (r) => number(r.purchased) },
            { key: 'purchaseCost', label: 'Purchase cost', align: 'right', width: '12%', render: (r) => amount(r.purchaseCost) },
            { key: 'repairs', label: 'Repairs', align: 'right', width: '7%', render: (r) => number(r.repairs) },
            { key: 'repairCost', label: 'Repair cost', align: 'right', width: '11%', render: (r) => amount(r.repairCost) },
            { key: 'scrapped', label: 'Scrapped', align: 'right', width: '8%', render: (r) => number(r.scrapped) },
            { key: 'scrapValue', label: 'Scrap sale', align: 'right', width: '10%', render: (r) => amount(r.scrapValue) },
            { key: 'spent', label: 'Total spent', align: 'right', width: '12%', render: (r) => amount(spent(r)) },
            { key: 'readyNow', label: 'In store', align: 'right', width: '7%', render: (r) => number(r.readyNow) },
            { key: 'needsRepairNow', label: 'Under repair', align: 'right', width: '10%', render: (r) => number(r.needsRepairNow) },
          ],
        },
        {
          title: 'By vehicle / machine',
          rows: report.assets.rows,
          getRowKey: (r) => `${r.assetType}:${r.assetId}`,
          emptyMessage: 'No battery changes in this period.',
          columns: [
            { key: 'asset', label: 'Vehicle / machine', width: '20%', render: (r) => [r.assetLabel, r.assetKind] },
            { key: 'site', label: 'Site', width: '15%', render: (r) => r.siteName ?? '—' },
            { key: 'fittedNow', label: 'Fitted now', width: '20%', render: (r) => (r.fittedNow.length ? fittedNowText(r) : '—') },
            { key: 'fittings', label: 'Fitted', align: 'right', width: '8%', render: (r) => number(r.fittings) },
            { key: 'removals', label: 'Taken off', align: 'right', width: '9%', render: (r) => number(r.removals) },
            { key: 'toRepair', label: 'To repair', align: 'right', width: '9%', render: (r) => number(r.toRepair) },
            { key: 'scrapped', label: 'Scrapped', align: 'right', width: '9%', render: (r) => number(r.scrapped) },
            { key: 'lastChange', label: 'Last change', width: '10%', render: (r) => (r.lastChange ? formatDateOnly(r.lastChange) : '—') },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Battery Reports</h1>
          <p className="mt-1 text-steel-500">What batteries cost each site, and how batteries changed on each vehicle and machine.</p>
        </div>
        <PrintReportButton buildReport={buildPrintReport} onError={setError} />
      </div>

      <div className={`mb-4 grid gap-3 sm:grid-cols-2 ${canPickSite ? 'lg:grid-cols-3' : ''} lg:max-w-4xl`}>
        {canPickSite && (
          <Select aria-label="Site" value={filters.siteId} onChange={set('siteId')}>
            <option value="">All sites</option>
            {Object.entries(siteNames).map(([siteId, name]) => (
              <option key={siteId} value={siteId} data-added={siteId}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input type="date" aria-label="From date" title="From date" value={filters.dateFrom} max={filters.dateTo || todayDateOnly()} onChange={set('dateFrom')} />
        <Input type="date" aria-label="To date" title="To date" value={filters.dateTo} min={filters.dateFrom || undefined} max={todayDateOnly()} onChange={set('dateTo')} />
      </div>

      <Alert tone="error">{error}</Alert>

      {!data ? (
        <Spinner label="Loading battery reports" />
      ) : (
        <>
          <Summary
            items={[
              ['Total spent', formatCurrency(spent(data.costs.totals)), `Batteries bought and repaired · ${period.toLowerCase()}`],
              ['Scrap sale', formatCurrency(data.costs.totals.scrapValue), `Money from scrapped batteries · ${period.toLowerCase()}`],
              ['In store now', String(data.costs.totals.readyNow), 'Ready to fit'],
              ['Under repair now', String(data.costs.totals.needsRepairNow), 'Waiting for repair'],
            ]}
          />
          <h2 className="mb-2 text-sm font-semibold text-steel-900">By site</h2>
          <div className="mb-6 rounded border border-steel-200 bg-surface">
            <Table columns={siteColumns} rows={siteRows} getRowKey={(r) => r.siteId} emptyMessage="No battery costs in this period." />
          </div>
          <h2 className="mb-2 text-sm font-semibold text-steel-900">By vehicle / machine</h2>
          <div className="rounded border border-steel-200 bg-surface">
            <Table columns={assetColumns} rows={assetPageRows} getRowKey={(r) => `${r.assetType}:${r.assetId}`} emptyMessage="No battery changes in this period." />
            <Pagination page={shownAssetPage} pages={assetPages} total={assetRows.length} pageSize={ASSET_PAGE_SIZE} showPageNumbers onPageChange={setAssetPage} />
          </div>
        </>
      )}
    </div>
  );
}
