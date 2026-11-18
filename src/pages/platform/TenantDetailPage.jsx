import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { platformApi } from '../../api/platformClient';
import { Alert, Button, Card, Modal, Pagination, Spinner, Tabs } from '../../components/ui';
import ActivityFeed from './ActivityFeed';
import TemporaryPasswordField, { MIN_PASSWORD_LENGTH } from './TemporaryPasswordField';
import {
  Initials,
  PasswordStatus,
  TenantStatusBadge,
  formatDate,
  formatRelative,
  formatWhen,
} from './tenantDisplay';

const flushBody = '[&>div:last-child]:p-0';

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-steel-900">{children || '—'}</dd>
    </div>
  );
}

function StatusModal({ tenant, open, onClose, onSaved }) {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const suspending = tenant.status === 'active';

  async function handleConfirm() {
    setError(null);
    setSaving(true);
    try {
      const response = await platformApi.setTenantStatus(tenant.tenantId, suspending ? 'suspended' : 'active');
      onSaved(response.data, response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={suspending ? `Suspend ${tenant.organizationName}?` : `Activate ${tenant.organizationName}?`}
      description={
        suspending
          ? 'Every user of this organization is signed out right away and cannot sign in until it is activated again. Their data is kept.'
          : 'Users of this organization will be able to sign in again.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={suspending ? 'danger' : 'primary'} loading={saving} onClick={handleConfirm}>
            {suspending ? 'Suspend' : 'Activate'}
          </Button>
        </>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
    </Modal>
  );
}

function ResetPasswordModal({ tenant, open, onClose, onSaved }) {
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const response = await platformApi.resetAdminPassword(tenant.tenantId, password);
      setPassword('');
      onSaved(response.data, response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset admin password"
      description={`${tenant.admin?.name} (${tenant.admin?.email}) is signed out everywhere and must change this password at next sign-in.`}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Alert tone="error">{error}</Alert>
        <TemporaryPasswordField label="New temporary password" value={password} error={fieldError} onChange={setPassword} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const ACTIVITY_PAGE_SIZE = 20;
const ACTIVITY_TABS = [
  { value: '', label: 'All' },
  { value: 'signins', label: 'Sign-ins' },
  { value: 'changes', label: 'Changes' },
  { value: 'platform', label: 'Super Admin' },
];

function ActivityLog({ tenantId }) {
  const [filters, setFilters] = useState({ category: '', page: 1 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (current) => {
      setError(null);
      try {
        setResult(await platformApi.tenantActivity(tenantId, { ...current, limit: ACTIVITY_PAGE_SIZE }));
      } catch (err) {
        setError(err.message);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  return (
    <Card title="Activity log" subtitle="Who did what in this organization" className={flushBody}>
      <div className="px-5 pt-3">
        <Tabs tabs={ACTIVITY_TABS} active={filters.category} onChange={(category) => setFilters({ category, page: 1 })} />
        <Alert tone="error">{error}</Alert>
      </div>
      {!result ? (
        <Spinner label="Loading activity" />
      ) : (
        <>
          <ActivityFeed entries={result.data} emptyMessage="Nothing recorded yet." />
          {result.pagination.total > 0 && (
            <Pagination
              page={result.pagination.page}
              pages={result.pagination.pages}
              total={result.pagination.total}
              pageSize={ACTIVITY_PAGE_SIZE}
              showPageNumbers
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          )}
        </>
      )}
    </Card>
  );
}

export default function TenantDetailPage() {
  const { tenantId } = useParams();
  const location = useLocation();

  const [tenant, setTenant] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    platformApi
      .getTenant(tenantId)
      .then(({ data }) => {
        if (!cancelled) setTenant(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  function handleSaved(data, message) {
    setTenant((current) => ({ ...data, activity: data.activity ?? current?.activity }));
    setNotice(message);
    setDialog(null);
  }

  const backLink = (
    <Link to="/platform/tenants" className="mb-3 inline-block text-sm text-brand-600 hover:underline">
      ← All organizations
    </Link>
  );

  if (error && !tenant) {
    return (
      <div>
        {backLink}
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  if (!tenant) return <Spinner label="Loading organization" />;

  const { admin, activity } = tenant;
  const suspended = tenant.status !== 'active';

  return (
    <div>
      {backLink}

      <div className="mb-5 rounded border border-steel-200 bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Initials name={tenant.organizationName} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-steel-900">{tenant.organizationName}</h1>
                <TenantStatusBadge status={tenant.status} />
              </div>
              <p className="mt-1 text-sm text-steel-500">
                Created {formatDate(tenant.createdAt)} · Last activity {formatRelative(activity.lastActivityAt).toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button as={Link} to={`/platform/tenants/${tenant.tenantId}/edit`} variant="secondary">
              Edit details
            </Button>
            <Button variant={suspended ? 'primary' : 'danger'} onClick={() => setDialog('status')}>
              {suspended ? 'Activate' : 'Suspend'}
            </Button>
          </div>
        </div>

      </div>

      {suspended && (
        <Alert tone="warning">This organization is suspended. Nobody in it can sign in until it is activated.</Alert>
      )}
      <Alert tone="success">{notice}</Alert>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityLog tenantId={tenant.tenantId} />
        </div>

        <div className="grid gap-5">
          <Card
            title="Admin"
            actions={
              admin && (
                <Button variant="secondary" size="sm" onClick={() => setDialog('password')}>
                  Reset password
                </Button>
              )
            }
          >
            {admin ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <Initials name={admin.name} tone="admin" size="md" />
                  <div className="min-w-0 leading-tight">
                    <p className="font-semibold text-steel-900">{admin.name}</p>
                    <p className="text-sm break-all text-steel-500">{admin.email}</p>
                  </div>
                </div>
                <dl className="grid gap-3">
                  <Detail label="Last sign-in">
                    {formatWhen(admin.lastLoginAt)}
                  </Detail>
                  <Detail label="Password">
                    <PasswordStatus admin={admin} />
                  </Detail>
                </dl>
              </>
            ) : (
              <p className="text-sm text-steel-500">This organization has no admin account.</p>
            )}
          </Card>

          <Card title="Organization details">
            <dl className="grid gap-3">
              <Detail label="Contact email">
                <span className="break-all">{tenant.email}</span>
              </Detail>
              <Detail label="Phone">{tenant.phone}</Detail>
              <Detail label="Address">{tenant.address}</Detail>
              <Detail label="Organization ID">
                <span className="font-mono text-xs break-all text-steel-600">{tenant.tenantId}</span>
              </Detail>
            </dl>
          </Card>
        </div>
      </div>

      <StatusModal tenant={tenant} open={dialog === 'status'} onClose={() => setDialog(null)} onSaved={handleSaved} />
      {admin && (
        <ResetPasswordModal tenant={tenant} open={dialog === 'password'} onClose={() => setDialog(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
