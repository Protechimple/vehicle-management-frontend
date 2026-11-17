import { Badge } from '../../components/ui';

const STATUS_TONES = { active: 'success', suspended: 'danger', inactive: 'neutral' };

export function TenantStatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

const INITIALS_TONES = {
  organization: 'bg-brand-100 text-brand-700',
  admin: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  supervisor: 'bg-steel-100 text-steel-700',
  platform: 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-300/30',
  system: 'bg-steel-100 text-steel-500',
};

const INITIALS_SIZES = { sm: 'size-8 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' };

export function initialsOf(name) {
  const words = String(name ?? '?').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function Initials({ name, tone = 'organization', size = 'sm' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${INITIALS_SIZES[size]} ${INITIALS_TONES[tone]}`}
    >
      {initialsOf(name)}
    </span>
  );
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-steel-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-steel-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatTile({ label, value, detail, icon }) {
  return (
    <div className="flex items-start gap-3 rounded border border-steel-200 bg-surface px-4 py-4">
      {icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-600">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-steel-900 tabular-nums">{value}</p>
        {detail && <p className="mt-0.5 text-xs text-steel-500">{detail}</p>}
      </div>
    </div>
  );
}

// One row of small numbers inside a card, separated by thin rules.
export function MetricStrip({ items }) {
  return (
    <dl className="grid grid-cols-2 divide-steel-100 sm:grid-cols-4 sm:divide-x">
      {items.map((item) => (
        <div key={item.label} className="px-1 py-2 sm:px-4 sm:first:pl-0">
          <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{item.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold text-steel-900 tabular-nums">{item.value}</dd>
          {item.detail && <p className="text-xs text-steel-500">{item.detail}</p>}
        </div>
      ))}
    </dl>
  );
}

export const STAT_ICONS = {
  organizations: 'M3 17V6l5-2v13M8 17V8l9 3v6M3 17h14M11 12.5h1.5M11 15h1.5M5 8h1M5 11h1M5 14h1',
  users: 'M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 16c.5-2.6 2.5-4 5-4s4.5 1.4 5 4M13 4.2a2.5 2.5 0 0 1 0 4.6M14.5 12.3c1.6.5 2.7 1.7 3 3.7',
  vehicles: 'M2.5 13V7.5h9V13M11.5 9.5h3l2.5 2.5V13M2.5 13h15M5.5 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM14 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  machinery: 'M3 14h9v-3H3v3ZM5 11V8h4l1 3M12 12l3-6 2 1-1.5 5M3.5 16.5h8',
};

const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const dayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' });

export function formatDateTime(value) {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

export function formatDate(value) {
  return value ? dateFormat.format(new Date(value)) : '—';
}

export function formatTime(value) {
  return value ? timeFormat.format(new Date(value)) : '';
}

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const RELATIVE_STEPS = [
  { unit: 'minute', seconds: 60 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'day', seconds: 86400 },
];

// "5 minutes ago", "yesterday"; older than a week falls back to the date.
export function formatRelative(value) {
  if (!value) return 'Never';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return 'just now';
  if (Math.abs(seconds) >= 7 * 86400) return formatDate(value);
  const step = [...RELATIVE_STEPS].reverse().find((s) => Math.abs(seconds) >= s.seconds);
  return relativeFormat.format(Math.round(seconds / step.seconds), step.unit);
}

// "2 hours ago · 16 Nov 2026, 3:10 pm", or just the date and time once the relative form is a date itself.
export function formatWhen(value) {
  if (!value) return 'Never';
  const relative = formatRelative(value);
  return relative === formatDate(value) ? formatDateTime(value) : `${relative} · ${formatDateTime(value)}`;
}

function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function dayLabel(value) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(value)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return dayFormat.format(new Date(value));
}

// Splits time-ordered entries into [{ label: 'Today', entries }, …].
export function groupByDay(entries, getTime = (entry) => entry.at) {
  const groups = [];
  for (const entry of entries) {
    const label = dayLabel(getTime(entry));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

const PASSWORD_SOURCES = {
  admin: 'Changed by the admin',
  reset_link: 'Reset by the admin (email link)',
  super_admin: 'Set by Super Admin',
};

// Whether an organization admin is still on a temporary password, or changed it themselves — and when.
export function PasswordStatus({ admin, compact = false }) {
  const change = admin.lastPasswordChange;

  if (admin.mustChangePassword) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Badge tone="warning">Temporary</Badge>
        {!compact && (
          <span className="text-xs text-steel-500">
            {change ? `Set by Super Admin ${formatRelative(change.at)} · ` : ''}not changed yet
          </span>
        )}
      </span>
    );
  }

  if (!change) return <span className="text-steel-500">{compact ? '—' : 'Set by the admin'}</span>;

  return (
    <span className="inline-flex flex-col items-start gap-0.5" title={formatDateTime(change.at)}>
      <Badge tone="success">{compact ? 'Changed' : PASSWORD_SOURCES[change.by]}</Badge>
      <span className="text-xs text-steel-500">
        {compact ? formatRelative(change.at) : formatWhen(change.at)}
      </span>
    </span>
  );
}
