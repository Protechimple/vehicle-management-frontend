import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { centringApi, listAll } from '../../api/client';
import { Alert, Input, Pagination, Select, Spinner, Table, Tabs } from '../../components/ui';
import PrintReportButton from '../../components/PrintReport';
import { useAuth } from '../../context/AuthContext';
import { ENTRY_TYPES, EntryDateCell, EntryTypeBadge, entryDateTime, formatQuantity, useCentringSites } from '../../components/centring/centringCommon';
import { formatCurrency, formatDateOnly } from '../../config/fuel';

const PAGE_SIZE = 20;

const TABS = [
  { value: 'balances', label: 'Stock Balances' },
  { value: 'transactions', label: 'Transaction History' },
];

// What one history row was for, in words.
function transactionDetail(t) {
  if (t.entryType === 'purchase') return [t.supplierName, t.billNumber && `Bill ${t.billNumber}`].filter(Boolean).join(' · ');
  if (t.entryType === 'issue') return [t.purpose, t.issuedTo && `To ${t.issuedTo}`].filter(Boolean).join(' · ');
  if (t.entryType === 'transfer') return t.quantity < 0 ? `To ${t.otherSiteName}` : `From ${t.otherSiteName}`;
  return t.reason ?? '';
}

const signedValue = (t) => `${t.amount < 0 ? '−' : ''}${formatCurrency(Math.abs(t.amount))}`;

const signedQuantity = (t) => `${t.quantity > 0 ? '+' : t.quantity < 0 ? '−' : ''}${formatQuantity(Math.abs(t.quantity), t.unit)}`;

