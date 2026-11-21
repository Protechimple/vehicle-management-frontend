import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { tyresApi } from '../../api/client';
import { Alert, Badge, Button, Card, Field, Select, Spinner } from '../../components/ui';
import Can from '../../components/Can';
import ReportTable from '../../components/ReportTable';
import { AddSparesForm, FitForm, TyreActionForm, useAssets } from '../../components/tyres/TyreForms';
import { AXLE_OPTIONS, assetPath, assetTyresPath, formatCurrency, formatNumber, formatRunTotals, formatStamp, formatWhen, meterUnit } from '../../config/tyres';

const PRESETS = [
  { label: '4 tyres', axles: [2, 2] },
  { label: '6 tyres', axles: [2, 4] },
  { label: '10 tyres', axles: [2, 4, 4] },
  { label: '12 tyres', axles: [2, 2, 4, 4] },
];

function AxleEditor({ initial, onCancel, onSave, saving, error }) {
  const [axles, setAxles] = useState(initial?.length ? initial : [2, 4]);
  const total = axles.reduce((t, n) => t + n, 0);
  const setAxle = (index, value) => setAxles((all) => all.map((n, i) => (i === index ? Number(value) : n)));

  return (
    <Card title="Axles" subtitle="How many tyres on each axle, front to back. This sets the tyre positions.">
      <Alert tone="error">{error}</Alert>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="self-center text-xs font-semibold text-steel-500 uppercase">Quick:</span>
        {PRESETS.map((p) => (
          <Button key={p.label} size="sm" variant="secondary" onClick={() => setAxles(p.axles)}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {axles.map((count, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={`Axle ${index + 1}`}>
                {({ id }) => (
                  <Select id={id} value={String(count)} onChange={(e) => setAxle(index, e.target.value)}>
                    {AXLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {axles.length > 1 && (
              <button type="button" aria-label={`Remove axle ${index + 1}`} className="mb-5 px-1 text-steel-500 hover:text-danger-600" onClick={() => setAxles((all) => all.filter((_, i) => i !== index))}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="secondary" disabled={axles.length >= 8} onClick={() => setAxles((all) => [...all, 2])}>
          + Add axle
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-steel-600">
            {axles.length} {axles.length === 1 ? 'axle' : 'axles'} · <span className="font-semibold">{total} tyres</span>
          </span>
          {onCancel && (
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" loading={saving} onClick={() => onSave(axles)}>
            Save axles
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PositionSlot({ slot, onFit, onAction }) {
  const t = slot.tyre;
  if (!t) {
    return (
      <div className="flex flex-col justify-between rounded border border-dashed border-steel-300 bg-steel-50 p-2.5">
        <p className="text-xs font-semibold text-steel-500">{slot.position}</p>
        <p className="my-1.5 text-sm text-steel-400">Empty</p>
        <Can resource="TYRE" action="UPDATE">
          <Button size="sm" onClick={onFit}>
            Fit tyre
          </Button>
        </Can>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-between rounded border border-brand-200 bg-surface p-2.5">
      <p className="text-xs font-semibold text-steel-500">{slot.position}</p>
      <div className="my-1.5 text-sm">
        <Link to={`/tyres/${t.id}`} className="font-semibold text-brand-600 hover:underline">
          {t.tyreCode}
        </Link>
        <p className="text-xs text-steel-600">
          {t.tyreTypeLabel} · {t.tyreSize}
        </p>
        <p className="text-xs text-steel-500">
          {formatWhen(t.fittedAt, t.fittedTime)} at {formatNumber(t.fitReading)} {meterUnit(t.meterType)}
        </p>
      </div>
      <Can resource="TYRE" action="UPDATE">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => onAction('takeOff', t)}>
            Take off
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onAction('puncture', t)}>
            Puncture
          </Button>
          <Button size="sm" variant="secondary" onClick={onFit}>
            Replace
          </Button>
        </div>
      </Can>
    </div>
  );
}

const COLS = { 1: 'grid-cols-1 max-w-[12rem]', 2: 'grid-cols-2 max-w-md', 4: 'grid-cols-2 sm:grid-cols-4' };

const axleText = (axles) => `${axles.join(' + ')} = ${axles.reduce((t, n) => t + n, 0)} tyres`;
const when = (at) => formatStamp(at);

function Who({ at, by }) {
  if (!at) return <span className="text-steel-400">—</span>;
  return (
    <div className="flex flex-col">
      <span className="whitespace-nowrap">{when(at)}</span>
      {by && <span className="text-xs text-steel-500">{by}</span>}
    </div>
  );
}

// Shown before a vehicle is chosen: which vehicles / machines have axles set and spare tyres.
export function SetupsOverview() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    tyresApi
      .assetSetups()
      .then((r) => !cancelled && setResult(r.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!result) return <Spinner label="Loading axle setups" />;
  return <SetupsView result={result} />;
}

export function SetupsView({ result }) {
  const t = result.totals;
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
            {r.assetStatus === 'archived' ? ' · archived' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'axles',
      label: 'Axles',
      sortable: true,
      sortValue: (r) => r.tyresNeeded ?? -1,
      render: (r) =>
        r.axles ? (
          <div className="flex flex-col">
            <span className="font-semibold text-steel-900">{r.axles.length} {r.axles.length === 1 ? 'axle' : 'axles'}</span>
            <span className="text-xs text-steel-500 tabular-nums">{axleText(r.axles)}</span>
          </div>
        ) : (
          <Badge tone="warning">Not set</Badge>
        ),
    },
    {
      key: 'fitted',
      label: 'Tyres fitted',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.fitted,
      render: (r) => {
        const full = r.tyresNeeded != null && r.fitted >= r.tyresNeeded;
        return <span className={`tabular-nums ${full ? 'text-success-600 font-semibold' : ''}`}>{r.tyresNeeded != null ? `${r.fitted} / ${r.tyresNeeded}` : r.fitted}</span>;
      },
    },
    {
      key: 'spares',
      label: 'Spare tyres',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.spares + r.atRemould,
      render: (r) => (
        <div className="flex flex-col items-end tabular-nums">
          <span>{r.spares || '—'}</span>
          {r.atRemould > 0 && <span className="text-xs text-steel-500">+ {r.atRemould} at remould</span>}
        </div>
      ),
    },
    { key: 'set', label: 'Axles set', sortable: true, sortValue: (r) => r.setAt ?? '', render: (r) => <Who at={r.setAt} by={r.setBy} /> },
    { key: 'changed', label: 'Last changed', sortable: true, sortValue: (r) => r.changedAt ?? '', render: (r) => <Who at={r.changedAt} by={r.changedBy} /> },
  ];

  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Axles set', t.configured, 'vehicles & machines'],
          ['Axles not set', t.notConfigured, t.notConfigured ? 'have tyres, but no axles yet' : 'none'],
          ['Tyres fitted', t.tyresNeeded ? `${t.fitted} / ${t.tyresNeeded}` : t.fitted, 'fitted / positions'],
          ['Spare tyres', t.spares, 'in the Spare Tyre Store'],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded border border-steel-200 bg-surface px-3 py-2.5">
            <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-steel-900 tabular-nums">{value}</dd>
            <dd className="text-xs text-steel-500">{hint}</dd>
          </div>
        ))}
      </dl>
      <ReportTable
        title="Axle setups"
        subtitle={() => `${result.rows.length} ${result.rows.length === 1 ? 'vehicle or machine' : 'vehicles & machines'} with axles set or spare tyres · click one to open it`}
        noun="vehicle"
        rows={result.rows}
        columns={columns}
        getRowKey={(r) => r.key}
        searchText={(r) => `${r.assetLabel ?? ''} ${r.assetId} ${r.siteName ?? ''} ${r.assetKind ?? ''}`}
        emptyMessage="No vehicle or machine has axles set yet. Choose one above and set its axles."
      />
    </>
  );
}

export function AxleHistory({ history }) {
  if (!history?.length) return null;
  return (
    <div className="mt-4 border-t border-steel-100 pt-3">
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-steel-500 uppercase">Axle history</p>
      <ul className="space-y-1 text-sm">
        {history.map((h) => (
          <li key={h.id} className="flex flex-wrap gap-x-2 text-steel-700">
            <span className="w-44 shrink-0 text-steel-500 tabular-nums">{when(h.at)}</span>
            <span className="flex-1">
              {h.action === 'CREATED' ? (
                <>
                  Axles set: <span className="font-semibold">{axleText(h.to)}</span>
                </>
              ) : (
                <>
                  Changed {h.from ? axleText(h.from) : '—'} → <span className="font-semibold">{axleText(h.to)}</span>
                </>
              )}
            </span>
            {h.by && <span className="text-xs text-steel-500">{h.by}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VehicleTyresPage() {
  const [params, setParams] = useSearchParams();
  const assets = useAssets();
  const assetType = params.get('assetType') ?? '';
  const assetId = params.get('assetId') ?? '';
  const assetKey = assetType && assetId ? `${assetType}:${assetId}` : '';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editingAxles, setEditingAxles] = useState(false);
  const [savingAxles, setSavingAxles] = useState(false);
  const [axleError, setAxleError] = useState(null);
  const [fitting, setFitting] = useState(null);
  const [acting, setActing] = useState(null);
  const [addingSpares, setAddingSpares] = useState(false);

  const load = useCallback(async () => {
    if (!assetKey) return;
    setError(null);
    try {
      setData((await tyresApi.assetTyres(assetType, assetId)).data);
    } catch (err) {
      setError(err.message);
    }
  }, [assetKey, assetType, assetId]);

  useEffect(() => {
    setData(null);
    setNotice(null);
    setEditingAxles(false);
    load();
  }, [load]);

  async function saveAxles(axles) {
    setSavingAxles(true);
    setAxleError(null);
    try {
      const response = await tyresApi.saveLayout(assetType, assetId, { axles });
      setData(response.data);
      setEditingAxles(false);
      setNotice('Axles saved.');
    } catch (err) {
      setAxleError(err.message);
    } finally {
      setSavingAxles(false);
    }
  }

  const done = (message) => {
    setFitting(null);
    setActing(null);
    setAddingSpares(false);
    setNotice(message);
    load();
  };

  const asset = data?.asset;
  const formAsset = asset ? { assetType: asset.assetType, assetId: asset.assetId, assetLabel: asset.assetLabel } : null;
  const fittedCount = data?.axles.flatMap((a) => a.positions).filter((p) => p.tyre).length ?? 0;
  const detailPath = asset ? assetPath(asset) : null;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-steel-900">Vehicle Tyres</h1>
        <p className="mt-1 text-steel-500">Choose a vehicle or machine to set its axles and fit, take off or replace its tyres.</p>
      </div>

      <div className="mb-4 flex max-w-2xl flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-72">
        <Select
          aria-label="Vehicle or machine"
          value={assetKey}
          disabled={!assets}
          searchable
          onChange={(e) => {
            const [type, id] = e.target.value.split(':');
            setParams(e.target.value ? { assetType: type, assetId: id } : {});
          }}
        >
          <option value="">{assets ? 'Choose vehicle or machine…' : 'Loading…'}</option>
          {(assets ?? []).map((a) => (
            <option key={a.key} value={a.key} data-added={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
        </div>
        {assetKey && (
          <Link to="/tyres/assets" className="text-sm font-semibold text-brand-600 hover:underline">
            ← All vehicles
          </Link>
        )}
      </div>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      {!assetKey && <SetupsOverview />}
      {assetKey && !data && !error && <Spinner label="Loading tyres" />}

      {data && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded border border-steel-200 bg-surface px-4 py-3 text-sm">
            <div>
              {detailPath ? (
                <Link to={detailPath} className="text-base font-semibold text-brand-600 hover:underline">
                  {asset.assetLabel}
                </Link>
              ) : (
                <span className="text-base font-semibold text-steel-900">{asset.assetLabel}</span>
              )}
              <span className="ml-2 text-steel-500">
                {asset.assetKind} · {asset.siteName ?? 'No site'} · runs in {asset.meterType === 'HOURS' ? 'hours' : 'KM'}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-steel-600">
              {data.layout && (
                <span>
                  Tyres: <span className="font-semibold text-steel-900">{fittedCount} / {data.layout.tyreCount}</span>
                </span>
              )}
              <span>
                Last reading:{' '}
                <span className="font-semibold text-steel-900">
                  {data.lastReading ? `${formatNumber(data.lastReading.reading)} ${meterUnit(data.lastReading.meterType)}` : '—'}
                </span>
              </span>
              <span>
                Tyre cost: <span className="font-semibold text-steel-900">{formatCurrency(data.tyreCost)}</span>
              </span>
            </div>
          </div>

          {!data.layout || editingAxles ? (
            <Can resource="TYRE" action="UPDATE" fallback={<Alert tone="warning">The axles of this vehicle / machine are not set yet.</Alert>}>
              <AxleEditor
                initial={data.layout?.axles}
                onCancel={data.layout ? () => setEditingAxles(false) : null}
                onSave={saveAxles}
                saving={savingAxles}
                error={axleError}
              />
            </Can>
          ) : (
            <Card
              title="Fitted tyres"
              actions={
                <Can resource="TYRE" action="UPDATE">
                  <Button size="sm" variant="secondary" onClick={() => setEditingAxles(true)}>
                    Edit axles
                  </Button>
                </Can>
              }
            >
              <div className="grid gap-3">
                {data.axles.map((axle) => (
                  <div key={axle.axle}>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-steel-500 uppercase">
                      Axle {axle.axle} {axle.axle === 1 ? '(front)' : ''}
                    </p>
                    <div className={`grid gap-2 ${COLS[axle.positions.length]}`}>
                      {axle.positions.map((slot) => (
                        <PositionSlot key={slot.position} slot={slot} onFit={() => setFitting(slot.position)} onAction={(action, tyre) => setActing({ action, tyre })} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <AxleHistory history={data.layoutHistory} />
            </Card>
          )}

          {data.otherFitted.length > 0 && (
            <Alert tone="warning">
              Also fitted at positions not in the axle layout:{' '}
              {data.otherFitted.map((t) => (
                <Link key={t.id} to={`/tyres/${t.id}`} className="mr-2 font-semibold underline">
                  {t.tyreCode} ({t.position})
                </Link>
              ))}
            </Alert>
          )}

          <Card
            className="mt-4"
            title="Spare tyres"
            subtitle="This vehicle / machine's tyres in the Spare Tyre Store or away for remoulding."
            actions={
              <Can resource="TYRE" action="CREATE">
                <Button size="sm" variant="secondary" onClick={() => setAddingSpares(true)}>
                  + Add spare tyres
                </Button>
              </Can>
            }
          >
            {data.spares.length === 0 ? (
              <p className="text-sm text-steel-500">No spare tyres.</p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {data.spares.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <Link to={`/tyres/${t.id}`} className="font-semibold text-brand-600 hover:underline">
                        {t.tyreCode}
                      </Link>{' '}
                      <span className="text-steel-600">
                        {t.tyreTypeLabel} · {t.tyreSize}
                      </span>
                      <div className="text-xs text-steel-500">
                        {t.status === 'remould' ? 'Away for remoulding' : `Spare Tyre Store · ${t.siteName ?? '—'}`} · Run {formatRunTotals(t)} · Cost {formatCurrency(t.totalCost)}
                      </div>
                    </div>
                    {t.status === 'spare' && data.layout && (
                      <Can resource="TYRE" action="UPDATE">
                        <Button size="sm" variant="secondary" onClick={() => setActing({ action: 'fitHere', tyre: t })}>
                          Fit
                        </Button>
                      </Can>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {fitting && formAsset && <FitForm asset={formAsset} position={fitting} onClose={() => setFitting(null)} onDone={done} />}
      {acting?.action === 'fitHere' && <FitForm tyre={acting.tyre} asset={formAsset} onClose={() => setActing(null)} onDone={done} />}
      {acting && acting.action !== 'fitHere' && <TyreActionForm action={acting.action} tyre={acting.tyre} onClose={() => setActing(null)} onDone={done} />}
      {addingSpares && formAsset && <AddSparesForm asset={formAsset} onClose={() => setAddingSpares(false)} onDone={done} />}
    </div>
  );
}
