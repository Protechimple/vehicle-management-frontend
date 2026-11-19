import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAll, machineryApi, tyresApi, vehiclesApi } from '../../api/client';
import { Alert, Badge, Button, Field, Input, Modal, Select } from '../ui';
import TyreTypeModal from './TyreTypeModal';
import useSiteNames from '../../hooks/useSiteNames';
import { machineryLabel } from '../../config/fuel';
import {
  OUTCOME_OPTIONS,
  STATUS_BY_VALUE,
  assetTyresPath,
  formatCurrency,
  formatWhen,
  checkDateTime,
  nowDateTimeLocal,
  splitDateTime,
  formatNumber,
  meterUnit,
  readingLabel,
  tyreLabel,
  tyreTypeName,
} from '../../config/tyres';

const textareaClasses =
  'w-full rounded border border-steel-200 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none';

export function TyreStatusBadge({ status }) {
  const meta = STATUS_BY_VALUE[status];
  return <Badge tone={meta?.tone ?? 'neutral'}>{meta?.short ?? status}</Badge>;
}

// Where a tyre is now, in one line: store and site, or vehicle and position.
export function TyreWhere({ tyre }) {
  if (tyre.status === 'fitted') {
    return (
      <div className="flex flex-col">
        <Link to={assetTyresPath(tyre.assetType, tyre.assetId)} className="font-semibold text-brand-600 hover:underline">
          {tyre.assetLabel ?? tyre.assetId}
        </Link>
        <span className="text-xs text-steel-500">
          {tyre.position} · since {formatWhen(tyre.fittedAt, tyre.fittedTime)} at {formatNumber(tyre.fitReading)} {meterUnit(tyre.meterType)}
        </span>
      </div>
    );
  }
  if (tyre.status === 'scrapped') return <span className="text-steel-500">Scrapped {formatWhen(tyre.scrappedAt, tyre.scrappedTime)}</span>;
  return (
    <div className="flex flex-col">
      <span>{STATUS_BY_VALUE[tyre.status]?.label} · {tyre.siteName ?? '—'}</span>
      {tyre.ownerLabel && <span className="text-xs text-steel-500">Spare of {tyre.ownerLabel}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Building blocks shared by every form

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
      // Date / time and reading problems are shown under their own field.
      if (/date \(|time is required/i.test(err.message)) setErrors((e) => ({ ...e, when: err.message }));
      else if (/^(KM|Hours) reading/.test(err.message)) setErrors((e) => ({ ...e, meterReading: err.message }));
      else setError(err.message);
      setSaving(false);
    }
  }
  return { error, saving, save };
}

const checkMoney = (value, label) => (value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0) ? null : `${label} must be 0 or more.`);
const checkReading = (value, meterType) => {
  if (value === '') return `Enter the ${readingLabel(meterType)}.`;
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? null : `${readingLabel(meterType)} must be 0 or more.`;
};
const numberOrNull = (value) => (value === '' ? null : Number(value));
const textOrNull = (value) => value.trim() || null;
const hasErrors = (errors) => Object.values(errors).some(Boolean);

