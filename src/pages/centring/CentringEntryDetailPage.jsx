import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { centringApi } from '../../api/client';
import { Alert, BackLink, Button, Card, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import { useAuth } from '../../context/AuthContext';
import { EntryTypeBadge, entryDateTime, formatQuantity } from '../../components/centring/centringCommon';
import { formatCurrency } from '../../config/fuel';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-steel-900">{children || '—'}</dd>
    </div>
  );
}

export default function CentringEntryDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useAuth();
  const seesCost = can('CENTRING', 'VIEW_COST');
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState(null);
  const [notice] = useState(location.state?.message ?? null);
  const [deleting, setDeleting] = useState(false);
  const [deleteState, setDeleteState] = useState({ pending: false, error: null });

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    centringApi
      .getEntry(id)
      .then((r) => setEntry(r.data))
      .catch((err) => setError(err.message));
  }, [id]);

  async function confirmDelete() {
    setDeleteState({ pending: true, error: null });
    try {
      await centringApi.deleteEntry(id, 'DELETE');
      navigate('/centring/movements', { state: { message: `${entry.entryNumber} deleted` } });
    } catch (err) {
      setDeleteState({ pending: false, error: err.message });
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!entry) return <Spinner label="Loading entry" />;

  const isPurchase = entry.entryType === 'purchase';
  const isAdjustment = entry.entryType === 'adjustment';
  const columns = [
    { key: 'item', label: 'Item', render: (l) => <span className="font-semibold text-steel-900">{l.itemName}</span> },
    { key: 'group', label: 'Category › Sub category', render: (l) => [l.categoryName, l.subCategoryName].filter(Boolean).join(' › ') },
    {
      key: 'quantity',
      label: isAdjustment ? 'Change' : entry.entryType === 'issue' ? 'Issued' : 'Quantity',
      align: 'right',
      render: (l) => (
        <span className="font-semibold whitespace-nowrap tabular-nums">
          {isAdjustment ? (l.direction === 'out' ? '−' : '+') : ''}
          {formatQuantity(l.quantity, l.unit)}
        </span>
      ),
    },
    ...(seesCost && isPurchase
      ? [
          { key: 'price', label: 'Unit price', align: 'right', render: (l) => <span className="tabular-nums">{formatCurrency(l.unitPrice)}</span> },
          { key: 'tax', label: 'Tax %', align: 'right', render: (l) => <span className="tabular-nums">{l.taxPercent}%</span> },
        ]
      : []),
    ...(seesCost ? [{ key: 'amount', label: isPurchase ? 'Total incl. tax' : 'Value', align: 'right', render: (l) => <span className="tabular-nums">{formatCurrency(l.amount)}</span> }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackLink to="/centring/movements" label="Centring Movements" />
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-steel-900">
            {entry.entryNumber} <EntryTypeBadge type={entry.entryType} />
          </h1>
        </div>
        <Can resource="CENTRING" action="DELETE">
          <Button variant="secondary" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Date">{entryDateTime(entry)}</Detail>
          {isPurchase && <Detail label="Supplier">{entry.supplierName}</Detail>}
          {isPurchase && <Detail label="Bill no.">{entry.billNumber}</Detail>}
          {entry.entryType === 'transfer' ? (
            <>
              <Detail label="From site">{entry.fromSiteName}</Detail>
              <Detail label="To site">{entry.siteName}</Detail>
            </>
          ) : (
            <Detail label="Site">{entry.siteName}</Detail>
          )}
          {entry.entryType === 'issue' && <Detail label="Purpose">{entry.purpose}</Detail>}
          {entry.entryType === 'issue' && <Detail label="Issued to">{entry.issuedTo}</Detail>}
          {isAdjustment && <Detail label="Reason">{entry.reason}</Detail>}
          {seesCost && <Detail label={isPurchase ? 'Total incl. tax' : 'Value'}>{formatCurrency(entry.totalAmount)}</Detail>}
          <Detail label="Recorded by">{entry.createdByName}</Detail>
          <Detail label="Remarks">{entry.remarks}</Detail>
        </dl>
      </Card>

      <div className="mt-4 rounded border border-steel-200 bg-surface">
        <Table columns={columns} rows={entry.lines} getRowKey={(l) => l.itemId} />
      </div>
      {isAdjustment && entry.reason === 'Stock count' && <p className="mt-2 text-xs text-steel-500">A stock count saves only the items whose count differed from the system.</p>}

      <DeleteWordModal
        open={deleting}
        title={`Delete ${entry.entryNumber}?`}
        description="The stock goes back to what it was before this entry. This cannot be undone."
        pending={deleteState.pending}
        error={deleteState.error}
        onCancel={() => {
          setDeleting(false);
          setDeleteState({ pending: false, error: null });
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
