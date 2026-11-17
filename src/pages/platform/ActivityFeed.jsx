import { Link } from 'react-router-dom';
import { Initials, formatDateTime, formatTime, groupByDay } from './tenantDisplay';

function actorTone(actor) {
  if (actor.type === 'platform') return 'platform';
  if (actor.type === 'system') return 'system';
  return actor.role === 'admin' ? 'admin' : 'supervisor';
}

function Sentence({ entry }) {
  return (
    <p className="text-sm text-steel-700">
      <span className="font-semibold text-steel-900">{entry.actor.name}</span> {entry.actionLabel.toLowerCase()}
      {entry.entityLabel && <span className="text-steel-500"> {entry.entityLabel.toLowerCase()}</span>}
      {entry.subject && <span className="font-medium text-steel-900"> {entry.subject}</span>}
    </p>
  );
}

// Audit entries grouped by day: who did what, to which record, and when. `showOrganization` names the organization.
export default function ActivityFeed({ entries, showOrganization = false, emptyMessage = 'No activity yet.' }) {
  if (entries.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-steel-500">{emptyMessage}</p>;
  }

  return (
    <div>
      {groupByDay(entries).map((group) => (
        <section key={group.label}>
          <h3 className="sticky top-16 z-10 border-y border-steel-100 bg-steel-50 px-5 py-1.5 text-xs font-semibold tracking-wide text-steel-500 uppercase">
            {group.label}
          </h3>
          <ul className="divide-y divide-steel-100">
            {group.entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                <Initials name={entry.actor.name} tone={actorTone(entry.actor)} />
                <div className="min-w-0 flex-1">
                  <Sentence entry={entry} />
                  <p className="mt-0.5 text-xs text-steel-500">
                    {showOrganization && (
                      <>
                        <Link to={`/platform/tenants/${entry.tenantId}`} className="font-semibold text-brand-600 hover:underline">
                          {entry.organizationName ?? entry.tenantId}
                        </Link>
                        {' · '}
                      </>
                    )}
                    {entry.actor.type === 'user' ? entry.actor.role : entry.actor.email}
                  </p>
                </div>
                <time
                  dateTime={entry.at}
                  title={formatDateTime(entry.at)}
                  className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-steel-500 tabular-nums"
                >
                  {formatTime(entry.at)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