function FormModal({ title, tyre, submitLabel, danger = false, onClose, onSubmit, error, saving, children }) {
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <Alert tone="error">{error}</Alert>
        {tyre && <p className="mb-3 rounded bg-steel-50 px-3 py-2 text-sm text-steel-700">{tyreLabel(tyre)}</p>}
        {children}
        <div className="flex justify-end gap-2 pt-1">
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

// One picker for date and time; defaults to now.
function DateField({ form, errors, set, label = 'Date & time' }) {
  return (
    <Field label={label} required error={errors.when}>
      {({ id, invalid, describedBy }) => <Input id={id} type="datetime-local" max={nowDateTimeLocal()} invalid={invalid} describedBy={describedBy} value={form.when} onChange={set('when')} />}
    </Field>
  );
}

function ReadingField({ form, errors, set, meterType, hint }) {
  return (
    <Field label={readingLabel(meterType)} required error={errors.meterReading} hint={hint}>
      {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" invalid={invalid} describedBy={describedBy} value={form.meterReading} onChange={set('meterReading')} />}
    </Field>
  );
}

function MoneyField({ form, errors, set, field, label, hint }) {
  return (
    <Field label={label} error={errors[field]} hint={hint}>
      {({ id, invalid, describedBy }) => <Input id={id} type="number" min="0" step="any" inputMode="decimal" placeholder="₹" invalid={invalid} describedBy={describedBy} value={form[field]} onChange={set(field)} />}
    </Field>
  );
}

function TextField({ form, set, field, label, placeholder, max = 255 }) {
  return <Field label={label}>{({ id }) => <Input id={id} maxLength={max} placeholder={placeholder} value={form[field]} onChange={set(field)} />}</Field>;
}

function NotesField({ form, set, label = 'Notes' }) {
  return <Field label={label}>{({ id }) => <textarea id={id} rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} className={textareaClasses} />}</Field>;
}

function TwoColumns({ children }) {
  return <div className="grid gap-x-3 sm:grid-cols-2">{children}</div>;
}

// "What happens to the tyre that comes off?" — used by Take off and by Fit when the position is taken.
function OutcomeChoice({ form, errors, set, setForm, legend }) {
  return (
    <>
      <fieldset className="mb-3">
        <legend className="mb-1.5 text-sm font-semibold text-steel-700">
          {legend} <span className="text-danger-600">*</span>
        </legend>
        <div className="grid gap-1.5">
          {OUTCOME_OPTIONS.map((o) => (
            <label key={o.value} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${form.outcome === o.value ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-steel-200'}`}>
              <input type="radio" name="outcome" value={o.value} checked={form.outcome === o.value} onChange={() => setForm((f) => ({ ...f, outcome: o.value }))} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {form.outcome === 'scrapped' && (
        <TwoColumns>
          <Field label="Why is it scrapped?" required error={errors.scrapReason}>
            {({ id, invalid, describedBy }) => <Input id={id} maxLength={500} placeholder="e.g. Sidewall cut" invalid={invalid} describedBy={describedBy} value={form.scrapReason} onChange={set('scrapReason')} />}
          </Field>
          <MoneyField form={form} errors={errors} set={set} field="scrapValue" label="Scrap value received" />
        </TwoColumns>
      )}
      {form.outcome === 'remould' && <TextField form={form} set={set} field="vendor" label="Remould shop" placeholder="Shop name" />}
    </>
  );
}

const outcomeInitial = { outcome: 'spare', scrapReason: '', scrapValue: '', vendor: '' };
const outcomeErrors = (form) => ({
  scrapReason: form.outcome === 'scrapped' && !form.scrapReason.trim() ? 'Enter why it is scrapped.' : null,
  scrapValue: form.outcome === 'scrapped' ? checkMoney(form.scrapValue, 'Scrap value') : null,
});
const outcomePayload = (form) => ({
  outcome: form.outcome,
  scrapReason: form.outcome === 'scrapped' ? form.scrapReason.trim() : null,
  scrapValue: form.outcome === 'scrapped' ? numberOrNull(form.scrapValue) : null,
  vendor: form.outcome === 'remould' ? textOrNull(form.vendor) : null,
});

// ---------------------------------------------------------------------------------------------------------------------
// Data for the pickers

// Vehicles and machines for the pickers, each labelled with the site it belongs to.
export function useAssets() {
  const siteNames = useSiteNames();
  const [assets, setAssets] = useState(null);
  const withSites = useMemo(
    () => assets?.map((a) => ({ ...a, siteName: siteNames[a.siteId] ?? null, label: siteNames[a.siteId] ? `${a.label} · ${siteNames[a.siteId]}` : a.label })) ?? null,
    [assets, siteNames]
  );
  useEffect(() => {
    let cancelled = false;
    Promise.all([listAll(vehiclesApi.list, { sort: 'registrationNumber:asc' }), listAll(machineryApi.list, { sort: 'rcpl:asc' })])
      .then(([vehicles, machines]) => {
        if (cancelled) return;
        const active = (a) => a.status !== 'archived' && a.currentSiteId;
        setAssets([
          ...vehicles.data.filter(active).map((v) => ({ key: `VEHICLE:${v.assetId}`, assetType: 'VEHICLE', assetId: v.assetId, id: v.id, siteId: v.currentSiteId, label: `${v.registrationNumber} · ${v.type}` })),
          ...machines.data.filter(active).map((m) => ({ key: `MACHINERY:${m.assetId}`, assetType: 'MACHINERY', assetId: m.assetId, id: m.id, siteId: m.currentSiteId, label: `${machineryLabel(m)} · Machine` })),
        ]);
      })
      .catch(() => !cancelled && setAssets([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return withSites;
}

function AssetSelect({ assets, value, onChange, error, hint, label = 'Vehicle / machine' }) {
  return (
    <Field label={label} required error={error} hint={hint}>
      {({ id, invalid, describedBy }) => (
        <Select id={id} invalid={invalid} describedBy={describedBy} value={value} disabled={!assets} onChange={onChange} searchable>
          <option value="">{assets ? 'Choose vehicle or machine…' : 'Loading…'}</option>
          {(assets ?? []).map((a) => (
            <option key={a.key} value={a.key} data-added={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function useAssetTyres(assetType, assetId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    if (!assetId) return undefined;
    tyresApi
      .assetTyres(assetType, assetId)
      .then((r) => !cancelled && setData(r.data))
      .catch(() => !cancelled && setData({ failed: true }));
    return () => {
      cancelled = true;
    };
  }, [assetType, assetId]);
  return data;
}

function lastReadingHint(info) {
  const last = info?.lastReading;
  if (!last) return 'Enter the reading shown on the vehicle / machine now.';
  return `Last recorded: ${formatNumber(last.reading)} ${meterUnit(last.meterType)} on ${formatWhen(last.date, last.time)}.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fit a tyre. Opened from a tyre (choose vehicle + position) or from an empty position (choose tyre).

export function FitForm({ tyre: givenTyre = null, asset: givenAsset = null, position: givenPosition = '', onClose, onDone }) {
  const { form, setForm, errors, setErrors, set } = useForm({
    assetKey: givenAsset ? `${givenAsset.assetType}:${givenAsset.assetId}` : '',
    position: givenPosition,
    tyreId: givenTyre ? String(givenTyre.id) : '',
    when: nowDateTimeLocal(),
    meterReading: '',
    notes: '',
    ...outcomeInitial,
  });
  const assets = useAssets();
  const [assetType, assetId] = form.assetKey ? form.assetKey.split(':') : [null, null];
  const info = useAssetTyres(assetType, assetId);
  const [stored, setStored] = useState(null);

  useEffect(() => {
    if (givenTyre) return undefined;
    let cancelled = false;
    listAll(tyresApi.list, { status: 'stored', sort: 'tyreCode:asc' })
      .then((r) => !cancelled && setStored(r.data))
      .catch(() => !cancelled && setStored([]));
    return () => {
      cancelled = true;
    };
  }, [givenTyre]);

  const assetSiteId = info?.asset?.assetSiteId ?? null;
  // Tyres are used only at the site they are stored at; the asset's own spares come first.
  const tyreOptions = useMemo(() => {
    if (!stored || assetSiteId == null) return [];
    const rank = (t) => (t.ownerAssetId === assetId ? 0 : 1);
    return stored.filter((t) => t.siteId === assetSiteId).sort((a, b) => rank(a) - rank(b) || a.tyreCode.localeCompare(b.tyreCode));
  }, [stored, assetId, assetSiteId]);
  // From a tyre: only the vehicles and machines at the tyre's site.
  const assetOptions = givenTyre && assets ? assets.filter((a) => a.siteId === givenTyre.siteId) : assets;

  const positions = info?.axles?.flatMap((a) => a.positions) ?? [];
  const occupant = positions.find((p) => p.position === form.position)?.tyre ?? null;
  const meterType = info?.asset?.meterType ?? 'KM';
  const tyre = givenTyre ?? stored?.find((t) => String(t.id) === form.tyreId) ?? null;
  const { error, saving, save } = useSave((payload) => tyresApi.fit(form.tyreId, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = {
      assetKey: form.assetKey ? null : 'Choose a vehicle or machine.',
      position: form.position ? null : 'Choose the position.',
      tyreId: form.tyreId ? null : 'Choose a tyre.',
      when: checkDateTime(form.when),
      meterReading: checkReading(form.meterReading, meterType),
      ...(occupant ? outcomeErrors(form) : {}),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    save(
      { assetType, assetId, position: form.position, ...splitDateTime(form.when), meterReading: Number(form.meterReading), notes: textOrNull(form.notes), ...(occupant ? { oldTyre: outcomePayload(form) } : {}) },
      setErrors
    );
  }

  const noLayout = info && !info.failed && !info.layout;
  return (
    <FormModal title={givenAsset ? `Fit tyre — ${[givenAsset.assetLabel, givenPosition].filter(Boolean).join(' · ')}` : 'Fit tyre'} tyre={givenTyre} submitLabel={occupant ? 'Replace tyre' : 'Fit tyre'} onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      {!givenAsset && (
        <AssetSelect
          assets={assetOptions}
          value={form.assetKey}
          error={errors.assetKey}
          hint={
            givenTyre
              ? assetOptions && assetOptions.length === 0
                ? `No vehicles or machines at ${givenTyre.siteName ?? 'this tyre’s site'}. Use Tyre Transfer to move the tyre.`
                : `At ${givenTyre.siteName ?? 'this tyre’s site'}. To use it at another site, transfer it first.`
              : undefined
          }
          onChange={(e) => {
            setForm((f) => ({ ...f, assetKey: e.target.value, position: '' }));
            setErrors((er) => ({ ...er, assetKey: undefined }));
          }}
        />
      )}
      {noLayout && (
        <Alert tone="warning">
          The axles of this vehicle / machine are not set yet.{' '}
          <Link to={assetTyresPath(assetType, assetId)} className="font-semibold underline">
            Set axles
          </Link>
        </Alert>
      )}
      {!givenPosition && (
        <Field label="Position" required error={errors.position}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} invalid={invalid} describedBy={describedBy} value={form.position} disabled={!positions.length} onChange={set('position')}>
              <option value="">{form.assetKey && !info ? 'Loading…' : 'Choose position…'}</option>
              {positions.map((p) => (
                <option key={p.position} value={p.position}>
                  {p.position}
                  {p.tyre ? ` — has ${p.tyre.tyreCode}` : ' — empty'}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {!givenTyre && (
        <Field
          label="Tyre"
          required
          error={errors.tyreId}
          hint={
            stored && info?.asset && tyreOptions.length === 0
              ? `No tyres in the stores at ${info.asset.siteName ?? 'this site'}. Buy tyres for this site or use Tyre Transfer.`
              : `From the New and Spare Tyre Stores at ${info?.asset?.siteName ?? 'this site'}.`
          }
        >
          {({ id, invalid, describedBy }) => (
            <Select id={id} invalid={invalid} describedBy={describedBy} value={form.tyreId} disabled={!stored || tyreOptions.length === 0} onChange={set('tyreId')} searchable>
              <option value="">{stored && info ? 'Choose tyre…' : 'Loading…'}</option>
              {tyreOptions.map((t) => (
                <option key={t.id} value={t.id} data-added={t.id}>
                  {tyreLabel(t)} · {t.status === 'new' ? 'New' : t.ownerLabel ? `Spare of ${t.ownerLabel}` : 'Spare'}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <TwoColumns>
        <DateField form={form} errors={errors} set={set} label="Fitting date & time" />
        <ReadingField form={form} errors={errors} set={set} meterType={meterType} hint={lastReadingHint(info)} />
      </TwoColumns>
      {occupant && <OutcomeChoice form={form} errors={errors} set={set} setForm={setForm} legend={`${occupant.tyreCode} is at this position. What happens to it?`} />}
      {tyre && tyre.status === 'new' && <p className="mb-3 text-xs text-steel-500">Tyre cost {formatCurrency(tyre.purchaseCost)} is added to this vehicle / machine.</p>}
      <NotesField form={form} set={set} />
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Take off a fitted tyre

export function TakeOffForm({ tyre, onClose, onDone }) {
  const { form, setForm, errors, setErrors, set } = useForm({ when: nowDateTimeLocal(), meterReading: '', notes: '', ...outcomeInitial });
  const { error, saving, save } = useSave((payload) => tyresApi.remove(tyre.id, payload), onDone);
  const run = form.meterReading !== '' && Number(form.meterReading) >= tyre.fitReading ? Number(form.meterReading) - tyre.fitReading : null;

  function submit(event) {
    event.preventDefault();
    const next = { when: checkDateTime(form.when), meterReading: checkReading(form.meterReading, tyre.meterType), ...outcomeErrors(form) };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ ...splitDateTime(form.when), meterReading: Number(form.meterReading), notes: textOrNull(form.notes), ...outcomePayload(form) }, setErrors);
  }

  return (
    <FormModal title={`Take off — ${tyre.assetLabel} · ${tyre.position}`} tyre={tyre} submitLabel="Take off" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <TwoColumns>
        <DateField form={form} errors={errors} set={set} />
        <ReadingField
          form={form}
          errors={errors}
          set={set}
          meterType={tyre.meterType}
          hint={run != null ? `Run this time: ${formatNumber(run)} ${meterUnit(tyre.meterType)}` : `Fitted at ${formatNumber(tyre.fitReading)} ${meterUnit(tyre.meterType)}.`}
        />
      </TwoColumns>
      <OutcomeChoice form={form} errors={errors} set={set} setForm={setForm} legend="What happens to the tyre?" />
      <NotesField form={form} set={set} />
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Puncture, remould, scrap

export function PunctureForm({ tyre, onClose, onDone }) {
  const fitted = tyre.status === 'fitted';
  const { form, errors, setErrors, set } = useForm({ when: nowDateTimeLocal(), meterReading: '', cost: '', vendor: '', notes: '' });
  const { error, saving, save } = useSave((payload) => tyresApi.puncture(tyre.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { when: checkDateTime(form.when), cost: checkMoney(form.cost, 'Repair cost'), meterReading: fitted ? checkReading(form.meterReading, tyre.meterType) : null };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ ...splitDateTime(form.when), meterReading: fitted ? Number(form.meterReading) : null, cost: numberOrNull(form.cost), vendor: textOrNull(form.vendor), notes: textOrNull(form.notes) }, setErrors);
  }

  return (
    <FormModal title="Record puncture" tyre={tyre} submitLabel="Save puncture" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <TwoColumns>
        <DateField form={form} errors={errors} set={set} label="Puncture date & time" />
        {fitted && <ReadingField form={form} errors={errors} set={set} meterType={tyre.meterType} hint={`Fitted at ${formatNumber(tyre.fitReading)} ${meterUnit(tyre.meterType)}.`} />}
        <MoneyField form={form} errors={errors} set={set} field="cost" label="Repair cost" hint="Leave empty if free." />
        <TextField form={form} set={set} field="vendor" label="Repaired by" placeholder="Shop or person" />
      </TwoColumns>
      <NotesField form={form} set={set} label="Details (optional)" />
    </FormModal>
  );
}

export function RemouldForm({ tyre, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ when: nowDateTimeLocal(), vendor: '', notes: '' });
  const { error, saving, save } = useSave((payload) => tyresApi.sendForRemould(tyre.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { when: checkDateTime(form.when) };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ ...splitDateTime(form.when), vendor: textOrNull(form.vendor), notes: textOrNull(form.notes) }, setErrors);
  }

  return (
    <FormModal title="Send for remoulding / renewal" tyre={tyre} submitLabel="Send" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <TwoColumns>
        <DateField form={form} errors={errors} set={set} />
        <TextField form={form} set={set} field="vendor" label="Remould shop" placeholder="Shop name" />
      </TwoColumns>
      <p className="mb-3 text-xs text-steel-500">Enter the cost when the tyre comes back.</p>
    </FormModal>
  );
}

export function RemouldBackForm({ tyre, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ when: nowDateTimeLocal(), cost: '', vendor: '', notes: '' });
  const { error, saving, save } = useSave((payload) => tyresApi.remouldBack(tyre.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { when: checkDateTime(form.when), cost: checkMoney(form.cost, 'Remould cost') };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ ...splitDateTime(form.when), cost: numberOrNull(form.cost), vendor: textOrNull(form.vendor), notes: textOrNull(form.notes) }, setErrors);
  }

  return (
    <FormModal title="Back from remould" tyre={tyre} submitLabel="Back in Spare Store" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <TwoColumns>
        <DateField form={form} errors={errors} set={set} label="Date & time received" />
        <MoneyField form={form} errors={errors} set={set} field="cost" label="Remould cost" />
      </TwoColumns>
      <NotesField form={form} set={set} />
    </FormModal>
  );
}

export function ScrapForm({ tyre, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ when: nowDateTimeLocal(), reason: '', scrapValue: '' });
  const { error, saving, save } = useSave((payload) => tyresApi.scrap(tyre.id, payload), onDone);

  function submit(event) {
    event.preventDefault();
    const next = { when: checkDateTime(form.when), reason: form.reason.trim() ? null : 'Enter why it is scrapped.', scrapValue: checkMoney(form.scrapValue, 'Scrap value') };
    setErrors(next);
    if (hasErrors(next)) return;
    save({ ...splitDateTime(form.when), reason: form.reason.trim(), scrapValue: numberOrNull(form.scrapValue) }, setErrors);
  }

  return (
    <FormModal title="Scrap tyre" tyre={tyre} submitLabel="Scrap tyre" danger onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <p className="mb-3 text-sm text-steel-600">
        This tyre cost <span className="font-semibold">{formatCurrency(tyre.totalCost)}</span> in all (purchase + repairs). A scrapped tyre can't be used again.
      </p>
      <Field label="Why is it scrapped?" required error={errors.reason}>
        {({ id, invalid, describedBy }) => <Input id={id} maxLength={500} placeholder="e.g. Worn out" invalid={invalid} describedBy={describedBy} value={form.reason} onChange={set('reason')} />}
      </Field>
      <TwoColumns>
        <DateField form={form} errors={errors} set={set} />
        <MoneyField form={form} errors={errors} set={set} field="scrapValue" label="Scrap value received" />
      </TwoColumns>
    </FormModal>
  );
}

export function EditForm({ tyre, onClose, onDone }) {
  const { form, errors, setErrors, set } = useForm({ serialNumber: tyre.serialNumber ?? '', notes: tyre.notes ?? '' });
  const { error, saving, save } = useSave((payload) => tyresApi.update(tyre.id, payload), onDone);
  return (
    <FormModal
      title="Edit tyre details"
      tyre={tyre}
      submitLabel="Save"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        save({ serialNumber: textOrNull(form.serialNumber), notes: textOrNull(form.notes) }, setErrors);
      }}
      error={error}
      saving={saving}
    >
      <Field label="Serial number" error={errors.serialNumber} hint="The number moulded on the tyre (optional).">
        {({ id, invalid, describedBy }) => <Input id={id} maxLength={64} invalid={invalid} describedBy={describedBy} value={form.serialNumber} onChange={set('serialNumber')} />}
      </Field>
      <NotesField form={form} set={set} />
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Add an asset's existing spare tyres to the Spare Tyre Store (no purchase cost)

export function AddSparesForm({ asset: givenAsset = null, onClose, onDone }) {
  const { form, setForm, errors, setErrors, set } = useForm({
    assetKey: givenAsset ? `${givenAsset.assetType}:${givenAsset.assetId}` : '',
    tyreTypeId: '',
    quantity: '1',
    when: nowDateTimeLocal(),
    serials: '',
    notes: '',
  });
  const assets = useAssets();
  const [types, setTypes] = useState(null);
  const [addingType, setAddingType] = useState(false);
  const { error, saving, save } = useSave(tyresApi.addSpares, onDone);

  useEffect(() => {
    listAll(tyresApi.types, { status: 'active' })
      .then((r) => setTypes(r.data))
      .catch(() => setTypes([]));
  }, []);

  const serials = form.serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  function submit(event) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const next = {
      assetKey: form.assetKey ? null : 'Choose a vehicle or machine.',
      tyreTypeId: form.tyreTypeId ? null : 'Choose the tyre type.',
      quantity: Number.isInteger(quantity) && quantity >= 1 && quantity <= 50 ? null : 'Enter 1 to 50.',
      when: checkDateTime(form.when),
      serials: serials.length > quantity ? `You entered ${serials.length} serial numbers for ${quantity || 0} tyres.` : null,
    };
    setErrors(next);
    if (hasErrors(next)) return;
    const [assetType, assetId] = form.assetKey.split(':');
    save({ assetType, assetId, tyreTypeId: Number(form.tyreTypeId), quantity, ...splitDateTime(form.when), serialNumbers: serials, notes: textOrNull(form.notes) }, setErrors);
  }

  return (
    <>
      <FormModal title={givenAsset ? `Add spare tyres — ${givenAsset.assetLabel}` : 'Add spare tyres'} submitLabel="Add to Spare Store" onClose={onClose} onSubmit={submit} error={error} saving={saving}>
        <p className="mb-3 text-sm text-steel-600">For spare tyres a vehicle or machine already has. No purchase cost is added.</p>
        {!givenAsset && <AssetSelect assets={assets} value={form.assetKey} error={errors.assetKey} label="Spare tyres of" onChange={set('assetKey')} />}
        <Field label="Tyre type" required error={errors.tyreTypeId}>
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              value={form.tyreTypeId}
              disabled={!types}
              onChange={(e) => {
                if (e.target.value === '__new__') setAddingType(true);
                else set('tyreTypeId')(e);
              }}
            >
              <option value="">{types ? 'Choose tyre type…' : 'Loading…'}</option>
              {(types ?? []).map((t) => (
                <option key={t.id} value={t.id} data-added={t.id}>
                  {tyreTypeName(t)}
                </option>
              ))}
              <option value="__new__">+ New tyre type…</option>
            </Select>
          )}
        </Field>
        <TwoColumns>
          <Field label="How many" required error={errors.quantity}>
            {({ id, invalid, describedBy }) => <Input id={id} type="number" min="1" max="50" step="1" inputMode="numeric" invalid={invalid} describedBy={describedBy} value={form.quantity} onChange={set('quantity')} />}
          </Field>
          <DateField form={form} errors={errors} set={set} />
        </TwoColumns>
        <Field label="Serial numbers (optional)" error={errors.serials} hint="One per line, if known.">
          {({ id, invalid, describedBy }) => <textarea id={id} rows={2} aria-invalid={invalid || undefined} aria-describedby={describedBy} value={form.serials} onChange={set('serials')} className={textareaClasses} />}
        </Field>
      </FormModal>
      <TyreTypeModal
        open={addingType}
        onClose={() => setAddingType(false)}
        onSaved={(type) => {
          setTypes((all) => [...(all ?? []), type].sort((a, b) => tyreTypeName(a).localeCompare(tyreTypeName(b))));
          setForm((f) => ({ ...f, tyreTypeId: String(type.id) }));
          setAddingType(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Which buttons a tyre shows, in order. The first is the main one.

export const ACTIONS = {
  fit: { label: 'Fit', Form: FitForm },
  takeOff: { label: 'Take off', Form: TakeOffForm },
  puncture: { label: 'Puncture', Form: PunctureForm },
  remould: { label: 'Send for remould', Form: RemouldForm },
  remouldBack: { label: 'Back from remould', Form: RemouldBackForm },
  scrap: { label: 'Scrap', Form: ScrapForm },
  edit: { label: 'Edit', Form: EditForm },
};

export function actionsFor(tyre, { detail = false } = {}) {
  const stored = tyre.status === 'new' || tyre.status === 'spare';
  if (!detail) {
    if (stored) return ['fit'];
    if (tyre.status === 'fitted') return ['takeOff', 'puncture'];
    if (tyre.status === 'remould') return ['remouldBack'];
    return [];
  }
  if (stored) return ['fit', 'puncture', 'remould', 'scrap', 'edit'];
  if (tyre.status === 'fitted') return ['takeOff', 'puncture', 'edit'];
  if (tyre.status === 'remould') return ['remouldBack', 'scrap', 'edit'];
  return ['edit'];
}

export function TyreActionForm({ action, tyre, onClose, onDone }) {
  const Form = ACTIONS[action]?.Form;
  if (!Form || !tyre) return null;
  return <Form tyre={tyre} onClose={onClose} onDone={onDone} />;
}
