import { useEffect, useState } from 'react';
import { centringApi } from '../../api/client';
import { Badge } from '../ui';
import { formatDateOnly, formatNumber } from '../../config/fuel';

export const ADJUSTMENT_REASONS = ['Lost', 'Damaged', 'Scrapped', 'Stock count'];

// The four ways stock moves, as Inventory's Purchase, Issue, Transfer and Adjustment. Everything happens at a site.
export const ENTRY_TYPES = {
  purchase: { label: 'Purchase', button: '+ Purchase', title: 'New purchase', action: 'PURCHASE', tone: 'success', submit: 'Save purchase' },
  issue: { label: 'Issue', button: '+ Issue', title: 'New issue', action: 'ISSUE', tone: 'brand', submit: 'Save issue' },
  transfer: { label: 'Transfer', button: '+ Transfer', title: 'New transfer', action: 'TRANSFER', tone: 'warning', submit: 'Save transfer' },
  adjustment: { label: 'Adjustment', button: '+ Adjustment', title: 'New adjustment', action: 'ADJUST', tone: 'danger', submit: 'Save adjustment' },
};

export function EntryTypeBadge({ type }) {
  return <Badge tone={ENTRY_TYPES[type]?.tone ?? 'neutral'}>{ENTRY_TYPES[type]?.label ?? type}</Badge>;
}

export function formatQuantity(value, unit) {
  return `${formatNumber(value, 3)}${unit ? ` ${unit}` : ''}`;
}

// The time an entry was recorded in the system.
export function entryTime(entry) {
  return entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString(undefined, { timeStyle: 'short' }) : null;
}

// When an entry happened: its date, with the time it was recorded.
export function entryDateTime(entry) {
  const time = entryTime(entry);
  return time ? `${formatDateOnly(entry.entryDate)}, ${time}` : formatDateOnly(entry.entryDate);
}

// The same, on two lines, for a narrow table column.
export function EntryDateCell({ entry, by }) {
  const time = entryTime(entry);
  return (
    <div className="flex flex-col whitespace-nowrap">
      <span>{formatDateOnly(entry.entryDate)}</span>
      <span className="text-xs text-steel-500">{[time, by && `by ${by}`].filter(Boolean).join(' · ')}</span>
    </div>
  );
}

export function itemPath(item) {
  return [item.categoryName, item.subCategoryName].filter(Boolean).join(' › ');
}

// Where an entry happened, in words.
export function entryPlace(entry) {
  if (entry.entryType === 'transfer') return `${entry.fromSiteName} → ${entry.siteName}`;
  return entry.siteName;
}

// What an entry was for, in words.
export function entryDetail(entry) {
  if (entry.entryType === 'purchase') return [entry.supplierName, entry.billNumber && `Bill ${entry.billNumber}`].filter(Boolean).join(' · ');
  if (entry.entryType === 'issue') return entry.purpose;
  if (entry.entryType === 'adjustment') return entry.reason;
  return null;
}

// The sites to pick from: `own` are the user's sites (where they record entries), `all` every active site (where a
// transfer may go, for those who may transfer).
export function useCentringSites() {
  const [sites, setSites] = useState(null);
  useEffect(() => {
    let cancelled = false;
    centringApi
      .sites()
      .then((r) => !cancelled && setSites(r.data))
      .catch(() => !cancelled && setSites({ own: [], all: [] }));
    return () => {
      cancelled = true;
    };
  }, []);
  return sites;
}
