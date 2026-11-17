export { formatCurrency, formatDateOnly, formatNumber, todayDateOnly, assetPath } from './tyres';

// Plain words for the four states. The order is the order of the tabs.
export const BATTERY_STATUSES = [
  { value: 'ready', label: 'In Store', tone: 'success' },
  { value: 'fitted', label: 'Fitted', tone: 'brand' },
  { value: 'needs_repair', label: 'Under Repair', tone: 'warning' },
  { value: 'scrapped', label: 'Scrapped', tone: 'neutral' },
];

export const STATUS_BY_VALUE = Object.fromEntries(BATTERY_STATUSES.map((s) => [s.value, s]));

export const EVENT_LABELS = {
  purchased: 'Bought',
  fitted: 'Fitted',
  removed: 'Taken off',
  sent_for_repair: 'Sent for repair',
  repaired: 'Repaired',
  scrapped: 'Scrapped',
};

// What happens to a battery that comes off a vehicle.
export const OUTCOME_OPTIONS = [
  { value: 'needs_repair', label: 'Send for repair' },
  { value: 'ready', label: 'Still good, keep in store' },
  { value: 'scrapped', label: 'Scrap it' },
];

export const OUTCOME_LABELS = { ready: 'kept in store', needs_repair: 'sent for repair', scrapped: 'scrapped' };

export function batteryName(b) {
  if (!b) return '';
  return [b.brand, b.modelName, b.capacityAh ? `${b.capacityAh} Ah` : null].filter(Boolean).join(' ');
}

export function readingUnit(meterType) {
  return meterType === 'HOURS' ? 'hrs' : 'KM';
}

export function daysBetween(from, to) {
  if (!from || !to) return null;
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000));
}

export function formatDays(days) {
  if (days == null) return '—';
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'}`;
  return `${Math.floor(days / 30.44)} months`;
}
