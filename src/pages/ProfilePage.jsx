import { useEffect, useState } from 'react';
import { usersApi } from '../api/client';
import { Alert, Badge, Button, Card, RoleBadge, Spinner } from '../components/ui';
import { OwnPasswordForm, OwnProfileForm } from '../components/profile/AccountForms';
import { roleLabel } from '../config/permissions';
import { useAuth } from '../context/AuthContext';
import useSiteNames from '../hooks/useSiteNames';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function initialsOf(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function Detail({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="w-44 shrink-0 text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="min-w-0 text-sm text-steel-900">{children}</dd>
    </div>
  );
}

// The signed-in person's own account. The Admin can change their details and password here; everyone else sees what
// their Admin has set up for them.
export default function ProfilePage() {
  const { user, organization, isAdmin, siteIds } = useAuth();
  const siteNames = useSiteNames();
  const [account, setAccount] = useState(null);
  const [mode, setMode] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  // The Admin's full record (last sign-in, status) comes from the user list; other roles cannot read it.
  useEffect(() => {
    if (!isAdmin) return;
    usersApi
      .list()
      .then((response) => setAccount(response.data.find((a) => a.id === user?.id) ?? null))
      .catch((err) => setError(err.message));
  }, [isAdmin, user?.id, notice]);

  const shown = { ...user, ...(account ?? {}) };

  function saved(message) {
    setMode(null);
    setNotice(message);
  }

  if (isAdmin && !account && !error) return <Spinner label="Loading your profile" />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-steel-900">My profile</h1>
        <p className="mt-1 text-steel-500">Your account details and sign-in.</p>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      <Alert tone="error">{error}</Alert>

      <section className="flex flex-wrap items-center gap-4 rounded border border-steel-200 bg-surface px-5 py-5">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white"
        >
          {initialsOf(shown.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-steel-900">{shown.name}</p>
          <p className="truncate text-sm text-steel-500">{shown.email}</p>
        </div>
        <RoleBadge role={shown.role} />
      </section>

      {mode === 'profile' ? (
        <Card title="Edit profile" subtitle="Your name, email and organization name">
          <OwnProfileForm account={shown} organizationName={organization?.organizationName} onCancel={() => setMode(null)} onSaved={saved} />
        </Card>
      ) : mode === 'password' ? (
        <Card title="Change password" subtitle="You will stay signed in here and be signed out everywhere else">
          <OwnPasswordForm onCancel={() => setMode(null)} onSaved={saved} />
        </Card>
      ) : (
        <Card
          title="Account"
          actions={
            isAdmin && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setMode('profile')}>
                  Edit profile
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMode('password')}>
                  Change password
                </Button>
              </>
            )
          }
        >
          <dl className="-my-3 divide-y divide-steel-100">
            <Detail label="Name">{shown.name}</Detail>
            <Detail label="Email">
              <span className="break-all">{shown.email}</span>
            </Detail>
            <Detail label="Role">{roleLabel(shown.role)}</Detail>
            <Detail label="Organization">{organization?.organizationName ?? '—'}</Detail>
            {isAdmin ? (
              <>
                <Detail label="Status">
                  <Badge tone={shown.status === 'inactive' ? 'neutral' : 'success'}>{shown.status ?? 'active'}</Badge>
                </Detail>
                <Detail label="Last sign-in">{formatDate(shown.lastLoginAt)}</Detail>
                <Detail label="Sites">All sites in the organization</Detail>
              </>
            ) : (
              <Detail label={siteIds?.length > 1 ? 'Your sites' : 'Your site'}>
                {siteIds?.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {siteIds.map((id) => (
                      <span key={id} className="rounded bg-steel-100 px-2 py-0.5 text-steel-700">
                        {siteNames[id] ?? `Site #${id}`}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-danger-600">No site assigned yet — ask your Admin.</span>
                )}
              </Detail>
            )}
          </dl>
        </Card>
      )}

      <p className="text-xs text-steel-500">
        {isAdmin
          ? 'This is the primary account for your organization. It cannot be deactivated — that would lock the organization out of its own management.'
          : 'To change your name, email, sites or password, ask your Admin.'}
      </p>
    </div>
  );
}
