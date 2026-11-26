import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { vehiclesApi, sitesApi, complianceApi, listAll } from '../api/client';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui';
import ComplianceFields, { EMPTY_COMPLIANCE, getComplianceDateErrors } from '../components/ComplianceFields';
import AssetDocumentFields from '../components/AssetDocumentFields';
import { MAX_PHOTOS, PHOTO_ACCEPT, uploadPhotos } from '../components/AssetPhotosCard';
import { DOCUMENT_LABELS, getMissingMandatoryDocTypes } from '../config/assetDocuments';
import { VEHICLE_TYPE_OPTIONS, HOURS_BASED_VEHICLE_TYPE } from '../config/vehicleTypes';
import { FUEL_TYPE_OPTIONS } from '../config/fuelTypes';
import { complianceSlotsToFormValue } from '../config/compliance';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  registrationNumber: '',
  type: '',
  modelNumber: '',
  chassisNumber: '',
  year: '',
  fuelType: '',
  currentKM: '',
  serviceIntervalKM: '',
  currentHours: '',
  serviceIntervalHours: '',
  currentSiteId: '',
};

function toFormValues(vehicle) {
  return {
    registrationNumber: vehicle.registrationNumber,
    type: vehicle.type,
    modelNumber: vehicle.modelNumber ?? '',
    chassisNumber: vehicle.chassisNumber ?? '',
    year: vehicle.year ?? '',
    fuelType: vehicle.fuelType,
    currentKM: vehicle.currentKM ?? '',
    serviceIntervalKM: vehicle.serviceIntervalKM ?? '',
    currentHours: vehicle.currentHours ?? '',
    serviceIntervalHours: vehicle.serviceIntervalHours ?? '',
    currentSiteId: vehicle.currentSiteId ?? '',
  };
}

