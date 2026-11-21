import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Button, Card, Spinner, Table } from '../../components/ui';
import Can from '../../components/Can';
import { ACTIONS, TyreActionForm, TyreStatusBadge, TyreWhere, actionsFor } from '../../components/tyres/TyreForms';
import { EVENT_LABELS, assetTyresPath, formatCurrency, formatNumber, formatRunTotals, formatWhen, meterUnit } from '../../config/tyres';

function Tile({ label, value, hint }) {
  return (
    <div className="rounded border border-steel-200 bg-surface px-3 py-2.5">
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-steel-500">{hint}</dd>}
    </div>
  );
}

function eventDetails(e) {
  const parts = [];
  if (e.assetLabel) parts.push(
    <Link key="asset" to={assetTyresPath(e.assetType, e.assetId)} className="font-semibold text-brand-600 hover:underline">
      {e.assetLabel}
    </Link>
  );
  if (e.position) parts.push(e.position);
  if (e.meterReading != null) parts.push(`at ${formatNumber(e.meterReading)} ${meterUnit(e.meterType)}`);
  if (e.runValue != null) parts.push(`ran ${formatNumber(e.runValue)} ${meterUnit(e.meterType)}`);
  if (e.vendor) parts.push(e.vendor);
  if (e.notes) parts.push(e.notes);
  if (!e.assetLabel && e.siteName) parts.push(e.siteName);
  return parts.reduce((all, part, i) => (i === 0 ? [part] : [...all, ' · ', part]), []);
}

export default function TyreDetailPage() {
  const { id } = useParams();
  const [tyre, setTyre] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    try {
      setTyre((await tyresApi.get(id)).data);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !tyre) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{error}</Alert>
        <Link to="/tyres/stores" className="font-semibold text-brand-600 hover:underline">
          Back to Tyre Stores
        </Link>
      </div>
    );
  }
  if (!tyre) return <Spinner label="Loading tyre" />;

  const perUnit = [tyre.costPerKm != null ? `${formatCurrency(tyre.costPerKm)} / KM` : null, tyre.costPerHour != null ? `${formatCurrency(tyre.costPerHour)} / hr` : null].filter(Boolean).join(' · ');
  const columns = [
    { key: 'date', label: 'Date & time', render: (e) => <span className="whitespace-nowrap">{formatWhen(e.eventDate, e.eventTime)}</span> },
    { key: 'event', label: 'What happened', render: (e) => <span className="font-semibold text-steel-900">{EVENT_LABELS[e.eventType] ?? e.eventType}</span> },
    { key: 'details', label: 'Details', render: (e) => <span className="text-steel-700">{eventDetails(e)}</span> },
    { key: 'amount', label: 'Amount', align: 'right', render: (e) => <span className="tabular-nums">{e.amount ? formatCurrency(e.amount) : '—'}</span> },
    { key: 'by', label: 'By', render: (e) => <span className="text-xs text-steel-500">{e.createdByName ?? '—'}</span> },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/tyres/stores" className="text-sm font-semibold text-brand-600 hover:underline">
            ← Tyre Stores
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-steel-900">
            {tyre.tyreCode} <TyreStatusBadge status={tyre.status} />
          </h1>
          <p className="mt-0.5 text-steel-500">
            {tyre.tyreTypeLabel} · {tyre.tyreSize}
            {tyre.serialNumber ? ` · SN ${tyre.serialNumber}` : ''}
          </p>
        </div>
        <Can resource="TYRE" action="UPDATE">
          <div className="flex flex-wrap gap-2">
            {actionsFor(tyre, { detail: true }).map((a, index) => (
              <Button key={a} size="sm" variant={a === 'scrap' ? 'danger' : index === 0 ? 'primary' : 'secondary'} onClick={() => setActing(a)}>
                {ACTIONS[a].label}
              </Button>
            ))}
            {(tyre.status === 'new' || tyre.status === 'spare') && (
              <Can resource="TYRE" action="TRANSFER">
                <Button size="sm" variant="secondary" as={Link} to={`/tyres/transfers/new?from=${tyre.siteId}&tyre=${tyre.id}`}>
                  Move to another site
                </Button>
              </Can>
            )}
          </div>
        </Can>
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Purchase cost" value={formatCurrency(tyre.purchaseCost)} hint={tyre.purchaseId ? 'Incl. GST' : 'Spare tyre — no purchase cost'} />
        <Tile label="Punctures & remould" value={formatCurrency(tyre.repairCost)} />
        <Tile label="Total cost" value={formatCurrency(tyre.totalCost)} hint={perUnit || null} />
        <Tile label="Total run" value={formatRunTotals(tyre)} />
      </dl>

      <Card title="Now" className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
          <TyreWhere tyre={tyre} />
          {tyre.purchaseId && (
            <Link to={`/tyres/purchases/${tyre.purchaseId}`} className="font-semibold text-brand-600 hover:underline">
              View purchase
            </Link>
          )}
        </div>
        {tyre.status === 'scrapped' && (
          <p className="mt-2 text-sm text-steel-600">
            Reason: {tyre.scrapReason ?? '—'}
            {tyre.scrapValue != null ? ` · Scrap value received ${formatCurrency(tyre.scrapValue)}` : ''}
          </p>
        )}
        {tyre.notes && <p className="mt-2 text-sm whitespace-pre-line text-steel-600">{tyre.notes}</p>}
      </Card>

      <Card title="History">
        <Table columns={columns} rows={[...tyre.events].reverse()} getRowKey={(e) => e.id} emptyMessage="No history yet." />
      </Card>

      <TyreActionForm
        key={acting ?? 'none'}
        action={acting}
        tyre={tyre}
        onClose={() => setActing(null)}
        onDone={(message, data) => {
          setActing(null);
          setNotice(message);
          if (data?.id === tyre.id) setTyre(data);
          else load();
        }}
      />
    </div>
  );
}
