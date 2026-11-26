import { useEffect, useState } from 'react';
import { centringApi } from '../../api/client';
import { Alert, Input, Select, Spinner, Table } from '../../components/ui';
import PrintReportButton from '../../components/PrintReport';
import { useCentringSites } from '../../components/centring/centringCommon';
import { formatCurrency, formatDateOnly } from '../../config/fuel';

const money = (value, strong = false) =>
  value === 0 ? <span className="text-steel-400">—</span> : <span className={`whitespace-nowrap tabular-nums ${strong ? 'font-semibold text-steel-900' : ''}`}>{formatCurrency(value)}</span>;

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

export default function CentringReportsPage() {
  const sites = useCentringSites();
  const [filters, setFilters] = useState({ siteId: '', dateFrom: '', dateTo: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    centringApi
      .reports({ siteId: filters.siteId || undefined, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined })
      .then((r) => !cancelled && setData(r.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const period = filters.dateFrom || filters.dateTo ? 'In the chosen period' : 'All time';

  const siteColumns = [
    { key: 'site', label: 'Site', render: (r) => <span className={r.isTotal ? 'font-semibold text-steel-900' : 'whitespace-nowrap'}>{r.siteName}</span> },
    { key: 'purchased', label: 'Purchased', align: 'right', render: (r) => money(r.purchased, r.isTotal) },
    { key: 'issued', label: 'Issued', align: 'right', render: (r) => money(r.issued, r.isTotal) },
    { key: 'transferIn', label: 'Transfer in', align: 'right', render: (r) => money(r.transferIn, r.isTotal) },
    { key: 'transferOut', label: 'Transfer out', align: 'right', render: (r) => money(r.transferOut, r.isTotal) },
    { key: 'netLoss', label: 'Lost / damaged', align: 'right', render: (r) => money(r.netLoss, r.isTotal) },
    { key: 'stockValue', label: 'Stock value now', align: 'right', render: (r) => money(r.stockValue, true) },
  ];
  const supplierColumns = [
    { key: 'supplierName', label: 'Supplier', render: (r) => <span className="font-semibold text-steel-900">{r.supplierName}</span> },
    { key: 'bills', label: 'Purchases', align: 'right', render: (r) => <span className="tabular-nums">{r.bills}</span> },
    { key: 'amount', label: 'Amount incl. tax', align: 'right', render: (r) => money(r.amount, true) },
  ];

  const rows = data ? [...data.sites, ...(data.sites.length > 1 ? [{ ...data.totals, siteId: 'total', siteName: 'All sites', isTotal: true }] : [])] : [];
  const siteLabel = filters.siteId ? (sites?.own.find((s) => String(s.id) === String(filters.siteId))?.name ?? '—') : null;

  // The printed report is the same as the screen, as plain text.
  async function buildPrintReport() {
    const report = (await centringApi.reports({ siteId: filters.siteId || undefined, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined })).data;
    // The totals are printed in the summary above the table, so the table lists only the sites.
    const printRows = report.sites;
    const amount = (value) => (value === 0 ? '—' : formatCurrency(value));
    return {
      title: 'Centring Reports',
      filters: [
        ...(siteLabel ? [{ label: 'Site', value: siteLabel }] : []),
        ...(filters.dateFrom ? [{ label: 'From', value: formatDateOnly(filters.dateFrom) }] : []),
        ...(filters.dateTo ? [{ label: 'To', value: formatDateOnly(filters.dateTo) }] : []),
      ],
      summary: [
        { label: 'Purchased', value: formatCurrency(report.totals.purchased) },
        { label: 'Issued', value: formatCurrency(report.totals.issued) },
        { label: 'Lost / damaged', value: formatCurrency(report.totals.netLoss) },
        { label: 'Stock value now', value: formatCurrency(report.totals.stockValue) },
      ],
      sections: [
        {
          title: 'By site',
          rows: printRows,
          getRowKey: (r) => r.siteId,
          emptyMessage: 'Nothing recorded yet.',
          columns: [
            { key: 'site', label: 'Site', width: '22%', render: (r) => r.siteName },
            { key: 'purchased', label: 'Purchased', align: 'right', width: '13%', render: (r) => amount(r.purchased) },
            { key: 'issued', label: 'Issued', align: 'right', width: '13%', render: (r) => amount(r.issued) },
            { key: 'transferIn', label: 'Transfer in', align: 'right', width: '13%', render: (r) => amount(r.transferIn) },
            { key: 'transferOut', label: 'Transfer out', align: 'right', width: '13%', render: (r) => amount(r.transferOut) },
            { key: 'netLoss', label: 'Lost / damaged', align: 'right', width: '13%', render: (r) => amount(r.netLoss) },
            { key: 'stockValue', label: 'Stock value now', align: 'right', width: '13%', render: (r) => formatCurrency(r.stockValue) },
          ],
        },
        {
          title: 'Purchases by supplier',
          rows: report.suppliers,
          getRowKey: (r) => r.supplierId,
          emptyMessage: 'No purchases in this period.',
          columns: [
            { key: 'supplier', label: 'Supplier', width: '60%', render: (r) => r.supplierName },
            { key: 'bills', label: 'Purchases', align: 'right', width: '15%', render: (r) => String(r.bills) },
            { key: 'amount', label: 'Amount incl. tax', align: 'right', width: '25%', render: (r) => formatCurrency(r.amount) },
          ],
        },
      ],
    };
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Centring Reports</h1>
          <p className="mt-1 text-steel-500">What each site bought, issued, moved and lost, and what it holds now.</p>
        </div>
        <PrintReportButton buildReport={buildPrintReport} onError={setError} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
        <Select aria-label="Site" value={filters.siteId} onChange={set('siteId')}>
          <option value="">All sites</option>
          {(sites?.own ?? []).map((s) => (
            <option key={s.id} value={s.id} data-added={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="From date" placeholder="From date" value={filters.dateFrom} onChange={set('dateFrom')} />
        <Input type="date" aria-label="To date" placeholder="To date" value={filters.dateTo} onChange={set('dateTo')} />
      </div>

      <Alert tone="error">{error}</Alert>

      {!data ? (
        <Spinner label="Loading reports" />
      ) : (
        <>
          <Summary
            items={[
              ['Purchased', formatCurrency(data.totals.purchased), period],
              ['Issued', formatCurrency(data.totals.issued), `Material issued for work · ${period.toLowerCase()}`],
              ['Lost / damaged', formatCurrency(data.totals.netLoss), `Adjustments, less anything found · ${period.toLowerCase()}`],
              ['Stock value now', formatCurrency(data.totals.stockValue), 'Everything held at the sites today'],
            ]}
          />
          <h2 className="mb-2 text-sm font-semibold text-steel-900">By site</h2>
          <div className="mb-6 rounded border border-steel-200 bg-surface">
            <Table columns={siteColumns} rows={rows} getRowKey={(r) => r.siteId} emptyMessage="Nothing recorded yet." />
          </div>
          <h2 className="mb-2 text-sm font-semibold text-steel-900">Purchases by supplier</h2>
          <div className="rounded border border-steel-200 bg-surface">
            <Table columns={supplierColumns} rows={data.suppliers} getRowKey={(r) => r.supplierId} emptyMessage="No purchases in this period." />
          </div>
          <p className="mt-3 text-xs text-steel-500">Material is valued at each item&apos;s average purchase price (incl. tax).</p>
        </>
      )}
    </div>
  );
}
