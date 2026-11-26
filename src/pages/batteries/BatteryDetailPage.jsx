import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { batteriesApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Modal, Spinner, BackLink } from '../../components/ui';
import Can from '../../components/Can';
import DeleteWordModal from '../../components/DeleteWordModal';
import { ACTIONS, BatteryForm, BatteryStatusBadge, actionsFor } from '../../components/batteries/BatteryForms';
import { eventSentence } from './BatteryHistoryPage';
import { EVENT_LABELS, assetPath, batteryName, daysBetween, formatCurrency, formatDateOnly, formatDays, todayDateOnly } from '../../config/batteries';

const DOT = { purchased: 'bg-brand-600', fitted: 'bg-success-600', removed: 'bg-warning-600', sent_for_repair: 'bg-warning-600', repaired: 'bg-success-600', scrapped: 'bg-danger-600' };

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-steel-900">{children || '—'}</dd>
    </div>
  );
}

function whereNow(b) {
  if (b.status === 'fitted') {
    const path = assetPath(b);
    const name = path ? (
      <Link to={path} className="font-semibold text-brand-600 hover:underline">
        {b.assetLabel}
      </Link>
    ) : (
      <span className="font-semibold">{b.assetLabel ?? b.assetId}</span>
    );
    return (
      <>
        On {name}
        {b.position ? ` (${b.position})` : ''} since {formatDateOnly(b.fittedAt)}
      </>
    );
  }
  if (b.status === 'scrapped') return `Scrapped on ${formatDateOnly(b.scrappedAt)}${b.scrapReason ? ` — ${b.scrapReason}` : ''}`;
  return `${b.status === 'ready' ? 'In store' : 'Waiting for repair'} at ${b.siteName ?? '—'}`;
}

// Days spent on vehicles and the number of fittings, worked out from the history.
function lifeSoFar(events) {
  const today = todayDateOnly();
  let open = null;
  let days = 0;
  let fittings = 0;
  for (const e of events) {
    if (e.eventType === 'fitted') {
      open = e.eventDate;
      fittings += 1;
    }
    if (e.eventType === 'removed' && open) {
      days += daysBetween(open, e.eventDate);
      open = null;
    }
  }
  if (open) days += daysBetween(open, today);
  const repairs = events.filter((e) => e.eventType === 'repaired');
  return { days, fittings, repairs: repairs.length, repairCost: repairs.reduce((t, e) => t + (e.amount ?? 0), 0) };
}

