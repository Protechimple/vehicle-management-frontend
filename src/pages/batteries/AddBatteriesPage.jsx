import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { batteriesApi, sitesApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useSiteNames from '../../hooks/useSiteNames';
import { formatCurrency, todayDateOnly } from '../../config/batteries';

let nextKey = 1;
// A new row copies the row above, except the serial number, so the same batteries are quick to enter.
const newRow = (from = {}) => ({
  key: nextKey++,
  serialNumber: '',
  brand: from.brand ?? '',
  capacityAh: from.capacityAh ?? '',
  purchaseCost: from.purchaseCost ?? '',
  warrantyMonths: from.warrantyMonths ?? '',
});

function wholeNumber(value, max) {
  if (value === '') return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max;
}

export default function AddBatteriesPage() {
  const navigate = useNavigate();
  const { role, user, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;
  const siteNames = useSiteNames();
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({ siteId: '', purchaseDate: todayDateOnly(), supplierName: '', invoiceNumber: '' });
  const [rows, setRows] = useState([newRow()]);
  const [errors, setErrors] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (picksSite) listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, [picksSite]);

  const set = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function setCell(key, field, value) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setRowErrors((all) => ({ ...all, [key]: undefined }));
  }

  const addRow = () => setRows((all) => (all.length >= 50 ? all : [...all, newRow(all[all.length - 1])]));
  const removeRow = (key) => setRows((all) => (all.length === 1 ? all : all.filter((r) => r.key !== key)));
  const total = rows.reduce((t, r) => t + (Number(r.purchaseCost) > 0 ? Number(r.purchaseCost) : 0), 0);

  async function submit(event) {
    event.preventDefault();
    const next = {
      siteId: picksSite ? (form.siteId ? null : 'Choose the site.') : user?.siteId ? null : 'No site is assigned to your account. Ask your Admin to assign one.',
      purchaseDate: !form.purchaseDate ? 'Choose the date.' : form.purchaseDate > todayDateOnly() ? "Date can't be in the future." : null,
    };
    const nextRows = {};
    const seen = new Set();
    for (const r of rows) {
      const serial = r.serialNumber.trim().toUpperCase();
      const cost = Number(r.purchaseCost);
      let message = null;
      if (!serial) message = 'Enter the serial number.';
      else if (seen.has(serial)) message = 'This serial number is entered twice.';
      else if (!r.brand.trim()) message = 'Enter the brand.';
      else if (r.purchaseCost === '' || !Number.isFinite(cost) || cost < 0) message = 'Enter the price.';
      else if (!wholeNumber(r.capacityAh, 10000)) message = 'Ah must be a whole number.';
      else if (!wholeNumber(r.warrantyMonths, 240)) message = 'Warranty must be whole months, up to 240.';
      seen.add(serial);
      if (message) nextRows[r.key] = message;
    }
    setErrors(next);
    setRowErrors(nextRows);
    if (Object.values(next).some(Boolean) || Object.keys(nextRows).length) return;

    setSaving(true);
    setError(null);
    try {
      const response = await batteriesApi.purchase({
        siteId: picksSite ? Number(form.siteId) : undefined,
        purchaseDate: form.purchaseDate,
        supplierName: form.supplierName.trim() || null,
        invoiceNumber: form.invoiceNumber.trim() || null,
        batteries: rows.map((r) => ({
          serialNumber: r.serialNumber.trim(),
          brand: r.brand.trim(),
          capacityAh: r.capacityAh === '' ? null : Number(r.capacityAh),
          purchaseCost: Number(r.purchaseCost),
          warrantyMonths: r.warrantyMonths === '' ? null : Number(r.warrantyMonths),
        })),
      });
      const codes = response.data.map((b) => b.batteryCode).join(', ');
      navigate('/batteries', { state: { status: 'ready', message: `${response.data.length} ${response.data.length === 1 ? 'battery' : 'batteries'} added to store: ${codes}.` } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const cell = 'w-full rounded border px-2 py-1.5 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none';
  const th = 'px-2 py-2 text-xs font-semibold tracking-wide text-steel-500 uppercase whitespace-nowrap';
  const req = <span className="text-danger-600">*</span>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <Link to="/batteries" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Batteries
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">Add batteries</h1>
        <p className="mt-1 text-steel-500">Enter the batteries you bought. They go into store at the site, ready to fit.</p>
      </div>

      <form onSubmit={submit} noValidate>
        <Alert tone="error">{error}</Alert>

        <Card>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {picksSite ? (
              <Field label="Site" required error={errors.siteId}>
                {({ id, invalid, describedBy }) => (
                  <Select id={id} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={set('siteId')}>
                    <option value="">Choose a site…</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id} data-added={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Site" error={errors.siteId}>
                {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} value={user?.siteId ? siteNames[user.siteId] ?? 'Your site' : 'Not assigned'} disabled />}
              </Field>
            )}
            <Field label="Date bought" required error={errors.purchaseDate}>
              {({ id, invalid, describedBy }) => <Input id={id} type="date" max={todayDateOnly()} invalid={invalid} describedBy={describedBy} value={form.purchaseDate} onChange={set('purchaseDate')} />}
            </Field>
            <Field label="Supplier">
              {({ id }) => <Input id={id} maxLength={255} placeholder="Optional" value={form.supplierName} onChange={set('supplierName')} />}
            </Field>
            <Field label="Bill / invoice no.">
              {({ id }) => <Input id={id} maxLength={64} placeholder="Optional" value={form.invoiceNumber} onChange={set('invoiceNumber')} />}
            </Field>
          </div>
        </Card>

        <Card title={`Batteries (${rows.length})`} className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-steel-200">
                  <th className={th}>#</th>
                  <th className={th}>Serial no. {req}</th>
                  <th className={th}>Brand {req}</th>
                  <th className={th}>Ah</th>
                  <th className={th}>Price {req}</th>
                  <th className={th}>Warranty (months)</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, index) => {
                  const message = rowErrors[r.key];
                  const border = message ? 'border-danger-500' : 'border-steel-200';
                  return (
                    <tr key={r.key} className="align-top">
                      <td className="px-2 py-2 text-steel-500">{index + 1}</td>
                      <td className="px-2 py-2">
                        <input aria-label={`Battery ${index + 1} serial number`} className={`${cell} ${border} uppercase`} maxLength={64} value={r.serialNumber} onChange={(e) => setCell(r.key, 'serialNumber', e.target.value)} />
                        {message && <p className="mt-1 text-xs font-medium text-danger-600">{message}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label={`Battery ${index + 1} brand`} className={`${cell} ${border}`} maxLength={100} placeholder="e.g. Exide" value={r.brand} onChange={(e) => setCell(r.key, 'brand', e.target.value)} />
                      </td>
                      <td className="w-20 px-2 py-2">
                        <input aria-label={`Battery ${index + 1} Ah`} type="number" min="1" step="1" inputMode="numeric" className={`${cell} border-steel-200`} value={r.capacityAh} onChange={(e) => setCell(r.key, 'capacityAh', e.target.value)} />
                      </td>
                      <td className="w-32 px-2 py-2">
                        <input aria-label={`Battery ${index + 1} price`} type="number" min="0" step="any" inputMode="decimal" className={`${cell} ${border}`} value={r.purchaseCost} onChange={(e) => setCell(r.key, 'purchaseCost', e.target.value)} />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <input aria-label={`Battery ${index + 1} warranty in months`} type="number" min="0" step="1" inputMode="numeric" className={`${cell} border-steel-200`} value={r.warrantyMonths} onChange={(e) => setCell(r.key, 'warrantyMonths', e.target.value)} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        {rows.length > 1 && (
                          <button type="button" aria-label={`Remove battery ${index + 1}`} className="px-1 text-steel-500 hover:text-danger-600" onClick={() => removeRow(r.key)}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={addRow} disabled={rows.length >= 50}>
              + Add another battery
            </Button>
            <span className="text-xs text-steel-500">A new row copies the brand, Ah, price and warranty from the row above.</span>
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-steel-600">
            {rows.length} {rows.length === 1 ? 'battery' : 'batteries'} · total <span className="font-semibold text-steel-900">{formatCurrency(total)}</span>
          </p>
          <div className="flex gap-2">
            <Button as={Link} to="/batteries" variant="secondary">
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save batteries
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
