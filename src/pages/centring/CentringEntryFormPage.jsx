import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { centringApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { ADJUSTMENT_REASONS, ENTRY_TYPES, formatQuantity, itemPath, useCentringSites } from '../../components/centring/centringCommon';
import { formatCurrency, todayDateOnly } from '../../config/fuel';

const EMPTY_LINE = { itemId: '', quantity: '', countedQuantity: '', unitPrice: '', taxPercent: '' };

const PURCHASE_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-[1.75rem_minmax(0,3fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_2rem] lg:items-center lg:gap-y-0';
const MOVE_GRID = 'grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[1.75rem_minmax(0,3fr)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] lg:items-center lg:gap-y-0';
const cellLabel = 'mb-1 block text-xs font-semibold text-steel-600 lg:sr-only';

const DESCRIPTIONS = {
  purchase: 'Material bought from a supplier. It is added to the stock of the site you choose.',
  issue: "Material taken out of a site's stock for work. Say what it was issued for.",
  transfer: 'Material moved from one site to another.',
  adjustment: 'Material lost, damaged or scrapped at a site, or a stock count that corrects the stock.',
};

function CellLabel({ htmlFor, required = false, children }) {
  return (
    <label htmlFor={htmlFor} className={cellLabel}>
      {children}
      {required && <span className="ml-0.5 text-danger-600">*</span>}
    </label>
  );
}

function lineTotal(line) {
  const q = Number(line.quantity);
  const p = Number(line.unitPrice);
  const t = Number(line.taxPercent || 0);
  if (!(q > 0) || line.unitPrice === '' || !(p >= 0)) return null;
  return q * p * (1 + t / 100);
}

function SiteSelect({ id, invalid, describedBy, value, onChange, sites, exclude }) {
  return (
    <Select id={id} invalid={invalid} describedBy={describedBy} value={value} onChange={onChange}>
      <option value="">Select a site</option>
      {sites
        .filter((s) => String(s.id) !== String(exclude ?? ''))
        .map((s) => (
          <option key={s.id} value={s.id} data-added={s.id}>
            {s.name}
          </option>
        ))}
    </Select>
  );
}

export default function CentringEntryFormPage() {
  const { type } = useParams();
  const meta = ENTRY_TYPES[type];
  const navigate = useNavigate();
  const { can } = useAuth();
  const sites = useCentringSites();

  const [form, setForm] = useState({ siteId: '', fromSiteId: '', supplierId: '', billNumber: '', purpose: '', issuedTo: '', reason: '', entryDate: todayDateOnly(), remarks: '' });
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [errors, setErrors] = useState({});
  const [lineErrors, setLineErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [stock, setStock] = useState(null);

  const counting = type === 'adjustment' && form.reason === 'Stock count';
  // The site stock leaves: the transfer's "from" site, otherwise the entry's own site. A purchase takes nothing.
  const source = type === 'transfer' ? form.fromSiteId : type === 'purchase' ? '' : form.siteId;
  const takesStock = type !== 'purchase' && !counting;

  useEffect(() => {
    if (!meta) return;
    listAll(centringApi.items.list)
      .then((r) => setItems(r.data))
      .catch((err) => setError(err.message));
    if (type === 'purchase') {
      listAll(centringApi.suppliers.list)
        .then((r) => setSuppliers(r.data))
        .catch(() => setSuppliers([]));
    }
  }, [meta, type]);

  // Someone with a single site always works there.
  useEffect(() => {
    if (!sites || sites.own.length !== 1) return;
    const only = String(sites.own[0].id);
    setForm((f) => (type === 'transfer' ? { ...f, fromSiteId: f.fromSiteId || only } : { ...f, siteId: f.siteId || only }));
  }, [sites, type]);

  useEffect(() => {
    if (!source) {
      setStock(null);
      return undefined;
    }
    let cancelled = false;
    setStock(null);
    centringApi
      .stock({ siteId: source })
      .then((r) => !cancelled && setStock(new Map(r.data.items.map((i) => [String(i.id), i.sites[0]?.quantity ?? 0]))))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const itemById = useMemo(() => new Map((items ?? []).map((i) => [String(i.id), i])), [items]);
  const choosable = useMemo(() => {
    if (!items) return [];
    const list = takesStock ? items.filter((i) => (stock?.get(String(i.id)) ?? 0) > 0) : items;
    return [...list].sort((a, b) => itemPath(a).localeCompare(itemPath(b)) || a.itemName.localeCompare(b.itemName));
  }, [items, stock, takesStock]);

  if (!meta) return <Navigate to="/centring/movements" replace />;
  if (!can('CENTRING', meta.action)) return <Alert tone="error">You are not allowed to record a centring {meta.label.toLowerCase()}.</Alert>;

  const set = (field) => (event) => {
    const value = event.target.value;
    setForm((f) => ({ ...f, [field]: value, ...(field === 'fromSiteId' && f.siteId === value ? { siteId: '' } : {}) }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    if ((field === 'siteId' && type !== 'transfer' && type !== 'purchase') || field === 'fromSiteId' || field === 'reason') setLines([{ ...EMPTY_LINE }]);
  };
  const setLine = (index, field) => (event) => {
    const value = event.target.value;
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    setLineErrors((e) => ({ ...e, [index]: undefined }));
  };

  const purchaseTotal = type === 'purchase' ? lines.reduce((sum, l) => sum + (lineTotal(l) ?? 0), 0) : 0;

  function validate() {
    const next = {
      entryDate: !form.entryDate ? 'Choose the date.' : form.entryDate > todayDateOnly() ? "Date can't be in the future." : null,
      siteId: !form.siteId ? 'Choose the site.' : null,
      fromSiteId: type === 'transfer' && !form.fromSiteId ? 'Choose the site it leaves.' : null,
      supplierId: type === 'purchase' && !form.supplierId ? 'Choose the supplier.' : null,
      purpose: type === 'issue' && !form.purpose.trim() ? 'Enter what it was issued for.' : null,
      reason: type === 'adjustment' && !form.reason ? 'Choose the reason.' : null,
    };
    const perLine = {};
    lines.forEach((l, index) => {
      const item = itemById.get(String(l.itemId));
      const raw = counting ? l.countedQuantity : l.quantity;
      const qty = Number(raw);
      const have = stock?.get(String(l.itemId)) ?? 0;
      if (!l.itemId) perLine[index] = 'Select an item.';
      else if (raw === '' || !Number.isFinite(qty) || qty < 0 || (!counting && qty === 0)) perLine[index] = counting ? 'Enter the counted quantity.' : 'Enter a quantity above 0.';
      else if (takesStock && qty > have) perLine[index] = `Only ${formatQuantity(have, item?.unit)} available.`;
      else if (type === 'purchase' && (l.unitPrice === '' || Number(l.unitPrice) < 0)) perLine[index] = 'Enter the unit price.';
      else if (type === 'purchase' && l.taxPercent !== '' && (Number(l.taxPercent) < 0 || Number(l.taxPercent) > 100)) perLine[index] = 'Tax % must be 0–100.';
    });
    setErrors(next);
    setLineErrors(perLine);
    return !Object.values(next).some(Boolean) && Object.keys(perLine).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError(null);
    const payload = {
      entryType: type,
      entryDate: form.entryDate,
      remarks: form.remarks.trim() || null,
      ...(type === 'transfer' ? { fromSiteId: Number(form.fromSiteId), toSiteId: Number(form.siteId) } : { siteId: Number(form.siteId) }),
      ...(type === 'purchase' ? { supplierId: Number(form.supplierId), billNumber: form.billNumber.trim() || null } : {}),
      ...(type === 'issue' ? { purpose: form.purpose.trim(), issuedTo: form.issuedTo.trim() || null } : {}),
      ...(type === 'adjustment' ? { reason: form.reason } : {}),
      lines: lines.map((l) => ({
        itemId: Number(l.itemId),
        ...(counting ? { countedQuantity: Number(l.countedQuantity) } : { quantity: Number(l.quantity) }),
        ...(type === 'purchase' ? { unitPrice: Number(l.unitPrice), taxPercent: l.taxPercent === '' ? 0 : Number(l.taxPercent) } : {}),
      })),
    };
    try {
      const response = await centringApi.createEntry(payload);
      navigate(`/centring/movements/${response.data.id}`, { state: { message: response.message } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!sites || !items) return <Spinner label="Loading" />;

  const grid = type === 'purchase' ? PURCHASE_GRID : MOVE_GRID;
  const qtyLabel = counting ? 'Counted quantity' : 'Quantity';
  const noStockHere = takesStock && source && stock && choosable.length === 0;
  const oneSite = sites.own.length === 1;
  const canAddLine = lines.length < choosable.length;
  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE }]);

  let itemsArea = null;
  if (items.length === 0) {
    itemsArea = (
      <Alert tone="warning">
        No items yet. Add them first in{' '}
        <Link to="/centring/catalog?tab=items" className="font-semibold underline">
          Centring Catalog › Items
        </Link>
        .
      </Alert>
    );
  } else if (type !== 'purchase' && !source) {
    itemsArea = <p className="rounded bg-steel-50 px-3 py-2 text-sm text-steel-600">Choose the {type === 'transfer' ? 'site it leaves' : 'site'} first.</p>;
  } else if (type === 'adjustment' && !form.reason) {
    itemsArea = <p className="rounded bg-steel-50 px-3 py-2 text-sm text-steel-600">Choose the reason first.</p>;
  } else if (source && !stock) {
    itemsArea = <Spinner label="Loading stock" />;
  } else if (noStockHere) {
    itemsArea = <Alert tone="warning">There is no centring stock at this site. Record a purchase first.</Alert>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-steel-900">{meta.title}</h1>
        <p className="mt-1 text-steel-500">{DESCRIPTIONS[type]}</p>
      </div>

      <Card>
        <form onSubmit={submit} noValidate>
          <Alert tone="error">{error}</Alert>

          <div className="grid gap-x-4 sm:grid-cols-2">
            {type === 'transfer' ? (
              <>
                <Field label="From site" required error={errors.fromSiteId}>
                  {(p) => <SiteSelect {...p} value={form.fromSiteId} onChange={set('fromSiteId')} sites={sites.own} />}
                </Field>
                <Field label="To site" required error={errors.siteId}>
                  {(p) => <SiteSelect {...p} value={form.siteId} onChange={set('siteId')} sites={sites.all} exclude={form.fromSiteId} />}
                </Field>
              </>
            ) : oneSite ? (
              <Field label="Site">{({ id }) => <Input id={id} value={sites.own[0].name} disabled />}</Field>
            ) : (
              <Field label="Site" required error={errors.siteId}>
                {(p) => <SiteSelect {...p} value={form.siteId} onChange={set('siteId')} sites={sites.own} />}
              </Field>
            )}

            {type === 'purchase' && (
              <>
                <Field label="Supplier" required error={errors.supplierId} hint={suppliers.length === 0 ? 'Add suppliers in Centring Catalog › Suppliers.' : undefined}>
                  {({ id, invalid, describedBy }) => (
                    <Select id={id} invalid={invalid} describedBy={describedBy} value={form.supplierId} onChange={set('supplierId')}>
                      <option value="">Select a supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id} data-added={s.id}>
                          {s.supplierName}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Bill no.">{({ id }) => <Input id={id} maxLength={60} value={form.billNumber} onChange={set('billNumber')} />}</Field>
              </>
            )}

            {type === 'issue' && (
              <>
                <Field label="Purpose" required error={errors.purpose} hint="What it was issued for, e.g. 3rd floor slab, Block B">
                  {({ id, invalid, describedBy }) => <Input id={id} invalid={invalid} describedBy={describedBy} maxLength={255} value={form.purpose} onChange={set('purpose')} />}
                </Field>
                <Field label="Issued to">
                  {({ id }) => <Input id={id} maxLength={150} placeholder="Optional — contractor or person" value={form.issuedTo} onChange={set('issuedTo')} />}
                </Field>
              </>
            )}

            {type === 'adjustment' && (
              <Field
                label="Reason"
                required
                error={errors.reason}
                hint={counting ? 'Enter what you counted; the system corrects the difference.' : form.reason ? 'Enter how much was lost, damaged or scrapped.' : undefined}
              >
                {({ id, invalid, describedBy }) => (
                  <Select id={id} invalid={invalid} describedBy={describedBy} value={form.reason} onChange={set('reason')}>
                    <option value="">Select a reason</option>
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            <Field label="Date" required error={errors.entryDate}>
              {({ id, invalid, describedBy }) => <Input id={id} type="date" max={todayDateOnly()} invalid={invalid} describedBy={describedBy} value={form.entryDate} onChange={set('entryDate')} />}
            </Field>
            <Field label="Remarks">{({ id }) => <Input id={id} maxLength={1000} value={form.remarks} onChange={set('remarks')} />}</Field>
          </div>

          <div className="mt-4 border-t border-steel-200 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-steel-900">
              Items{!itemsArea && lines.length > 1 ? ` (${lines.length})` : ''}
            </h2>

            {itemsArea ?? (
              <>
                <div aria-hidden="true" className={`${grid} hidden border-b border-steel-200 pb-2 text-xs font-semibold tracking-wide text-steel-500 uppercase lg:grid`}>
                  <span>#</span>
                  <span>
                    Item<span className="ml-0.5 text-danger-600">*</span>
                  </span>
                  <span className="text-right">
                    {qtyLabel}
                    <span className="ml-0.5 text-danger-600">*</span>
                  </span>
                  {type === 'purchase' ? (
                    <>
                      <span className="text-right">
                        Unit price<span className="ml-0.5 text-danger-600">*</span>
                      </span>
                      <span className="text-right">Tax %</span>
                      <span className="text-right">Total incl. tax</span>
                    </>
                  ) : (
                    <span className="text-right">{counting ? 'System shows' : 'Available'}</span>
                  )}
                  <span />
                </div>

                <div className="flex flex-col gap-2 lg:gap-0">
                  {lines.map((line, index) => {
                    const rowId = `centring-line-${index}`;
                    const item = itemById.get(String(line.itemId));
                    const taken = new Set(lines.filter((_, i) => i !== index).map((l) => String(l.itemId)));
                    const total = type === 'purchase' ? lineTotal(line) : null;
                    const have = stock?.get(String(line.itemId)) ?? 0;
                    return (
                      <div key={index} className={`${grid} rounded border border-steel-200 p-3 lg:rounded-none lg:border-0 lg:border-b lg:border-steel-100 lg:px-0 lg:py-1.5`}>
                        <div className={`col-span-2 flex items-center justify-between ${type === 'purchase' ? 'sm:col-span-4' : ''} lg:col-span-1`}>
                          <span className="text-sm font-semibold text-steel-500 tabular-nums">
                            <span className="lg:hidden">Item </span>
                            {index + 1}
                          </span>
                          {lines.length > 1 && (
                            <button type="button" className="text-sm font-semibold text-danger-600 hover:underline lg:hidden" onClick={() => setLines((ls) => ls.filter((_, i) => i !== index))}>
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="col-span-2 min-w-0 lg:col-span-1">
                          <CellLabel htmlFor={`${rowId}-item`} required>
                            Item
                          </CellLabel>
                          <Select id={`${rowId}-item`} aria-label={`Item ${index + 1}`} invalid={Boolean(lineErrors[index]) && !line.itemId} value={line.itemId} onChange={setLine(index, 'itemId')}>
                            <option value="">Select an item</option>
                            {choosable
                              .filter((i) => !taken.has(String(i.id)))
                              .map((i) => (
                                <option key={i.id} value={i.id} data-added={i.id}>
                                  {`${i.itemName} — ${itemPath(i)}`}
                                </option>
                              ))}
                          </Select>
                          {lineErrors[index] && <p className="mt-0.5 text-xs font-medium text-danger-600">{lineErrors[index]}</p>}
                        </div>

                        <div className="min-w-0">
                          <CellLabel htmlFor={`${rowId}-qty`} required>
                            {qtyLabel}
                          </CellLabel>
                          <div className="relative">
                            <Input
                              id={`${rowId}-qty`}
                              aria-label={`${qtyLabel} for item ${index + 1}`}
                              className="pr-11 text-right tabular-nums"
                              type="number"
                              min={0}
                              step="any"
                              inputMode="decimal"
                              value={counting ? line.countedQuantity : line.quantity}
                              onChange={setLine(index, counting ? 'countedQuantity' : 'quantity')}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-steel-500">{item?.unit ?? ''}</span>
                          </div>
                        </div>

                        {type === 'purchase' ? (
                          <>
                            <div className="min-w-0">
                              <CellLabel htmlFor={`${rowId}-price`} required>
                                Unit price (before tax)
                              </CellLabel>
                              <Input id={`${rowId}-price`} aria-label={`Unit price for item ${index + 1}`} className="text-right tabular-nums" type="number" min={0} step="any" inputMode="decimal" value={line.unitPrice} onChange={setLine(index, 'unitPrice')} />
                            </div>
                            <div className="min-w-0">
                              <CellLabel htmlFor={`${rowId}-tax`}>Tax %</CellLabel>
                              <Input id={`${rowId}-tax`} aria-label={`Tax percent for item ${index + 1}`} className="text-right tabular-nums" type="number" min={0} max={100} step="any" inputMode="decimal" value={line.taxPercent} onChange={setLine(index, 'taxPercent')} />
                            </div>
                            <div className="min-w-0 sm:text-right">
                              <span className={cellLabel}>Total incl. tax</span>
                              <div className="text-sm font-semibold text-steel-900 tabular-nums">{total === null ? '—' : formatCurrency(total)}</div>
                            </div>
                          </>
                        ) : (
                          <div className="min-w-0 lg:text-right">
                            <span className={cellLabel}>{counting ? 'System shows' : 'Available'}</span>
                            <div className="text-sm text-steel-700 tabular-nums">{item ? formatQuantity(have, item.unit) : '—'}</div>
                          </div>
                        )}

                        <div className="hidden text-right lg:block">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove item ${index + 1}`}
                              title="Remove this item"
                              className="rounded px-1.5 py-0.5 text-steel-500 hover:bg-danger-50 hover:text-danger-600"
                              onClick={() => setLines((ls) => ls.filter((_, i) => i !== index))}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <Button type="button" variant="secondary" disabled={!canAddLine} onClick={addLine}>
                      + Add another item
                    </Button>
                    {!canAddLine && (
                      <span className="text-xs text-steel-500">
                        {takesStock ? 'Every item in stock at this site is already added.' : 'Every item in the catalog is already added.'}
                      </span>
                    )}
                  </div>
                  {type === 'purchase' && purchaseTotal > 0 && (
                    <p className="text-sm text-steel-600">
                      {lines.length} {lines.length === 1 ? 'item' : 'items'} · Total incl. tax <span className="font-semibold text-steel-900 tabular-nums">{formatCurrency(purchaseTotal)}</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={items.length === 0}>
              {meta.submit}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
