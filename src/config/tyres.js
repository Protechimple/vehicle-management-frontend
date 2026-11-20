const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

// The order is the order of the tabs on the Tyre Stores page.
export const TYRE_STATUSES = [
  { value: 'new', label: 'New Tyre Store', short: 'New Store', tone: 'success' },
  { value: 'spare', label: 'Spare Tyre Store', short: 'Spare Store', tone: 'brand' },
  { value: 'fitted', label: 'Fitted', short: 'Fitted', tone: 'brand' },
  { value: 'remould', label: 'At Remould', short: 'At Remould', tone: 'warning' },
  { value: 'scrapped', label: 'Scrapped', short: 'Scrapped', tone: 'neutral' },
];

export const STATUS_BY_VALUE = Object.fromEntries(TYRE_STATUSES.map((s) => [s.value, s]));

export const EVENT_LABELS = {
  purchased: 'Bought',
  added_spare: 'Added as spare',
  fitted: 'Fitted',
  removed: 'Taken off',
  puncture: 'Puncture',
  remould_sent: 'Sent for remould',
  remould_back: 'Back from remould',
  scrapped: 'Scrapped',
  transferred: 'Moved to another site',
};

// What happens to a tyre that comes off a vehicle or machine.
export const OUTCOME_OPTIONS = [
  { value: 'spare', label: 'Still good — keep in Spare Tyre Store' },
  { value: 'remould', label: 'Send for remoulding / renewal' },
  { value: 'scrapped', label: 'Scrap it' },
];

// Tyres per axle that can be chosen for an axle layout.
export const AXLE_OPTIONS = [
  { value: 2, label: '2 tyres (single)' },
  { value: 4, label: '4 tyres (dual)' },
  { value: 1, label: '1 tyre (centre)' },
];

export function readingLabel(meterType) {
  return meterType === 'HOURS' ? 'Hours reading' : 'KM reading';
}

export function tyreLabel(t) {
  if (!t) return '';
  return [t.tyreCode, [t.tyreTypeLabel, t.tyreSize].filter(Boolean).join(' '), t.serialNumber ? `SN ${t.serialNumber}` : null].filter(Boolean).join(' · ');
}

export function formatRunTotals(t) {
  const parts = [];
  if (t.runKm) parts.push(`${formatNumber(t.runKm)} KM`);
  if (t.runHours) parts.push(`${formatNumber(t.runHours)} hrs`);
  return parts.length ? parts.join(' + ') : '—';
}

function isBlank(value) {
  return value === null || value === undefined || value === '' || !Number.isFinite(Number(value));
}

export function formatCurrency(value) {
  if (isBlank(value)) return '—';
  return currencyFormatter.format(Number(value));
}

export function formatNumber(value, maximumFractionDigits = 2) {
  if (isBlank(value)) return '—';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits });
}

export function meterUnit(meterType) {
  return meterType === 'HOURS' ? 'hrs' : 'KM';
}

export function formatRun(value, meterType) {
  return `${formatNumber(value ?? 0)} ${meterUnit(meterType)}`;
}

export function todayDateOnly() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Tyre entries have a date and a time. Forms use one "Date & time" picker; the API takes date + time (HH:MM).
const pad2 = (n) => String(n).padStart(2, '0');

export function nowDateTimeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function splitDateTime(value) {
  const [date = '', time = ''] = String(value ?? '').split('T');
  return { date, time: time.slice(0, 5) };
}

export function checkDateTime(value) {
  if (!value || !value.includes('T')) return 'Choose the date and time.';
  return value > nowDateTimeLocal() ? "Date and time can't be in the future." : null;
}

export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// "19 Nov 2026, 11:45 am" — just the date for older entries saved without a time.
export function formatWhen(date, time) {
  if (!date) return '—';
  return time ? `${formatDateOnly(date)}, ${formatTime(time)}` : formatDateOnly(date);
}

// A saved timestamp (e.g. when axles were set).
export function formatStamp(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export function formatDateOnly(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function tyreTypeName(type) {
  if (!type) return '';
  return `${type.label ?? [type.brand, type.pattern].filter(Boolean).join(' ')} · ${type.size}`;
}

// The Vehicle Tyres page for an asset.
export function assetTyresPath(assetType, assetId) {
  return `/tyres/assets?assetType=${assetType}&assetId=${encodeURIComponent(assetId)}`;
}

export function assetPath(row) {
  if (!row.assetRecordId) return null;
  return row.assetType === 'VEHICLE' ? `/vehicles/${row.assetRecordId}` : `/machinery/${row.assetRecordId}`;
}
