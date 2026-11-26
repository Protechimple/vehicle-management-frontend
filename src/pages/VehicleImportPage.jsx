import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { vehiclesApi } from '../api/client';
import { Alert, Badge, Button, Card, Spinner } from '../components/ui';

function meterText(values) {
  if (values.currentHours != null) return `${values.currentHours} hrs`;
  if (values.currentKM != null) return `${values.currentKM} KM`;
  return '—';
}

function Step({ number, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-steel-900">{title}</h2>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function PreviewTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded border border-steel-200">
      <table className="min-w-full text-sm">
        <thead className="bg-steel-50 text-left text-xs font-semibold tracking-wide text-steel-500 uppercase">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Registration</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Fuel</th>
            <th className="px-3 py-2">Site</th>
            <th className="px-3 py-2">Meter</th>
            <th className="px-3 py-2">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-steel-100">
          {rows.map((row) => {
            const invalid = row.errors.length > 0;
            return (
              <tr key={row.rowNumber} className={invalid ? 'bg-danger-50/60 align-top' : 'align-top'}>
                <td className="px-3 py-2 text-steel-500 tabular-nums">{row.rowNumber}</td>
                <td className="px-3 py-2 font-medium text-steel-900">{row.values.registrationNumber ?? '—'}</td>
                <td className="px-3 py-2">{row.values.type ?? '—'}</td>
                <td className="px-3 py-2">{row.values.fuelType ?? '—'}</td>
                <td className="px-3 py-2">{row.values.site ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">{meterText(row.values)}</td>
                <td className="px-3 py-2">
                  {invalid ? (
                    <ul className="list-disc space-y-0.5 pl-4 text-danger-600">
                      {row.errors.map((error, index) => (
                        <li key={`${error.field}-${index}`}>{error.message}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="font-semibold text-success-600">✓ Ready</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function VehicleImportPage() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [errorsOnly, setErrorsOnly] = useState(false);

  async function downloadTemplate() {
    setDownloading(true);
    setError(null);
    try {
      await vehiclesApi.downloadImportTemplate();
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function check(chosen) {
    setFile(chosen);
    setPreview(null);
    setResult(null);
    setError(null);
    setErrorsOnly(false);
    setChecking(true);
    try {
      const response = await vehiclesApi.importPreview(chosen);
      setPreview(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const response = await vehiclesApi.importCommit(file);
      setResult(response.data);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err.message);
      // The sheet may have changed meaning since the preview (e.g. someone else added a registration): show the new check.
      if (err.data?.rows) setPreview(err.data);
    } finally {
      setImporting(false);
    }
  }

  const invalid = preview?.summary.invalid ?? 0;
  const shownRows = preview ? (errorsOnly ? preview.rows.filter((row) => row.errors.length > 0) : preview.rows) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <Link to="/vehicles" className="text-sm font-semibold text-brand-600 hover:underline">
          ← All vehicles
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-steel-900">Import vehicles from Excel</h1>
        <p className="mt-1 text-steel-500">
          Add many vehicles at once. Nothing is saved until every row is valid. Documents and photos are added on each
          vehicle’s page afterwards.
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {result && (
        <Alert tone="success">
          {result.created} vehicle{result.created === 1 ? '' : 's'} imported.{' '}
          <Link to="/vehicles?docsMissing=true" className="font-semibold underline">
            Go to vehicles
          </Link>{' '}
          to upload their RC and photos.
        </Alert>
      )}

      <Card>
        <div className="space-y-5">
          <Step number={1} title="Download the template">
            <p className="mb-2 text-sm text-steel-500">
              It lists every vehicle field, with dropdowns for Type, Fuel type and Site. Required columns are marked * and
              the Instructions sheet explains each one.
            </p>
            <Button variant="secondary" size="sm" loading={downloading} onClick={downloadTemplate}>
              Download template (.xlsx)
            </Button>
          </Step>

          <Step number={2} title="Upload the filled sheet">
            <p className="mb-2 text-sm text-steel-500">.xlsx or .csv, up to 500 vehicles. Columns may be in any order.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" loading={checking} onClick={() => inputRef.current?.click()}>
                {file ? 'Choose another file' : 'Choose file'}
              </Button>
              {file && <span className="truncate text-sm text-steel-600">{file.name}</span>}
              {file && !checking && (
                <Button variant="secondary" size="sm" onClick={() => check(file)}>
                  Check again
                </Button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = '';
                  if (chosen) check(chosen);
                }}
              />
            </div>
            {file && <p className="mt-1 text-xs text-steel-400">Fixed the file in Excel? Choose it again to re-check.</p>}
          </Step>

          <Step number={3} title="Review and import">
            {checking && <Spinner label="Checking the sheet" />}
            {!checking && !preview && <p className="text-sm text-steel-500">Upload a sheet to see a preview here.</p>}
            {preview && (
              <div className="space-y-3">
                {preview.warnings.length > 0 && (
                  <Alert tone="warning">
                    <ul className="list-disc pl-4">
                      {preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <Badge tone="neutral">{preview.summary.total} rows</Badge>
                    <Badge tone="success">{preview.summary.valid} valid</Badge>
                    {invalid > 0 && <Badge tone="danger">{invalid} with errors</Badge>}
                  </div>
                  {invalid > 0 && (
                    <label className="flex items-center gap-1.5 text-sm text-steel-600">
                      <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
                      Show only rows with errors
                    </label>
                  )}
                </div>

                <PreviewTable rows={shownRows} />

                <div className="flex flex-col items-end gap-1">
                  <Button disabled={invalid > 0} loading={importing} onClick={handleImport}>
                    Import {preview.summary.total} vehicle{preview.summary.total === 1 ? '' : 's'}
                  </Button>
                  {invalid > 0 && (
                    <p className="text-sm text-steel-500">Fix the highlighted rows in your file and upload it again.</p>
                  )}
                </div>
              </div>
            )}
          </Step>
        </div>
      </Card>
    </div>
  );
}
