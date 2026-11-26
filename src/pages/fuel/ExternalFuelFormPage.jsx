import { useEffect, useState } from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import { externalFuelApi, siteFuelStockApi, sitesApi, listAll } from '../../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner, BackLink } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import {
  EXTERNAL_CATEGORY,
  STORABLE_FUEL_TYPES,
  formatCurrency,
  formatLitres,
  nowTimeOnly,
  todayDateOnly,
} from '../../config/fuel';

const MOBILE_PATTERN = /^\+?[0-9\s\-()]+$/;

function Figure({ label, value, tone = 'text-steel-900' }) {
  return (
    // The label (it can hold a long site name) may wrap on narrow phones; the figure itself stays on one line.
    <span className="wrap-break-word">
      <span className="text-steel-500">{label} </span>
      <span className={`font-semibold whitespace-nowrap tabular-nums ${tone}`}>{value}</span>
    </span>
  );
}

export default function ExternalFuelFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, role, canPickSite } = useAuth();
  // Admins, and anyone with several sites, choose which site; everyone else always works at their one site.
  const picksSite = canPickSite;

  const [form, setForm] = useState({
    siteId: picksSite ? '' : String(user?.siteId ?? ''),
    fuelType: 'Diesel',
    quantity: '',
    entryDate: todayDateOnly(),
    entryTime: nowTimeOnly(),
    vehicleNumber: '',
    vehicleName: '',
    category: '',
    partyName: '',
    driverName: '',
    driverMobile: '',
    authorisedBy: '',
  });
  const [existing, setExisting] = useState(null);
  const [sites, setSites] = useState(null);
  const [stock, setStock] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAll(sitesApi.list).then((r) => setSites(r.data)).catch(() => setSites([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    externalFuelApi
      .get(id)
      .then((response) => {
        const r = response.data;
        setExisting(r);
        setForm({
          siteId: String(r.siteId),
          fuelType: r.fuelType,
          quantity: String(r.quantity),
          entryDate: r.entryDate,
          entryTime: r.entryTime ?? '',
          vehicleNumber: r.vehicleNumber,
          vehicleName: r.vehicleName ?? '',
          category: r.category,
          partyName: r.partyName,
          driverName: r.driverName ?? '',
          driverMobile: r.driverMobile ?? '',
          authorisedBy: r.authorisedBy ?? '',
        });
      })
      .catch((err) => setLoadError(err.message));
  }, [id, isEdit]);

  useEffect(() => {
    if (isEdit || !form.siteId || !form.fuelType) {
      setStock(null);
      return;
    }
    let cancelled = false;
    const siteId = Number(form.siteId);
    siteFuelStockApi
      .list({ siteId, fuelType: form.fuelType })
      .then((r) => {
        if (cancelled) return;
        const row = r.data.find((x) => x.siteId === siteId && x.fuelType === form.fuelType);
        setStock(row ?? { quantityOnHand: 0, averageCost: 0, inTransitQuantity: 0 });
      })
      .catch(() => !cancelled && setStock(null));
    return () => {
      cancelled = true;
    };
  }, [isEdit, form.siteId, form.fuelType]);

  const quantity = Number(form.quantity);
  const estimatedValue = isEdit ? existing?.amount : stock && quantity > 0 ? Math.round(quantity * stock.averageCost * 100) / 100 : null;
  const siteName = isEdit ? existing?.siteName : sites?.find((s) => String(s.id) === form.siteId)?.name;
  const noSiteAssigned = !picksSite && !user?.siteId;

  function update(field) {
    return (event) => {
      const value = event.target.value;
      setForm((f) => ({ ...f, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
    };
  }

  function validate() {
    const found = {};
    if (!isEdit) {
      if (!form.siteId) found.siteId = 'Select the site.';
      if (form.quantity === '') found.quantity = 'Enter the litres.';
      else if (!(quantity > 0)) found.quantity = 'Litres must be greater than 0.';
      else if (stock && quantity > stock.quantityOnHand) found.quantity = `Only ${formatLitres(stock.quantityOnHand)} in this site's stock.`;
    }
    if (!form.entryDate) found.entryDate = 'Enter the date.';
    else if (form.entryDate > todayDateOnly()) found.entryDate = 'The date cannot be in the future.';
    if (form.entryTime && form.entryDate === todayDateOnly() && form.entryTime > nowTimeOnly()) {
      found.entryTime = 'The time cannot be in the future.';
    }
    if (!form.vehicleNumber.trim()) found.vehicleNumber = 'Enter the vehicle number.';
    if (!form.category) found.category = 'Select a category.';
    if (!form.partyName.trim()) found.partyName = 'Enter the party or company name.';
    const mobile = form.driverMobile.trim();
    if (mobile) {
      const digits = mobile.replace(/\D/g, '').length;
      if (!MOBILE_PATTERN.test(mobile) || digits < 10 || digits > 15) found.driverMobile = 'Enter a valid mobile number (10 to 15 digits).';
    }
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      entryDate: form.entryDate,
      entryTime: form.entryTime || null,
      vehicleNumber: form.vehicleNumber.trim(),
      vehicleName: form.vehicleName.trim() || null,
      category: form.category,
      partyName: form.partyName.trim(),
      driverName: form.driverName.trim() || null,
      driverMobile: form.driverMobile.trim() || null,
      authorisedBy: form.authorisedBy.trim() || null,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        // These fields are no longer on the form; send back what an older entry already holds so an edit keeps it.
        await externalFuelApi.update(id, {
          ...payload,
          meterReading: existing.meterReading,
          referenceNumber: existing.referenceNumber,
          notes: existing.notes,
        });
      } else {
        await externalFuelApi.create({
          ...payload,
          siteId: picksSite ? Number(form.siteId) : undefined,
          fuelType: form.fuelType,
          quantity,
        });
      }
      navigate('/fuel/external', { state: { message: isEdit ? 'External fuel entry updated.' : 'External vehicle fuel recorded.' } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const backLink = (
    <BackLink to="/fuel/external" label="External vehicle fuel" />
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
        {backLink}
      </div>
    );
  }

  if (sites === null || (isEdit && !existing)) return <Spinner label="Loading" />;

  const showFigures = isEdit || (form.siteId && stock);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        {backLink}
        <h1 className="mt-1 text-xl font-semibold wrap-break-word text-steel-900">
          {isEdit ? `Edit external fuel entry ${existing.entryNumber}` : 'Record external vehicle fuel'}
        </h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>
          {noSiteAssigned && <Alert tone="warning">No site has been assigned to your account yet. Ask your Admin to assign one.</Alert>}
          {isEdit && (
            <p className="mb-3 text-xs text-steel-500">Site, fuel type and litres can't be changed. To correct them, delete the entry and enter it again.</p>
          )}

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Site" required error={errors.siteId}>
              {({ id: fieldId, invalid, describedBy }) =>
                picksSite && !isEdit ? (
                  <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.siteId} onChange={update('siteId')}>
                    <option value="">Select a site</option>
                    {sites.map((s) => (
                      <option key={s.id} value={String(s.id)} data-added={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id={fieldId} describedBy={describedBy} value={siteName ?? (form.siteId ? `Site ${form.siteId}` : '—')} disabled />
                )
              }
            </Field>

            <Field label="Fuel type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.fuelType} onChange={update('fuelType')} disabled={isEdit}>
                  {STORABLE_FUEL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Litres" required error={errors.quantity}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.quantity}
                  onChange={update('quantity')}
                  disabled={isEdit}
                />
              )}
            </Field>

            {showFigures && (
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 rounded border border-steel-200 bg-steel-50 px-3 py-2 text-sm sm:col-span-2 lg:col-span-3">
                {!isEdit && (
                  <>
                    <Figure
                      label={`In stock${siteName ? ` at ${siteName}` : ''}:`}
                      value={formatLitres(stock.quantityOnHand)}
                      tone={stock.quantityOnHand > 0 ? 'text-steel-900' : 'text-danger-600'}
                    />
                    <Figure label="Avg. cost / L:" value={stock.quantityOnHand > 0 ? formatCurrency(stock.averageCost) : '—'} />
                  </>
                )}
                <Figure label={isEdit ? 'Value:' : 'Estimated value:'} value={formatCurrency(estimatedValue)} />
              </div>
            )}

            <Field label="Vehicle number" required error={errors.vehicleNumber}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.vehicleNumber}
                  onChange={update('vehicleNumber')}
                  maxLength={32}
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="e.g. MH-12 AB-1234"
                  className="uppercase placeholder:normal-case"
                />
              )}
            </Field>

            <Field label="Vehicle name">
              {({ id: fieldId, describedBy }) => (
                <Input
                  id={fieldId}
                  describedBy={describedBy}
                  value={form.vehicleName}
                  onChange={update('vehicleName')}
                  maxLength={100}
                  placeholder="e.g. Tata Ace, Swift Dzire"
                />
              )}
            </Field>

            <Field label="Category" required error={errors.category}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select id={fieldId} invalid={invalid} describedBy={describedBy} value={form.category} onChange={update('category')}>
                  <option value="">Select a category</option>
                  {Object.entries(EXTERNAL_CATEGORY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Party / company name" required error={errors.partyName}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} value={form.partyName} onChange={update('partyName')} maxLength={150} />
              )}
            </Field>

            <Field label="Driver name">
              {({ id: fieldId, describedBy }) => (
                <Input id={fieldId} describedBy={describedBy} value={form.driverName} onChange={update('driverName')} maxLength={150} />
              )}
            </Field>

            <Field label="Driver mobile" error={errors.driverMobile}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="tel"
                  inputMode="tel"
                  value={form.driverMobile}
                  onChange={update('driverMobile')}
                  maxLength={32}
                />
              )}
            </Field>

            <Field label="Date" required error={errors.entryDate}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="date" max={todayDateOnly()} value={form.entryDate} onChange={update('entryDate')} />
              )}
            </Field>

            <Field label="Time" error={errors.entryTime}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input id={fieldId} invalid={invalid} describedBy={describedBy} type="time" value={form.entryTime} onChange={update('entryTime')} />
              )}
            </Field>

            <Field label="Authorised by">
              {({ id: fieldId, describedBy }) => (
                <Input id={fieldId} describedBy={describedBy} value={form.authorisedBy} onChange={update('authorisedBy')} maxLength={150} />
              )}
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-steel-200 pt-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={noSiteAssigned}>
              {isEdit ? 'Save changes' : 'Record fuel'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