export default function VehicleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, isAdmin, canPickSite } = useAuth();

  // The Admin places an asset at any site; a Site Manager with several sites picks one of theirs.
  const canChooseSite = canPickSite;
  const lockedSiteId = user?.siteId ?? '';

  const [form, setForm] = useState(EMPTY_FORM);
  const isHeavy = form.type === HOURS_BASED_VEHICLE_TYPE;
  const [compliance, setCompliance] = useState(EMPTY_COMPLIANCE);
  const [siteOptions, setSiteOptions] = useState([]);
  const [archivedSite, setArchivedSite] = useState(null);
  const [documentFiles, setDocumentFiles] = useState({});
  const [showMissingDocs, setShowMissingDocs] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoProgress, setPhotoProgress] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    vehiclesApi
      .get(id)
      .then(async (response) => {
        setForm(toFormValues(response.data));
        // The site list holds active sites only, so a site archived since the vehicle arrived needs adding.
        if (response.data.currentSiteId) {
          sitesApi
            .get(response.data.currentSiteId)
            .then((site) => setArchivedSite(site.data.status === 'archived' ? site.data : null))
            .catch(() => {});
        }
        const complianceResponse = await complianceApi.list('VEHICLE', response.data.assetId);
        setCompliance(complianceSlotsToFormValue(complianceResponse.data));
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    listAll(sitesApi.list)
      .then((response) => setSiteOptions(response.data))
      .catch(() => {});
  }, []);

  function update(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const complianceErrors = getComplianceDateErrors(compliance);
    if (Object.values(complianceErrors).some(Boolean)) {
      return;
    }

    const blankMeter = (isHeavy
      ? [['currentHours', 'Current hours'], ['serviceIntervalHours', 'Service interval (hours)']]
      : [['currentKM', 'Current KM'], ['serviceIntervalKM', 'Service interval (KM)']]
    ).find(([field]) => String(form[field]).trim() === '');
    if (blankMeter) {
      setSubmitError(`${blankMeter[1]} is required.`);
      return;
    }

    if (!isEdit) {
      const missing = getMissingMandatoryDocTypes('VEHICLE', documentFiles);
      if (missing.length > 0) {
        setShowMissingDocs(true);
        const noun = missing.length > 1 ? 'documents are' : 'document is';
        setSubmitError(`${missing.map((docType) => DOCUMENT_LABELS[docType]).join(' and ')} ${noun} required.`);
        return;
      }
    }

    setSubmitting(true);

    const {
      currentKM,
      serviceIntervalKM,
      currentHours,
      serviceIntervalHours,
      currentSiteId,
      ...formWithoutMeters
    } = form;

    const payload = {
      ...formWithoutMeters,
      year: form.year === '' ? null : Number(form.year),
      currentSiteId: currentSiteId === '' ? null : Number(currentSiteId),
      compliance,
      ...(isHeavy
        ? {
            currentHours: Number(currentHours),
            serviceIntervalHours: Number(serviceIntervalHours),
          }
        : {
            currentKM: Number(currentKM),
            serviceIntervalKM: Number(serviceIntervalKM),
          }),
    };

    try {
      const response = isEdit
        ? await vehiclesApi.update(id, payload)
        : await vehiclesApi.create(payload, documentFiles);
      // The vehicle exists now, so a photo that fails is reported on its page rather than blocking here.
      const photoUploadErrors =
        !isEdit && photoFiles.length > 0
          ? await uploadPhotos('VEHICLE', response.data.assetId, photoFiles, (done, total) =>
              setPhotoProgress({ done, total })
            )
          : [];
      navigate(`/vehicles/${response.data.id}`, { state: photoUploadErrors.length ? { photoUploadErrors } : undefined });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading vehicle" />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-steel-900">
          {isEdit ? 'Edit vehicle' : 'Add vehicle'}
        </h1>
        <p className="mt-1 text-steel-500">
          {isEdit ? 'Update this vehicle’s details.' : 'Register a new vehicle.'}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <Alert tone="error">{submitError}</Alert>

          <h2 className="mb-3 text-sm font-semibold text-steel-900">Vehicle Details</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Registration number" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.registrationNumber}
                  onChange={update('registrationNumber')}
                  maxLength={32}
                  required
                />
              )}
            </Field>

            <Field label="Type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.type}
                  onChange={update('type')}
                  required
                >
                  <option value="">Select a type</option>
                  {VEHICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Fuel type" required>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.fuelType}
                  onChange={update('fuelType')}
                  required
                >
                  <option value="">Select a fuel type</option>
                  {FUEL_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Year">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.year}
                  onChange={update('year')}
                />
              )}
            </Field>

            <Field label="Model number">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.modelNumber}
                  onChange={update('modelNumber')}
                  maxLength={100}
                />
              )}
            </Field>

            <Field label="Chassis number">
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={form.chassisNumber}
                  onChange={update('chassisNumber')}
                  maxLength={100}
                />
              )}
            </Field>

            <Field label="Site">
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  describedBy={describedBy}
                  value={canChooseSite ? form.currentSiteId : lockedSiteId}
                  onChange={update('currentSiteId')}
                  disabled={!canChooseSite}
                >
                  <option value="">{isAdmin ? 'Unassigned' : 'Select one of your sites'}</option>
                  {archivedSite && (
                    <option value={archivedSite.id} data-added={archivedSite.id}>
                      {archivedSite.name} (archived)
                    </option>
                  )}
                  {siteOptions.map((site) => (
                    <option key={site.id} value={site.id} data-added={site.id}>
                      {site.name}
                      {site.location ? ` — ${site.location}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {isHeavy ? (
              <>
                <Field label="Current hours" required>
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      describedBy={describedBy}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.currentHours}
                      onChange={update('currentHours')}
                      required
                    />
                  )}
                </Field>

                <Field
                  label="Service interval (hours)"
                  required
                  hint={isEdit ? 'Changing this recalculates the next service target.' : undefined}
                >
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      describedBy={describedBy}
                      type="number"
                      min={1}
                      step="0.01"
                      value={form.serviceIntervalHours}
                      onChange={update('serviceIntervalHours')}
                      required
                    />
                  )}
                </Field>
              </>
            ) : (
              <>
                <Field label="Current KM" required>
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      describedBy={describedBy}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.currentKM}
                      onChange={update('currentKM')}
                      required
                    />
                  )}
                </Field>

                <Field
                  label="Service interval (KM)"
                  required
                  hint={isEdit ? 'Changing this recalculates the next service target.' : undefined}
                >
                  {({ id: fieldId, invalid, describedBy }) => (
                    <Input
                      id={fieldId}
                      invalid={invalid}
                      describedBy={describedBy}
                      type="number"
                      min={1}
                      step="0.01"
                      value={form.serviceIntervalKM}
                      onChange={update('serviceIntervalKM')}
                      required
                    />
                  )}
                </Field>
              </>
            )}
          </div>

          <ComplianceFields value={compliance} onChange={setCompliance} />

          {!isEdit && (
            <AssetDocumentFields
              assetType="VEHICLE"
              files={documentFiles}
              onChange={setDocumentFiles}
              showRequiredError={showMissingDocs}
            />
          )}

          {!isEdit && (
            <section className="mt-5 border-t border-steel-100 pt-4">
              <h2 className="text-sm font-semibold text-steel-900">Photos</h2>
              <p className="mt-0.5 text-sm text-steel-500">
                Optional — up to {MAX_PHOTOS}. The first becomes the cover. You can also add them later on the vehicle’s page.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded border border-steel-300 px-3 py-1.5 text-sm font-semibold text-steel-700 hover:bg-steel-50">
                  Choose photos
                  <input
                    type="file"
                    accept={PHOTO_ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      const chosen = [...(event.target.files ?? [])];
                      event.target.value = '';
                      setPhotoFiles((current) => [...current, ...chosen].slice(0, MAX_PHOTOS));
                    }}
                  />
                </label>
                <span className="text-sm text-steel-500">
                  {photoFiles.length} of {MAX_PHOTOS} chosen
                </span>
              </div>
              {photoFiles.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {photoFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-1.5 rounded border border-steel-200 px-2 py-1 text-xs text-steel-700"
                    >
                      {index === 0 && <span className="font-semibold text-brand-700">Cover ·</span>}
                      <span className="max-w-40 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        className="text-steel-400 hover:text-danger-600"
                        onClick={() => setPhotoFiles((current) => current.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {photoProgress
                ? `Uploading photo ${photoProgress.done} of ${photoProgress.total}…`
                : isEdit
                  ? 'Save changes'
                  : 'Create vehicle'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
