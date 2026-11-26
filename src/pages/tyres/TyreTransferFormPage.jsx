import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listAll, sitesApi, tyresApi } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner, BackLink } from '../../components/ui';
import { STATUS_BY_VALUE, checkDateTime, nowDateTimeLocal, splitDateTime } from '../../config/tyres';

export default function TyreTransferFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [sites, setSites] = useState(null);
  const [form, setForm] = useState({ fromSiteId: params.get('from') ?? '', toSiteId: '', when: nowDateTimeLocal(), notes: '' });
  const [tyres, setTyres] = useState(null);
  const [selected, setSelected] = useState(() => new Set(params.get('tyre') ? [Number(params.get('tyre'))] : []));
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAll(sitesApi.list)
      .then((r) => setSites(r.data))
      .catch(() => setSites([]));
  }, []);

  // The tyres in the New and Spare Tyre Stores at the "from" site.
  useEffect(() => {
    let cancelled = false;
    setTyres(null);
    if (!form.fromSiteId) return undefined;
    listAll(tyresApi.list, { status: 'stored', siteId: form.fromSiteId, sort: 'tyreCode:asc' })
      .then((r) => !cancelled && setTyres(r.data.filter((t) => String(t.siteId) === form.fromSiteId)))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [form.fromSiteId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!tyres || !term) return tyres ?? [];
    return tyres.filter((t) => `${t.tyreCode} ${t.serialNumber ?? ''} ${t.tyreTypeLabel} ${t.tyreSize} ${t.ownerLabel ?? ''}`.toLowerCase().includes(term));
  }, [tyres, search]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    if (field === 'fromSiteId') setSelected(new Set());
  };

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const t of visible) {
        if (allVisibleSelected) next.delete(t.id);
        else next.add(t.id);
      }
      return next;
    });

  async function submit(event) {
    event.preventDefault();
    const next = {
      fromSiteId: form.fromSiteId ? null : 'Choose the site the tyres are at.',
      toSiteId: !form.toSiteId ? 'Choose the site to move them to.' : form.toSiteId === form.fromSiteId ? 'Choose a different site.' : null,
      when: checkDateTime(form.when),
      tyres: selected.size ? null : 'Tick at least one tyre.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await tyresApi.createTransfer({
        fromSiteId: Number(form.fromSiteId),
        toSiteId: Number(form.toSiteId),
        ...splitDateTime(form.when),
        notes: form.notes.trim() || null,
        tyreIds: [...selected],
      });
      navigate('/tyres/transfers', { state: { message: response.message } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const siteOptions = (exclude) =>
    (sites ?? [])
      .filter((s) => String(s.id) !== exclude)
      .map((s) => (
        <option key={s.id} value={s.id} data-added={s.id}>
          {s.name}
        </option>
      ));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <BackLink to="/tyres/transfers" label="Tyre Transfers" />
        <h1 className="mt-1 text-xl font-semibold text-steel-900">New tyre transfer</h1>
        <p className="mt-1 text-steel-500">Move tyres from one site's New or Spare Tyre Store to another site.</p>
      </div>

      <form onSubmit={submit} noValidate>
        <Alert tone="error">{error}</Alert>
        <Card>
          <div className="grid gap-x-3 sm:grid-cols-3">
            <Field label="From site" required error={errors.fromSiteId}>
              {({ id, invalid, describedBy }) => (
                <Select id={id} invalid={invalid} describedBy={describedBy} value={form.fromSiteId} disabled={!sites} onChange={set('fromSiteId')}>
                  <option value="">{sites ? 'Choose site…' : 'Loading…'}</option>
                  {siteOptions(null)}
                </Select>
              )}
            </Field>
            <Field label="To site" required error={errors.toSiteId}>
              {({ id, invalid, describedBy }) => (
                <Select id={id} invalid={invalid} describedBy={describedBy} value={form.toSiteId} disabled={!sites} onChange={set('toSiteId')}>
                  <option value="">{sites ? 'Choose site…' : 'Loading…'}</option>
                  {siteOptions(form.fromSiteId)}
                </Select>
              )}
            </Field>
            <Field label="Transfer date & time" required error={errors.when}>
              {({ id, invalid, describedBy }) => <Input id={id} type="datetime-local" max={nowDateTimeLocal()} invalid={invalid} describedBy={describedBy} value={form.when} onChange={set('when')} />}
            </Field>
          </div>
          <Field label="Notes (optional)">{({ id }) => <Input id={id} maxLength={1000} placeholder="e.g. Vehicle name or reason" value={form.notes} onChange={set('notes')} />}</Field>
        </Card>

        <Card
          className="mt-4"
          title={`Tyres to move${selected.size ? ` — ${selected.size} ticked` : ''}`}
          subtitle={form.fromSiteId ? 'Only tyres in the New and Spare Tyre Stores can be moved.' : 'Choose the "From site" first.'}
        >
          {errors.tyres && <p className="mb-2 text-sm font-medium text-danger-600">{errors.tyres}</p>}
          {form.fromSiteId && !tyres && <Spinner label="Loading tyres" />}
          {tyres && tyres.length === 0 && <p className="text-sm text-steel-500">No tyres in the stores at this site.</p>}
          {tyres && tyres.length > 0 && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-56">
                  <Input placeholder="Search tyre ID, serial, brand or size" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-steel-700">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /> Tick all shown ({visible.length})
                </label>
              </div>
              <ul className="max-h-[26rem] divide-y divide-steel-100 overflow-y-auto rounded border border-steel-200">
                {visible.map((t) => (
                  <li key={t.id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${selected.has(t.id) ? 'bg-brand-50' : ''}`}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                      <span className="font-semibold text-steel-900 tabular-nums">{t.tyreCode}</span>
                      <span className="min-w-0 flex-1 truncate text-steel-600">
                        {t.tyreTypeLabel} · {t.tyreSize}
                        {t.serialNumber ? ` · SN ${t.serialNumber}` : ''}
                      </span>
                      <span className="shrink-0 text-xs text-steel-500">{t.ownerLabel ? `Spare of ${t.ownerLabel}` : STATUS_BY_VALUE[t.status]?.short}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button as={Link} to="/tyres/transfers" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Move {selected.size || ''} {selected.size === 1 ? 'tyre' : 'tyres'}
          </Button>
        </div>
      </form>
    </div>
  );
}
