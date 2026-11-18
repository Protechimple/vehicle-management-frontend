import { useEffect, useState } from 'react';
import { batteriesApi, listAll, machineryApi, vehiclesApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Select } from '../ui';
import { OUTCOME_OPTIONS, STATUS_BY_VALUE, batteryName, formatDateOnly, formatNumber, readingUnit, todayDateOnly } from '../../config/batteries';
import { machineryLabel } from '../../config/fuel';

const textareaClasses =
  'w-full rounded border border-steel-200 px-3 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none';

export function BatteryStatusBadge({ status }) {
  const meta = STATUS_BY_VALUE[status];
  return <Badge tone={meta?.tone ?? 'neutral'}>{meta?.label ?? status}</Badge>;
}

export function formatReading(value, meterType) {
  if (value == null) return '—';
  return `${formatNumber(value)} ${readingUnit(meterType)}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Small building blocks

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  return { form, setForm, errors, setErrors, set };
}

function useSave(call, onDone) {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  async function save(payload, setErrors) {
    setSaving(true);
    setError(null);
    try {
      const response = await call(payload);
      onDone(response.message, response.data);
    } catch (err) {
      // Date and reading problems are shown under their own field.
      if (/date \(|^Date \(/i.test(err.message)) setErrors((e) => ({ ...e, date: err.message }));
      else if (/^Meter reading/.test(err.message)) setErrors((e) => ({ ...e, meterReading: err.message }));
      else setError(err.message);
      setSaving(false);
    }
  }
  return { error, saving, save };
}

function checkDate(value) {
  if (!value) return 'Choose the date.';
  if (value > todayDateOnly()) return "Date can't be in the future.";
  return null;
}

function checkAmount(value, label) {
  if (value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? null : `${label} must be 0 or more.`;
}

const numberOrNull = (value) => (value === '' ? null : Number(value));
const textOrNull = (value) => value.trim() || null;
const hasErrors = (errors) => Object.values(errors).some(Boolean);

function FormModal({ title, battery, submitLabel, danger = false, onClose, onSubmit, error, saving, children }) {
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <Alert tone="error">{error}</Alert>
        {battery && (
          <p className="mb-4 rounded bg-steel-50 px-3 py-2 text-sm text-steel-700">
            <span className="font-semibold text-steel-900">{battery.batteryCode}</span> · {batteryName(battery)} · SN {battery.serialNumber}
          </p>
        )}
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DateField({ form, errors, set, label = 'Date', min }) {
  return (
    <Field label={label} required error={errors.date}>
      {({ id, invalid, describedBy }) => <Input id={id} type="date" min={min} max={todayDateOnly()} invalid={invalid} describedBy={describedBy} value={form.date} onChange={set('date')} />}
    </Field>
  );
}

function MoreDetails({ children, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  if (!open) {
    return (
      <button type="button" className="mb-3 text-sm font-semibold text-brand-600 hover:underline" onClick={() => setOpen(true)}>
        + More details (optional)
      </button>
    );
  }
  return <div className="mb-1 rounded border border-dashed border-steel-200 px-3 pt-3">{children}</div>;
}

function NotesField({ form, set, label = 'Notes' }) {
  return (
    <Field label={label}>
      {({ id }) => <textarea id={id} rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} className={textareaClasses} />}
    </Field>
  );
}

function ReadingField({ form, errors, set, meterType }) {
  const label = meterType === 'HOURS' ? 'Hour meter reading' : 'KM reading';
  return (
    <Field label={label} error={errors.meterReading}>
      {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" invalid={invalid} describedBy={describedBy} value={form.meterReading} onChange={set('meterReading')} />}
    </Field>
  );
}

function OldBatteryChoice({ form, errors, set, setForm }) {
  return (
    <>
      <fieldset className="mb-3">
        <legend className="mb-1.5 text-sm font-semibold text-steel-700">
          What to do with the old battery? <span className="text-danger-600">*</span>
        </legend>
        <div className="grid gap-2">
          {OUTCOME_OPTIONS.map((o) => (
            <label key={o.value} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${form.outcome === o.value ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-steel-200'}`}>
              <input type="radio" name="outcome" value={o.value} checked={form.outcome === o.value} onChange={() => setForm((f) => ({ ...f, outcome: o.value }))} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {form.outcome === 'scrapped' && (
        <Field label="Why is it scrapped?" required error={errors.scrapReason}>
          {({ id, invalid, describedBy }) => <Input id={id} maxLength={500} placeholder="e.g. Won't hold charge" invalid={invalid} describedBy={describedBy} value={form.scrapReason} onChange={set('scrapReason')} />}
        </Field>
      )}
    </>
  );
}