export default function CentringStockPage() {
  const { can } = useAuth();
  const seesCost = can('CENTRING', 'VIEW_COST');
  const sites = useCentringSites();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'transactions' ? 'transactions' : 'balances';
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: '', siteId: '', categoryId: '' });
  const [history, setHistory] = useState({ siteId: '', itemId: '', entryType: '', dateFrom: '', dateTo: '', page: 1 });
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listAll(centringApi.categories.list)
      .then((r) => setCategories(r.data))
      .catch(() => setCategories([]));
    listAll(centringApi.items.list)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (tab !== 'balances') return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      setError(null);
      centringApi
        .stock({ search: filters.search || undefined, siteId: filters.siteId || undefined, categoryId: filters.categoryId || undefined })
        .then((r) => !cancelled && setData(r.data))
        .catch((err) => !cancelled && setError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, filters]);

  const historyParams = (h) => ({
    siteId: h.siteId || undefined,
    itemId: h.itemId || undefined,
    entryType: h.entryType || undefined,
    dateFrom: h.dateFrom || undefined,
    dateTo: h.dateTo || undefined,
  });

  useEffect(() => {
    if (tab !== 'transactions') return undefined;
    let cancelled = false;
    setError(null);
    centringApi
      .transactions({ ...historyParams(history), page: history.page, limit: PAGE_SIZE })
      .then((r) => !cancelled && setTransactions(r))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tab, history]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const setHistoryFilter = (key, value) => setHistory((h) => ({ ...h, [key]: value, page: 1 }));
  const siteNameOf = (id) => (id ? (sites?.own.find((s) => String(s.id) === String(id))?.name ?? '—') : null);

  // One row for each item at each site, so an item held at many sites reads as plainly as one held at a single site.
  const toRows = (list) =>
    list.flatMap((item) => item.sites.map((s) => ({ ...item, key: `${item.id}-${s.siteId}`, siteId: s.siteId, siteName: s.siteName, siteQuantity: s.quantity, siteValue: s.value })));
  const rows = toRows(data?.items ?? []);

  async function buildBalancesReport() {
    const stock = (await centringApi.stock({ search: filters.search || undefined, siteId: filters.siteId || undefined, categoryId: filters.categoryId || undefined })).data;
    const printRows = toRows(stock.items);
    const categoryName = filters.categoryId ? (categories.find((c) => String(c.id) === String(filters.categoryId))?.categoryName ?? '—') : null;
    return {
      title: 'Centring Stock',
      filters: [
        ...(filters.search.trim() ? [{ label: 'Search', value: filters.search.trim() }] : []),
        ...(filters.siteId ? [{ label: 'Site', value: siteNameOf(filters.siteId) }] : []),
        ...(categoryName ? [{ label: 'Category', value: categoryName }] : []),
      ],
      summary: [
        { label: 'Items', value: String(stock.items.length) },
        { label: 'Sites', value: String(new Set(printRows.map((r) => r.siteId)).size) },
        ...(seesCost ? [{ label: 'Stock value', value: formatCurrency(stock.totalValue) }] : []),
      ],
      sections: [
        {
          title: 'Stock by site',
          rows: printRows,
          getRowKey: (r) => r.key,
          emptyMessage: 'No stock matches these filters.',
          columns: [
            { key: 'item', label: 'Item', width: seesCost ? '22%' : '28%', render: (r) => r.itemName },
            { key: 'category', label: 'Category', width: '14%', render: (r) => r.categoryName },
            { key: 'subCategory', label: 'Sub category', width: seesCost ? '16%' : '20%', render: (r) => r.subCategoryName },
            { key: 'site', label: 'Site', width: seesCost ? '18%' : '24%', render: (r) => r.siteName },
            { key: 'quantity', label: 'Quantity', align: 'right', width: seesCost ? '10%' : '14%', render: (r) => formatQuantity(r.siteQuantity, r.unit) },
            ...(seesCost
              ? [
                  { key: 'rate', label: 'Avg rate', align: 'right', width: '9%', render: (r) => formatCurrency(r.averageRate) },
                  { key: 'value', label: 'Value', align: 'right', width: '11%', render: (r) => formatCurrency(r.siteValue) },
                ]
              : []),
          ],
        },
      ],
    };
  }

  // Every row matching the filters, not just this page of them.
  async function buildTransactionsReport() {
    const { data: list } = await listAll(centringApi.transactions, historyParams(history));
    const itemName = history.itemId ? (items.find((i) => String(i.id) === String(history.itemId))?.itemName ?? '—') : null;
    return {
      title: 'Centring Transaction History',
      filters: [
        ...(history.siteId ? [{ label: 'Site', value: siteNameOf(history.siteId) }] : []),
        ...(itemName ? [{ label: 'Item', value: itemName }] : []),
        ...(history.entryType ? [{ label: 'Type', value: ENTRY_TYPES[history.entryType].label }] : []),
        ...(history.dateFrom ? [{ label: 'From', value: formatDateOnly(history.dateFrom) }] : []),
        ...(history.dateTo ? [{ label: 'To', value: formatDateOnly(history.dateTo) }] : []),
      ],
      summary: [
        { label: 'Transactions', value: String(list.length) },
        ...Object.entries(ENTRY_TYPES).map(([type, meta]) => ({ label: meta.label, value: String(list.filter((t) => t.entryType === type).length) })),
      ],
      sections: [
        {
          title: 'Transactions',
          rows: list,
          getRowKey: (t) => t.id,
          emptyMessage: 'No transactions match these filters.',
          columns: [
            { key: 'reference', label: 'Reference', width: seesCost ? '10%' : '11%', render: (t) => t.entryNumber },
            { key: 'type', label: 'Type', width: seesCost ? '8%' : '9%', render: (t) => ENTRY_TYPES[t.entryType]?.label ?? t.entryType },
            { key: 'item', label: 'Item', width: seesCost ? '12%' : '16%', render: (t) => t.itemName ?? '—' },
            { key: 'site', label: 'Site', width: seesCost ? '10%' : '13%', render: (t) => t.siteName },
            { key: 'details', label: 'Details', width: seesCost ? '12%' : '16%', render: (t) => transactionDetail(t) || '—' },
            { key: 'quantity', label: 'Quantity', align: 'right', width: seesCost ? '8%' : '10%', render: signedQuantity },
            ...(seesCost
              ? [
                  { key: 'rate', label: 'Unit cost (incl. tax)', align: 'right', width: '10%', render: (t) => formatCurrency(t.rate) },
                  { key: 'amount', label: 'Total cost (incl. tax)', align: 'right', width: '11%', render: signedValue },
                ]
              : []),
            { key: 'date', label: 'Date', width: seesCost ? '11%' : '13%', render: (t) => entryDateTime(t) },
            { key: 'by', label: 'By', width: seesCost ? '8%' : '12%', render: (t) => t.createdByName ?? '—' },
          ],
        },
      ],
    };
  }

  const balanceColumns = [
    { key: 'item', label: 'Item', render: (r) => <span className="font-semibold whitespace-nowrap text-steel-900">{r.itemName}</span> },
    { key: 'category', label: 'Category', render: (r) => <span className="whitespace-nowrap">{r.categoryName}</span> },
    { key: 'subCategory', label: 'Sub category', render: (r) => <span className="whitespace-nowrap">{r.subCategoryName}</span> },
    { key: 'site', label: 'Site', render: (r) => <span className="whitespace-nowrap">{r.siteName}</span> },
    { key: 'quantity', label: 'Quantity', align: 'right', render: (r) => <span className="font-semibold whitespace-nowrap tabular-nums">{formatQuantity(r.siteQuantity, r.unit)}</span> },
    ...(seesCost
      ? [
          { key: 'rate', label: 'Avg rate', align: 'right', render: (r) => <span className="whitespace-nowrap text-steel-600 tabular-nums">{formatCurrency(r.averageRate)}</span> },
          { key: 'value', label: 'Value', align: 'right', render: (r) => <span className="font-semibold whitespace-nowrap tabular-nums">{formatCurrency(r.siteValue)}</span> },
        ]
      : []),
    {
      key: 'history',
      label: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          className="text-sm font-semibold whitespace-nowrap text-brand-600 hover:underline"
          onClick={() => {
            setHistory({ siteId: String(r.siteId), itemId: String(r.id), entryType: '', dateFrom: '', dateTo: '', page: 1 });
            setParams({ tab: 'transactions' }, { replace: true });
          }}
        >
          History
        </button>
      ),
    },
  ];

  // Like Inventory's ledger: one row per item moved, each fact in its own column.
  const transactionColumns = [
    {
      key: 'reference',
      label: 'Reference',
      render: (t) => (
        <Link to={`/centring/movements/${t.entryId}`} className="font-semibold whitespace-nowrap text-brand-600 hover:underline">
          {t.entryNumber}
        </Link>
      ),
    },
    { key: 'type', label: 'Type', render: (t) => <EntryTypeBadge type={t.entryType} /> },
    { key: 'item', label: 'Item', render: (t) => <span className="block max-w-52 min-w-24 font-semibold whitespace-normal text-steel-900">{t.itemName ?? '—'}</span> },
    { key: 'site', label: 'Site', render: (t) => <span className="block max-w-40 min-w-20 whitespace-normal">{t.siteName}</span> },
    { key: 'details', label: 'Details', render: (t) => <span className="block max-w-48 min-w-24 text-sm whitespace-normal text-steel-700">{transactionDetail(t) || '—'}</span> },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      render: (t) => <span className={`font-semibold whitespace-nowrap tabular-nums ${t.quantity < 0 ? 'text-danger-600' : 'text-success-600'}`}>{signedQuantity(t)}</span>,
    },
    ...(seesCost
      ? [
          { key: 'rate', label: 'Unit cost', align: 'right', render: (t) => <span className="whitespace-nowrap text-steel-600 tabular-nums">{formatCurrency(t.rate)}</span> },
          { key: 'amount', label: 'Total cost', align: 'right', render: (t) => <span className="font-semibold whitespace-nowrap tabular-nums">{signedValue(t)}</span> },
        ]
      : []),
    { key: 'date', label: 'Date', render: (t) => <EntryDateCell entry={t} /> },
  ];

  const siteOptions = (
    <>
      <option value="">All sites</option>
      {(sites?.own ?? []).map((s) => (
        <option key={s.id} value={s.id} data-added={s.id}>
          {s.name}
        </option>
      ))}
    </>
  );

  const historyFiltered = history.siteId || history.itemId || history.entryType || history.dateFrom || history.dateTo;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Centring Stock</h1>
          <p className="mt-1 text-steel-500">How much of each item is at each site, and every movement of it.{seesCost ? ' Costs include tax.' : ''}</p>
        </div>
        <PrintReportButton key={tab} buildReport={tab === 'balances' ? buildBalancesReport : buildTransactionsReport} onError={setError} />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={(value) => setParams(value === 'balances' ? {} : { tab: value }, { replace: true })} />

      <Alert tone="error">{error}</Alert>

      {tab === 'balances' ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
            <Input placeholder="Search item" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
            <Select aria-label="Site" value={filters.siteId} onChange={(e) => setFilter('siteId', e.target.value)}>
              {siteOptions}
            </Select>
            <Select aria-label="Category" value={filters.categoryId} onChange={(e) => setFilter('categoryId', e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} data-added={c.id}>
                  {c.categoryName}
                </option>
              ))}
            </Select>
          </div>

          {data && data.items.length > 0 && (
            <p className="mb-3 text-sm text-steel-600">
              {data.items.length} {data.items.length === 1 ? 'item' : 'items'} at {new Set(rows.map((r) => r.siteId)).size}{' '}
              {new Set(rows.map((r) => r.siteId)).size === 1 ? 'site' : 'sites'}
              {seesCost && (
                <>
                  {' · '}Stock value <span className="font-semibold text-steel-900 tabular-nums">{formatCurrency(data.totalValue)}</span>
                </>
              )}
            </p>
          )}

          <div className="rounded border border-steel-200 bg-surface">
            {!data ? (
              <Spinner label="Loading stock" />
            ) : (
              <Table
                columns={balanceColumns}
                rows={rows}
                getRowKey={(r) => r.key}
                emptyMessage={filters.search || filters.siteId || filters.categoryId ? 'No stock matches these filters.' : 'No centring stock yet. Record a purchase to begin.'}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Select aria-label="Site" value={history.siteId} onChange={(e) => setHistoryFilter('siteId', e.target.value)}>
              {siteOptions}
            </Select>
            <Select aria-label="Item" value={history.itemId} onChange={(e) => setHistoryFilter('itemId', e.target.value)}>
              <option value="">All items</option>
              {items.map((i) => (
                <option key={i.id} value={i.id} data-added={i.id}>
                  {i.itemName}
                </option>
              ))}
            </Select>
            <Select aria-label="Type" value={history.entryType} onChange={(e) => setHistoryFilter('entryType', e.target.value)}>
              <option value="">All types</option>
              {Object.entries(ENTRY_TYPES).map(([type, meta]) => (
                <option key={type} value={type}>
                  {meta.label}
                </option>
              ))}
            </Select>
            <Input type="date" aria-label="From date" title="From date" value={history.dateFrom} max={history.dateTo || undefined} onChange={(e) => setHistoryFilter('dateFrom', e.target.value)} />
            <Input type="date" aria-label="To date" title="To date" value={history.dateTo} min={history.dateFrom || undefined} onChange={(e) => setHistoryFilter('dateTo', e.target.value)} />
          </div>

          <div className="rounded border border-steel-200 bg-surface">
            {!transactions ? (
              <Spinner label="Loading transaction history" />
            ) : (
              <>
                <Table
                  columns={transactionColumns}
                  rows={transactions.data}
                  getRowKey={(t) => t.id}
                  emptyMessage={historyFiltered ? 'No transactions match these filters.' : 'No transactions yet. Record a purchase to begin.'}
                />
                <Pagination
                  page={transactions.pagination.page}
                  pages={transactions.pagination.pages}
                  total={transactions.pagination.total}
                  pageSize={transactions.pagination.limit}
                  showPageNumbers
                  onPageChange={(page) => setHistory((h) => ({ ...h, page }))}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
