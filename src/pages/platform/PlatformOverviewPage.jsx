import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApi } from '../../api/platformClient';
import { Alert, Button, Card, Spinner, Table } from '../../components/ui';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import {
  Initials,
  MetricStrip,
  PageHeader,
  STAT_ICONS,
  StatTile,
  TenantStatusBadge,
  formatDate,
  formatDateTime,
  formatRelative,
} from './tenantDisplay';

const flushBody = '[&>div:last-child]:p-0';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function OrganizationsActivity({ rows, days }) {
  const columns = [
    {
      key: 'organizationName',
      label: 'Organization',
      render: (org) => (
        <Link to={`/platform/tenants/${org.tenantId}`} className="group flex items-center gap-3">
          <Initials name={org.organizationName} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-steel-900 group-hover:text-brand-600 group-hover:underline">
              {org.organizationName}
            </span>
            {org.status !== 'active' && <TenantStatusBadge status={org.status} />}
          </span>
        </Link>
      ),
    },
    { key: 'users', label: 'Users', align: 'right', render: (org) => org.users },
    {
      key: 'fleet',
      label: 'Fleet',
      align: 'right',
      render: (org) => (
        <span title={`${org.vehicles} vehicles · ${org.machinery} machines`}>{org.vehicles + org.machinery}</span>
      ),
    },
    { key: 'signIns', label: `Sign-ins · ${days}d`, align: 'right', render: (org) => org.signIns },
    { key: 'changes', label: `Changes · ${days}d`, align: 'right', render: (org) => org.changes },
    {
      key: 'lastActivity',
      label: 'Last activity',
      render: (org) => (
        <span title={formatDateTime(org.lastActivityAt)} className={org.lastActivityAt ? '' : 'text-warning-600'}>
          {formatRelative(org.lastActivityAt)}
        </span>
      ),
    },
  ];

  return <Table columns={columns} rows={rows} getRowKey={(org) => org.tenantId} emptyMessage="No organizations yet." />;
}

export default function PlatformOverviewPage() {
  const { user } = usePlatformAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .overview()
      .then(({ data }) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!overview) return <Spinner label="Loading overview" />;

  const { totals, lastWeek, organizationsActivity, quietOrganizations } = overview;
  const { organizations } = totals;
  const firstName = user?.name?.split(' ')[0];

  return (
    <div>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : 'Overview'}
        description="Everything happening across the organizations on VMMS."
        actions={
          <Button as={Link} to="/platform/tenants/new">
            + Create organization
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={STAT_ICONS.organizations}
          label="Organizations"
          value={organizations.total}
          detail={`${organizations.active} active${organizations.suspended ? ` · ${organizations.suspended} suspended` : ''}`}
        />
        <StatTile icon={STAT_ICONS.users} label="Active users" value={totals.users} detail="Admins and supervisors" />
        <StatTile icon={STAT_ICONS.vehicles} label="Vehicles" value={totals.vehicles} detail="Across all organizations" />
        <StatTile icon={STAT_ICONS.machinery} label="Machinery" value={totals.machinery} detail="Across all organizations" />
      </div>

      <div className="grid gap-5">
        <Card
          title="Organizations"
          subtitle={`Each organization's own numbers · most recently active first`}
          actions={
            <Link to="/platform/tenants" className="text-sm font-semibold text-brand-600 hover:underline">
              View all →
            </Link>
          }
          className={`min-w-0 ${flushBody}`}
        >
          <OrganizationsActivity rows={organizationsActivity} days={lastWeek.days} />
          {organizationsActivity.length > 0 && (
            <Link
              to="/platform/activity"
              className="block border-t border-steel-200 px-5 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-steel-50"
            >
              See the full activity log
            </Link>
          )}
        </Card>

        <div className="grid items-start gap-5 md:grid-cols-2">
          <Card title={`Last ${lastWeek.days} days`}>
            <MetricStrip
              items={[
                { label: 'Sign-ins', value: lastWeek.signIns },
                { label: 'Changes', value: lastWeek.changes },
              ]}
            />
            <div className="mt-3 border-t border-steel-100 pt-3">
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-steel-600">Organizations in use</span>
                <span className="font-semibold text-steel-900 tabular-nums">
                  {lastWeek.activeOrganizations} / {organizations.active}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-steel-100"
                role="meter"
                aria-label="Organizations in use"
                aria-valuemin={0}
                aria-valuemax={organizations.active}
                aria-valuenow={lastWeek.activeOrganizations}
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${organizations.active ? Math.min(100, (lastWeek.activeOrganizations / organizations.active) * 100) : 0}%` }}
                />
              </div>
            </div>
          </Card>

          <Card
            title="Needs attention"
            subtitle={`No activity in the last ${quietOrganizations.days} days`}
            className={flushBody}
          >
            {quietOrganizations.rows.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-4 text-sm text-success-600">
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                </svg>
                Every active organization is in use.
              </div>
            ) : (
              <ul className="divide-y divide-steel-100">
                {quietOrganizations.rows.map((org) => (
                  <li key={org.tenantId}>
                    <Link
                      to={`/platform/tenants/${org.tenantId}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-steel-50"
                    >
                      <Initials name={org.organizationName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-steel-900">{org.organizationName}</p>
                        <p className="text-xs text-warning-600">
                          {org.lastActivityAt
                            ? `Last active ${formatRelative(org.lastActivityAt)}`
                            : `Never used · created ${formatDate(org.createdAt)}`}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