function WarrantyNote({ battery }) {
  if (!battery.inWarranty || !battery.warrantyUntil) return null;
  return (
    <Alert tone="warning">
      This battery is under warranty until {formatDateOnly(battery.warrantyUntil)}
      {battery.supplierName ? ` — check with ${battery.supplierName} before scrapping or paying for repair.` : '.'}
    </Alert>
  );
}

function oldBatteryErrors(form) {
  return {
    date: checkDate(form.date),
    meterReading: checkAmount(form.meterReading, 'Reading'),
    scrapReason: form.outcome === 'scrapped' && !form.scrapReason.trim() ? 'Enter why it is scrapped.' : null,
  };
}

function oldBatteryPayload(form) {
  return {
    meterReading: numberOrNull(form.meterReading),
    outcome: form.outcome,
    scrapReason: form.outcome === 'scrapped' ? form.scrapReason.trim() : null,
    notes: textOrNull(form.notes),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Fit an In Store battery to a vehicle or machine at the same site

function useAssetsAtSite(siteId) {
  const [assets, setAssets] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listAll(vehiclesApi.list, { sort: 'registrationNumber:asc' }), listAll(machineryApi.list, { sort: 'rcpl:asc' })])
      .then(([vehicles, machines]) => {
        if (cancelled) return;
        const here = (a) => a.currentSiteId === siteId && a.status !== 'archived';
        setAssets([
          ...vehicles.data.filter(here).map((v) => ({ key: `VEHICLE:${v.assetId}`, assetType: 'VEHICLE', assetId: v.assetId, id: v.id, label: `${v.registrationNumber} · ${v.type}`, meterType: v.isHoursBased ? 'HOURS' : 'KM' })),
          ...machines.data.filter(here).map((m) => ({ key: `MACHINERY:${m.assetId}`, assetType: 'MACHINERY', assetId: m.assetId, id: m.id, label: `${machineryLabel(m)} · Machine`, meterType: 'HOURS' })),
        ]);
      })
      .catch(() => !cancelled && setAssets([]));
    return () => {
      cancelled = true;
    };
  }, [siteId]);
  return assets;
}