function EditDetailsForm({ battery, onClose, onDone }) {
  const [form, setForm] = useState({
    serialNumber: battery.serialNumber,
    brand: battery.brand,
    capacityAh: battery.capacityAh ?? '',
    purchaseDate: battery.purchaseDate,
    purchaseCost: String(battery.purchaseCost),
    supplierName: battery.supplierName ?? '',
    invoiceNumber: battery.invoiceNumber ?? '',
    warrantyMonths: battery.warrantyMonths ?? '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((x) => ({ ...x, [field]: undefined }));
  };
  const optional = (v) => (v === '' ? null : Number(v));

  async function submit(event) {
    event.preventDefault();
    const cost = Number(form.purchaseCost);
    const next = {
      serialNumber: form.serialNumber.trim() ? null : 'Enter the serial number.',
      brand: form.brand.trim() ? null : 'Enter the brand.',
      purchaseDate: !form.purchaseDate ? 'Choose the date.' : form.purchaseDate > todayDateOnly() ? "Date can't be in the future." : null,
      purchaseCost: form.purchaseCost !== '' && Number.isFinite(cost) && cost >= 0 ? null : 'Enter the price.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setError(null);
    try {
      // Fields not on this form are sent back unchanged.
      await batteriesApi.update(battery.id, {
        serialNumber: form.serialNumber.trim(),
        brand: form.brand.trim(),
        modelName: battery.modelName,
        capacityAh: optional(form.capacityAh),
        voltage: battery.voltage,
        purchaseDate: form.purchaseDate,
        purchaseCost: cost,
        supplierName: form.supplierName.trim() || null,
        invoiceNumber: form.invoiceNumber.trim() || null,
        warrantyMonths: optional(form.warrantyMonths),
        notes: battery.notes,
      });
      onDone('Battery details corrected.');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const field = (key, label, props = {}) => (
    <Field label={label} required={props.isRequired} error={errors[key]}>
      {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={form[key]} onChange={set(key)} type={props.type} min={props.min} max={props.max} step={props.step} />}
    </Field>
  );

  return (
    <Modal open onClose={onClose} title={`Correct details — ${battery.batteryCode}`} description="Use this to fix a typing mistake. The battery's history stays as it is.">
      <form onSubmit={submit} noValidate>
        <Alert tone="error">{error}</Alert>
        <div className="grid gap-x-3 sm:grid-cols-2">
          {field('serialNumber', 'Serial no.', { isRequired: true })}
          {field('brand', 'Brand', { isRequired: true })}
          {field('capacityAh', 'Ah', { type: 'number', min: 1, step: 1 })}
          {field('purchaseCost', 'Price', { isRequired: true, type: 'number', min: 0, step: 'any' })}
          {field('purchaseDate', 'Date bought', { isRequired: true, type: 'date', max: todayDateOnly() })}
          {field('warrantyMonths', 'Warranty (months)', { type: 'number', min: 0, step: 1 })}
          {field('supplierName', 'Supplier')}
          {field('invoiceNumber', 'Bill / invoice no.')}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function BatteryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [battery, setBattery] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [acting, setActing] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteState, setDeleteState] = useState({ pending: false, error: null });

  const load = useCallback(async () => {
    setError(null);
    try {
      setBattery((await batteriesApi.get(id)).data);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    setDeleteState({ pending: true, error: null });
    try {
      await batteriesApi.destroy(battery.id, 'DELETE');
      navigate('/batteries', { state: { message: `Battery ${battery.batteryCode} deleted.` } });
    } catch (err) {
      setDeleteState({ pending: false, error: err.message });
    }
  }

  if (!battery) {
    return (
      <div>
        <Alert tone="error">{error}</Alert>
        {!error && <Spinner label="Loading battery" />}
      </div>
    );
  }

  const life = lifeSoFar(battery.events);
  const neverUsed = battery.events.every((e) => e.eventType === 'purchased');

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink to="/batteries" label="Batteries" />
      <div className="mt-1 mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-steel-900">{battery.batteryCode}</h1>
          <BatteryStatusBadge status={battery.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {actionsFor(battery, { detail: true }).map((a, index) => (
            <Can key={a} resource="BATTERY" action={ACTIONS[a].permission}>
              <Button size="sm" variant={index === 0 ? 'primary' : 'secondary'} onClick={() => setActing(a)}>
                {ACTIONS[a].label}
              </Button>
            </Can>
          ))}
        </div>
      </div>
      <p className="mb-4 text-steel-600">{whereNow(battery)}</p>

      <Alert tone="success">{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
        <Card title="Battery">
          <dl className="grid grid-cols-2 gap-3">
            <Detail label="Serial no.">{battery.serialNumber}</Detail>
            <Detail label="Brand">{batteryName(battery)}</Detail>
            <Detail label="Bought on">{formatDateOnly(battery.purchaseDate)}</Detail>
            <Detail label="Price">{formatCurrency(battery.purchaseCost)}</Detail>
            <Detail label="Supplier">{battery.supplierName}</Detail>
            <Detail label="Bill no.">{battery.invoiceNumber}</Detail>
            <Detail label="Warranty">
              {battery.warrantyUntil && (
                <span className={battery.inWarranty ? 'text-success-600' : 'text-steel-500'}>
                  {battery.inWarranty ? 'Until' : 'Ended'} {formatDateOnly(battery.warrantyUntil)}
                </span>
              )}
            </Detail>
            <Detail label="Used on vehicles">{life.fittings ? `${formatDays(life.days)} · ${life.fittings} ${life.fittings === 1 ? 'time' : 'times'}` : 'Not yet'}</Detail>
            <Detail label="Repairs">{life.repairs ? `${life.repairs} · ${formatCurrency(life.repairCost)}` : 'None'}</Detail>
            <Detail label="Total cost">{formatCurrency(battery.purchaseCost + life.repairCost)}</Detail>
          </dl>
          <Can resource="BATTERY" action="EDIT_DETAILS">
            <div className="mt-4 flex gap-3 border-t border-steel-100 pt-3 text-sm">
              <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => setEditing(true)}>
                Correct details
              </button>
              {neverUsed && (
                <button type="button" className="font-semibold text-danger-600 hover:underline" onClick={() => setDeleting(true)}>
                  Delete (entered by mistake)
                </button>
              )}
            </div>
          </Can>
        </Card>

        <Card title="History">
          <ol className="relative ml-2 border-l border-steel-200">
            {[...battery.events].reverse().map((e) => (
              <li key={e.id} className="mb-4 ml-5 last:mb-0">
                <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${DOT[e.eventType] ?? 'bg-steel-300'}`} aria-hidden="true" />
                <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">
                  {formatDateOnly(e.eventDate)} · {EVENT_LABELS[e.eventType] ?? e.eventType}
                </p>
                <p className="text-sm text-steel-800">{eventSentence(e)}</p>
                {e.notes && !['scrapped', 'purchased'].includes(e.eventType) && <p className="text-xs text-steel-500">{e.notes}</p>}
                {e.createdByName && <p className="text-xs text-steel-500">Entered by {e.createdByName}</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <BatteryForm
        key={acting ?? 'none'}
        action={acting}
        battery={battery}
        onClose={() => setActing(null)}
        onDone={(message) => {
          setActing(null);
          setNotice(message);
          load();
        }}
      />
      {editing && (
        <EditDetailsForm
          battery={battery}
          onClose={() => setEditing(false)}
          onDone={(message) => {
            setEditing(false);
            setNotice(message);
            load();
          }}
        />
      )}
      <DeleteWordModal
        open={deleting}
        title={`Delete ${battery.batteryCode}?`}
        description="Only a battery that was never fitted can be deleted. Use this to remove an entry made by mistake."
        onCancel={() => {
          setDeleting(false);
          setDeleteState({ pending: false, error: null });
        }}
        onConfirm={confirmDelete}
        pending={deleteState.pending}
        error={deleteState.error}
      />
    </div>
  );
}
