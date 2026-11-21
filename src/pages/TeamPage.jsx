import { useEffect, useMemo, useState } from 'react';
import { usersApi } from '../api/client';
import { Alert, Badge, Card, RoleBadge, Select, Spinner, Table } from '../components/ui';
import { MEMBER_ROLES, roleLabel } from '../config/permissions';
import { useAuth } from '../context/AuthContext';
import useSiteNames from '../hooks/useSiteNames';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// The people who report to this Site Manager, directly or through another Site Manager. Read-only: the Admin manages
// their logins.
export default function TeamPage() {
  const { user } = useAuth();
  const siteNames = useSiteNames();
  const [team, setTeam] = useState(null);
  const [error, setError] = useState(null);
  const [siteFilter, setSiteFilter] = useState('');

  useEffect(() => {
    usersApi
      .team()
      .then((response) => setTeam(response.data))
      .catch((err) => setError(err.message));
  }, []);

  const names = useMemo(() => Object.fromEntries((team ?? []).map((m) => [m.id, m.name])), [team]);
  const rows = (team ?? []).filter((m) => !siteFilter || m.siteIds.map(String).includes(siteFilter));
  const counts = MEMBER_ROLES.map((role) => ({ role, count: (team ?? []).filter((m) => m.role === role && m.status === 'active').length }));

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (m) => (
        <div>
          <div className="font-medium text-steel-900">{m.name}</div>
          <div className="text-xs text-steel-500">{m.email}</div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (m) => <RoleBadge role={m.role} /> },
    { key: 'sites', label: 'Site', wrap: true, render: (m) => m.siteIds.map((id) => siteNames[id] ?? `Site #${id}`).join(', ') || '—' },
    { key: 'manager', label: 'Reports to', render: (m) => (m.managerId === user?.id ? 'You' : (names[m.managerId] ?? '—')) },
    {
      key: 'status',
      label: 'Status',
      render: (m) => <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>{m.status}</Badge>,
    },
    { key: 'lastLoginAt', label: 'Last sign-in', render: (m) => formatDate(m.lastLoginAt) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">My team</h1>
          <p className="mt-1 text-steel-500">Everyone who reports to you. Ask your Admin to add, move or deactivate someone.</p>
        </div>
        <div className="w-full sm:w-56">
          <Select aria-label="Filter by site" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">All my sites</option>
            {(user?.siteIds ?? []).map((id) => (
              <option key={id} value={id}>
                {siteNames[id] ?? `Site #${id}`}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Alert tone="error">{error}</Alert>
      {!team && !error && <Spinner label="Loading team" />}

      {team && (
        <>
          <section aria-label="Team size" className="mb-3 grid grid-cols-3 gap-px overflow-hidden rounded border border-steel-200 bg-steel-200">
            {counts.map(({ role, count }) => (
              <div key={role} className="bg-surface px-4 py-3">
                <div className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{roleLabel(role)}s</div>
                <div className="mt-1 text-2xl font-semibold text-steel-900">{count}</div>
              </div>
            ))}
          </section>
          <Card>
            <Table columns={columns} rows={rows} getRowKey={(m) => m.id} emptyMessage="No one reports to you yet." />
          </Card>
        </>
      )}
    </div>
  );
}