export function FitForm({ battery, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ assetKey: '', date: todayDateOnly(), position: '', meterReading: '', notes: '' });
  const assets = useAssetsAtSite(battery.siteId);
  const asset = assets?.find((a) => a.key === form.assetKey) ?? null;
  const { error, saving, save } = useSave(batteriesApi.fit, onDone);

  function submit(event) {
    event.preventDefault();
    const next = { assetKey: asset ? null : 'Choose a vehicle or machine.', date: checkDate(form.date), meterReading: checkAmount(form.meterReading, 'Reading') };
    setErrors(next);
    if (hasErrors(next)) return;
    save(
      { batteryId: battery.id, assetType: asset.assetType, assetId: asset.assetId, fittedAt: form.date, position: textOrNull(form.position), meterReading: numberOrNull(form.meterReading), notes: textOrNull(form.notes) },
      setErrors
    );
  }

  return (
    <FormModal title="Fit battery" battery={battery} submitLabel="Fit battery" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <Field
        label="Fit to"
        required
        error={errors.assetKey}
        hint={assets && assets.length === 0 ? `No vehicles or machines at ${battery.siteName ?? 'this site'}.` : `Vehicles and machines at ${battery.siteName ?? 'this battery’s site'}.`}
      >
        {({ id, invalid, describedBy }) => (
          <Select id={id} invalid={invalid} describedBy={describedBy} value={form.assetKey} disabled={!assets || assets.length === 0} onChange={set('assetKey')} searchable>
            <option value="">{assets ? 'Choose vehicle or machine…' : 'Loading…'}</option>
            {(assets ?? []).map((a) => (
              <option key={a.key} value={a.key} data-added={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <DateField form={form} errors={errors} set={set} label="Fitting date" />
      <MoreDetails>
        <Field label="Position" hint="Only needed when the vehicle has more than one battery, e.g. Battery 1.">
          {({ id, describedBy }) => <Input id={id} maxLength={50} describedBy={describedBy} value={form.position} onChange={set('position')} />}
        </Field>
        <ReadingField form={form} errors={errors} set={set} meterType={asset?.meterType} />
        <NotesField form={form} set={set} />
      </MoreDetails>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Change: put an In Store battery in, and decide what happens to the old one

export function ChangeForm({ battery, onClose, onDone }) {
  const { form, setForm, errors, setErrors, set } = useForm({
    newBatteryId: '',
    date: todayDateOnly(),
    outcome: 'needs_repair',
    scrapReason: '',
    meterReading: '',
    position: battery.position ?? '',
    notes: '',
  });
  const [inStore, setInStore] = useState(null);
  const { error, saving, save } = useSave((payload) => batteriesApi.replace(battery.id, payload), onDone);

  useEffect(() => {
    let cancelled = false;
    listAll(batteriesApi.list, { status: 'ready', siteId: battery.currentSiteId, sort: 'batteryCode:asc' })
      .then((r) => !cancelled && setInStore(r.data.filter((b) => b.siteId === battery.currentSiteId)))
      .catch(() => !cancelled && setInStore([]));
    return () => {
      cancelled = true;
    };
  }, [battery.currentSiteId]);

  function submit(event) {
    event.preventDefault();
    const next = { newBatteryId: form.newBatteryId ? null : 'Choose the new battery.', ...oldBatteryErrors(form) };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ newBatteryId: Number(form.newBatteryId), replacedAt: form.date, position: textOrNull(form.position), ...oldBatteryPayload(form) }, setErrors);
  }

  return (
    <FormModal title={`Change battery — ${battery.assetLabel}`} battery={battery} submitLabel="Change battery" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <WarrantyNote battery={battery} />
      <Field
        label="New battery"
        required
        error={errors.newBatteryId}
        hint={inStore && inStore.length === 0 ? `No batteries in store at ${battery.siteName ?? 'this site'}. Add batteries first.` : undefined}
      >
        {({ id, invalid, describedBy }) => (
          <Select id={id} invalid={invalid} describedBy={describedBy} value={form.newBatteryId} disabled={!inStore || inStore.length === 0} onChange={set('newBatteryId')} searchable>
            <option value="">{inStore ? 'Choose from store…' : 'Loading…'}</option>
            {(inStore ?? []).map((b) => (
              <option key={b.id} value={b.id} data-added={b.id}>
                {b.batteryCode} · {batteryName(b)} · SN {b.serialNumber}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <OldBatteryChoice form={form} errors={errors} set={set} setForm={setForm} />
      <DateField form={form} errors={errors} set={set} min={battery.fittedAt ?? undefined} />
      <MoreDetails>
        <ReadingField form={form} errors={errors} set={set} meterType={battery.assetMeterType} />
        <Field label="Position">
          {({ id }) => <Input id={id} maxLength={50} value={form.position} onChange={set('position')} />}
        </Field>
        <NotesField form={form} set={set} label="What was wrong? / Notes" />
      </MoreDetails>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Take off without putting another battery in

export function TakeOffForm({ battery, onClose, onDone }) {
  const { form, setForm, errors, setErrors, set } = useForm({ date: todayDateOnly(), outcome: 'needs_repair', scrapReason: '', meterReading: '', notes: '' });
  const { error, saving, save } = useSave((payload) => batteriesApi.remove(battery.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = oldBatteryErrors(form);
    setErrors(next);
    if (hasErrors(next)) return;
    save({ removedAt: form.date, ...oldBatteryPayload(form) }, setErrors);
  }

  return (
    <FormModal title={`Take off battery — ${battery.assetLabel}`} battery={battery} submitLabel="Take off" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <WarrantyNote battery={battery} />
      <OldBatteryChoice form={form} errors={errors} set={set} setForm={setForm} />
      <DateField form={form} errors={errors} set={set} min={battery.fittedAt ?? undefined} />
      <MoreDetails>
        <ReadingField form={form} errors={errors} set={set} meterType={battery.assetMeterType} />
        <NotesField form={form} set={set} />
      </MoreDetails>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Storage actions

export function RepairedForm({ battery, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ date: todayDateOnly(), repairCost: '', vendor: '', notes: '' });
  const { error, saving, save } = useSave((payload) => batteriesApi.repaired(battery.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { date: checkDate(form.date), repairCost: checkAmount(form.repairCost, 'Repair cost') };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ date: form.date, repairCost: numberOrNull(form.repairCost), vendor: textOrNull(form.vendor), notes: textOrNull(form.notes) }, setErrors);
  }

  return (
    <FormModal title="Battery repaired" battery={battery} submitLabel="Back in store" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <p className="mb-3 text-sm text-steel-600">The battery goes back in store and can be fitted again.</p>
      <DateField form={form} errors={errors} set={set} label="Repair date" />
      <Field label="Repair cost" error={errors.repairCost} hint="Leave empty if it was free.">
        {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" invalid={invalid} describedBy={describedBy} value={form.repairCost} onChange={set('repairCost')} />}
      </Field>
      <MoreDetails>
        <Field label="Repaired by">
          {({ id }) => <Input id={id} maxLength={255} placeholder="Shop or person" value={form.vendor} onChange={set('vendor')} />}
        </Field>
        <NotesField form={form} set={set} />
      </MoreDetails>
    </FormModal>
  );
}

export function SendForRepairForm({ battery, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ date: todayDateOnly(), notes: '' });
  const { error, saving, save } = useSave((payload) => batteriesApi.sendForRepair(battery.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { date: checkDate(form.date) };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ date: form.date, notes: textOrNull(form.notes) }, setErrors);
  }

  return (
    <FormModal title="Send for repair" battery={battery} submitLabel="Send for repair" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <DateField form={form} errors={errors} set={set} />
      <NotesField form={form} set={set} label="What is wrong? (optional)" />
    </FormModal>
  );
}

export function ScrapForm({ battery, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ date: todayDateOnly(), reason: '', scrapValue: '' });
  const { error, saving, save } = useSave((payload) => batteriesApi.scrap(battery.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { date: checkDate(form.date), reason: form.reason.trim() ? null : 'Enter why it is scrapped.', scrapValue: checkAmount(form.scrapValue, 'Scrap value') };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ date: form.date, reason: form.reason.trim(), scrapValue: numberOrNull(form.scrapValue) }, setErrors);
  }

  return (
    <FormModal title="Scrap battery" battery={battery} submitLabel="Scrap battery" danger onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <WarrantyNote battery={battery} />
      <p className="mb-3 text-sm text-steel-600">A scrapped battery can't be used again. Its history is kept.</p>
      <Field label="Why is it scrapped?" required error={errors.reason}>
        {({ id, invalid, describedBy }) => <Input id={id} maxLength={500} placeholder="e.g. Won't hold charge" invalid={invalid} describedBy={describedBy} value={form.reason} onChange={set('reason')} />}
      </Field>
      <DateField form={form} errors={errors} set={set} />
      <MoreDetails>
        <Field label="Scrap value received" error={errors.scrapValue} hint="What the scrap dealer paid.">
          {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" invalid={invalid} describedBy={describedBy} value={form.scrapValue} onChange={set('scrapValue')} />}
        </Field>
      </MoreDetails>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Which buttons a battery shows, in order. The first is the main one.

export const ACTIONS = {
  fit: { label: 'Fit', permission: 'CREATE', Form: FitForm },
  change: { label: 'Change', permission: 'UPDATE', Form: ChangeForm },
  takeOff: { label: 'Take off', permission: 'UPDATE', Form: TakeOffForm },
  repaired: { label: 'Repaired', permission: 'UPDATE', Form: RepairedForm },
  sendForRepair: { label: 'Send for repair', permission: 'UPDATE', Form: SendForRepairForm },
  scrap: { label: 'Scrap', permission: 'SCRAP', Form: ScrapForm },
};

export function actionsFor(battery, { detail = false } = {}) {
  if (battery.status === 'ready') return detail ? ['fit', 'sendForRepair', 'scrap'] : ['fit'];
  if (battery.status === 'fitted') return ['change', 'takeOff'];
  if (battery.status === 'needs_repair') return ['repaired', 'scrap'];
  return [];
}

export function BatteryForm({ action, battery, onClose, onDone }) {
  const Form = ACTIONS[action]?.Form;
  if (!Form || !battery) return null;
  return <Form battery={battery} onClose={onClose} onDone={onDone} />;
}
