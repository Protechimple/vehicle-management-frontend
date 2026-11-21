import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usersApi, sitesApi, listAll } from '../api/client';
import { Alert, Badge, Button, Card, Field, Input, Modal, RoleBadge, Select, Spinner } from '../components/ui';
import MemberAccessDialog from '../components/access/MemberAccessDialog';
import { MEMBER_ROLES, MULTI_SITE_ROLES, roleLabel } from '../config/permissions';
import { NewPasswordFields, useFormFields, validateNewPassword } from '../components/profile/AccountForms';

const ROLE_SUMMARIES = {
  site_manager: 'Covers one or more sites and sees the people who report to them.',
  supervisor: 'Records day-to-day work at their site(s).',
  inventory_supervisor: 'Looks after stock, purchases and issues at their site(s).',
};

const isMultiSite = (role) => MULTI_SITE_ROLES.includes(role);

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ status }) {
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status}</Badge>;
}

function siteLabel(site) {
  return site.location ? `${site.name} — ${site.location}` : site.name;
}

function SiteChecklist({ sites, value, onChange }) {
  const selected = new Set(value.map(String));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  return (
    <div className="max-h-56 overflow-y-auto rounded border border-steel-200">
      {sites.map((site) => {
        const id = String(site.id);
        return (
          <label key={id} className="flex cursor-pointer items-center gap-2 border-b border-steel-200 px-3 py-2 text-sm last:border-b-0 hover:bg-steel-50">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={selected.has(id)} onChange={() => toggle(id)} />
            <span className="text-steel-900">{siteLabel(site)}</span>
          </label>
        );
      })}
    </div>
  );
}

function MemberForm({ mode, initial, sites, members, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    role: initial?.role ?? 'supervisor',
    siteIds: (initial?.siteIds ?? []).map(String),
    managerId: initial?.managerId ? String(initial.managerId) : '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  const multi = isMultiSite(form.role);
  // A Site Manager always reports to the Admin; only Supervisors and Inventory Supervisors are placed under one.
  const hasManager = form.role !== 'site_manager';

  // Anyone may report to a Site Manager who covers every site they work at.
  const managerOptions = useMemo(
    () =>
      members.filter(
        (m) =>
          form.siteIds.length > 0 &&
          m.role === 'site_manager' &&
          m.status === 'active' &&
          m.id !== initial?.id &&
          form.siteIds.every((id) => (m.siteIds ?? []).map(String).includes(id))
      ),
    [members, initial?.id, form.siteIds]
  );
  const managerStillValid = !hasManager || !form.managerId || managerOptions.some((m) => String(m.id) === form.managerId);

  function changeRole(event) {
    const role = event.target.value;
    setForm((f) => ({ ...f, role, siteIds: isMultiSite(role) ? f.siteIds : f.siteIds.slice(0, 1), managerId: role === 'site_manager' ? '' : f.managerId }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      managerId: hasManager && form.managerId ? Number(form.managerId) : null,
      ...(multi ? { siteIds: form.siteIds.map(Number) } : { siteId: form.siteIds[0] ? Number(form.siteIds[0]) : null }),
    };

    try {
      const response = mode === 'create' ? await usersApi.createMember(payload) : await usersApi.updateMember(initial.id, payload);
      onSaved(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const emailChanged = mode === 'edit' && form.email.trim() !== initial?.email;
  const roleChanged = mode === 'edit' && form.role !== initial?.role;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      <Field label="Role" required hint={ROLE_SUMMARIES[form.role]}>
        {({ id, invalid, describedBy }) => (
          <Select id={id} invalid={invalid} describedBy={describedBy} name="role" value={form.role} onChange={changeRole} required>
            {MEMBER_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {roleChanged && (
        <Alert tone="warning">
          Changing the role signs them out and clears any access exceptions you gave them, so they start from the new role's access.
        </Alert>
      )}

      <Field label="Name" required>
        {({ id, invalid, describedBy }) => (
          <Input id={id} invalid={invalid} describedBy={describedBy} name="name" value={form.name} onChange={update('name')} required />
        )}
      </Field>

      <Field
        label="Email"
        required
        hint={
          mode === 'create'
            ? 'They will receive a link to set their own password.'
            : emailChanged
              ? 'Changing the email sends a new set-password link and signs out the previous holder.'
              : undefined
        }
      >
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="email"
            name="email"
            value={form.email}
            onChange={update('email')}
            required
          />
        )}
      </Field>

      {multi ? (
        <Field label="Sites" required hint={`${form.siteIds.length} selected. They will see and work with data from these sites only.`}>
          {() => <SiteChecklist sites={sites} value={form.siteIds} onChange={(siteIds) => setForm((f) => ({ ...f, siteIds }))} />}
        </Field>
      ) : (
        <Field label="Site" required hint="They will only be able to see and work with data from this one site.">
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              name="siteId"
              value={form.siteIds[0] ?? ''}
              onChange={(event) => setForm((f) => ({ ...f, siteIds: event.target.value ? [event.target.value] : [] }))}
              required
            >
              <option value="">Select a site...</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id} data-added={site.id}>
                  {siteLabel(site)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {hasManager ? (
        <Field
          label="Reports to"
          hint={
            !form.siteIds.length
              ? 'Tick their site(s) first — then the Site Managers covering them are listed here.'
              : managerStillValid
              ? 'Optional. Only Site Managers who cover all of the chosen sites are listed.'
              : 'The chosen Site Manager does not cover these sites — pick another, or give them the site first.'
          }
          error={managerStillValid ? undefined : 'Not available for these sites'}
        >
          {({ id, invalid, describedBy }) => (
            <Select id={id} invalid={invalid} describedBy={describedBy} name="managerId" value={form.managerId} onChange={update('managerId')}>
              <option value="">No one (reports to the Admin)</option>
              {!managerStillValid && (
                <option value={form.managerId}>{members.find((m) => String(m.id) === form.managerId)?.name ?? 'Unavailable'}</option>
              )}
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <Field label="Reports to" hint="A Site Manager always reports to the Admin.">
          {({ id }) => <Input id={id} value="Admin" disabled />}
        </Field>
      )}

      {sites.length === 0 && (
        <Alert tone="warning">This organization has no active sites yet. Create a site first, then come back and add the user.</Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={sites.length === 0}>
          {mode === 'create' ? `Create ${roleLabel(form.role)}` : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function MemberPasswordForm({ member, onCancel, onSaved }) {
  const { form, fieldErrors, setFieldErrors, update } = useFormFields({ password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const errors = validateNewPassword(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await usersApi.changeMemberPassword(member.id, form.password);
      onSaved(response.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      <p className="mb-3 text-sm text-steel-500">
        {member.name} will be signed out of any open sessions and will need this new password to sign in. Share it with them
        securely.
      </p>

      <NewPasswordFields form={form} fieldErrors={fieldErrors} update={update} />

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save new password
        </Button>
      </div>
    </form>
  );
}

const ROLE_TONES = { site_manager: 'bg-brand-600', supervisor: 'bg-steel-500', inventory_supervisor: 'bg-success-600' };

function initialsOf(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function SiteChips({ siteIds, siteNames }) {
  if (!siteIds?.length) return <span className="text-xs font-medium text-danger-600">No site</span>;
  const shown = siteIds.slice(0, 1);
  const more = siteIds.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1" title={siteIds.map((id) => siteNames[id] ?? `Site #${id}`).join(', ')}>
      {shown.map((id) => (
        <span key={id} className="max-w-32 truncate rounded bg-steel-100 px-1.5 py-0.5 text-xs text-steel-700">
          {siteNames[id] ?? `Site #${id}`}
        </span>
      ))}
      {more > 0 && <span className="rounded bg-steel-100 px-1.5 py-0.5 text-xs text-steel-500">+{more}</span>}
    </span>
  );
}

// Less frequent actions, kept out of the row so the table fits. The menu opens to the left of the ⋯ button, so the
// ⋯ buttons of the other rows stay clickable: clicking another user's ⋯ closes this menu and opens theirs. It also
// closes on an outside click or Esc, and lines up with the button's bottom when there is no room below.
function MoreActions({ member, onPassword, onStatus }) {
  const [open, setOpen] = useState(false);
  const [upwards, setUpwards] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const bottom = ref.current?.getBoundingClientRect().bottom ?? 0;
      setUpwards(bottom + 110 > window.innerHeight);
    }
    setOpen((value) => !value);
  }

  function choose(action) {
    setOpen(false);
    action();
  }

  const item = 'block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-steel-50 focus:bg-steel-50 focus:outline-none';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`More actions for ${member.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className={`flex h-7.5 items-center rounded border px-2 text-steel-600 transition-colors hover:bg-steel-50 ${
          open ? 'border-brand-500 bg-steel-50' : 'border-steel-200 bg-surface'
        }`}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-full z-30 mr-1.5 w-44 overflow-hidden rounded border border-steel-200 bg-surface py-1 shadow-lg ring-1 ring-black/5 ${
            upwards ? 'bottom-0' : 'top-0'
          }`}
        >
          <button type="button" role="menuitem" className={`${item} text-steel-700`} onClick={() => choose(onPassword)}>
            Set new password
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${item} ${member.status === 'active' ? 'text-danger-600' : 'text-success-600'}`}
            onClick={() => choose(onStatus)}
          >
            {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      )}
    </div>
  );
}

// A deactivated user's details are shown faded; their status and actions stay at full strength.
const dim = (member) => (member.status === 'active' ? '' : 'opacity-60');

function SummaryTile({ label, value, tone }) {
  return (
    <div className="flex items-center gap-3 bg-surface px-4 py-3">
      {tone && <span className={`size-2.5 rounded-full ${tone}`} aria-hidden="true" />}
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold tracking-wide text-steel-500 uppercase">{label}</div>
        <div className="text-xl font-semibold text-steel-900 tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [accounts, setAccounts] = useState(null);
  const [sites, setSites] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind: 'create' | 'edit' | 'password', member }
  const [accessMember, setAccessMember] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusPending, setStatusPending] = useState(false);
  const [filters, setFilters] = useState({ search: '', role: '', siteId: '', status: '' });

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [usersResponse, sitesResponse] = await Promise.all([usersApi.list(), listAll(sitesApi.list)]);
      setAccounts(usersResponse.data);
      setSites(sitesResponse.data);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const siteNames = useMemo(() => Object.fromEntries(sites.map((site) => [site.id, site.name])), [sites]);
  const members = useMemo(() => accounts?.filter((account) => account.role !== 'admin') ?? [], [accounts]);
  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const reportCounts = useMemo(() => {
    const counts = {};
    for (const m of members) if (m.managerId) counts[m.managerId] = (counts[m.managerId] ?? 0) + 1;
    return counts;
  }, [members]);

  const term = filters.search.trim().toLowerCase();
  const rows = members.filter(
    (m) =>
      (!term || `${m.name} ${m.email}`.toLowerCase().includes(term)) &&
      (!filters.role || m.role === filters.role) &&
      (!filters.status || m.status === filters.status) &&
      (!filters.siteId || (m.siteIds ?? []).map(String).includes(filters.siteId))
  );
  const setFilter = (key) => (event) => setFilters((f) => ({ ...f, [key]: event.target.value }));

  async function handleSaved(message) {
    setDialog(null);
    setNotice(message);
    await load();
  }

  async function toggleStatus() {
    setStatusPending(true);
    try {
      const next = statusTarget.status === 'active' ? 'inactive' : 'active';
      const response = await usersApi.setMemberStatus(statusTarget.id, next);
      setNotice(response.message);
      setStatusTarget(null);
      await load();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setStatusPending(false);
    }
  }

  if (loadError && !accounts) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert tone="error">{loadError}</Alert>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (!accounts) return <Spinner label="Loading users" />;

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-steel-900">Organization users</h1>
          <p className="mt-1 text-steel-500">The Site Managers, Supervisors and Inventory Supervisors who sign in to work at your sites.</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>Add user</Button>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {loadError && <Alert tone="error">{loadError}</Alert>}

      <section aria-label="Team summary" className="grid grid-cols-2 gap-px overflow-hidden rounded border border-steel-200 bg-steel-200 md:grid-cols-4">
        {MEMBER_ROLES.map((role) => (
          <SummaryTile key={role} label={`${roleLabel(role)}s`} value={members.filter((m) => m.role === role).length} tone={ROLE_TONES[role]} />
        ))}
        <SummaryTile label="Deactivated" value={members.filter((m) => m.status !== 'active').length} />
      </section>

      <Card>
        <div className="-mx-5 -mt-4 mb-1 grid gap-3 border-b border-steel-200 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label="Search by name or email" placeholder="Search name or email" value={filters.search} onChange={setFilter('search')} />
          <Select aria-label="Filter by role" value={filters.role} onChange={setFilter('role')}>
            <option value="">All roles</option>
            {MEMBER_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by site" value={filters.siteId} onChange={setFilter('siteId')}>
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" value={filters.status} onChange={setFilter('status')}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </Select>
        </div>

        <div className="-mx-5 overflow-x-auto lg:overflow-visible">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-steel-200 text-xs font-semibold tracking-wide text-steel-500 uppercase">
                <th scope="col" className="px-4 py-3">User</th>
                <th scope="col" className="px-3 py-3">Role</th>
                <th scope="col" className="px-3 py-3">Sites</th>
                <th scope="col" className="px-3 py-3 whitespace-nowrap">Reports to</th>
                <th scope="col" className="px-3 py-3 whitespace-nowrap">Status · last sign-in</th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-steel-500">
                    {members.length === 0 ? (
                      <>
                        <p>No users yet besides you.</p>
                        <Button className="mt-3" onClick={() => setDialog({ kind: 'create' })}>
                          Add the first user
                        </Button>
                      </>
                    ) : (
                      'No users match these filters.'
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.id} className="hover:bg-steel-50">
                    <td className={`px-4 py-3 ${dim(m)}`}>
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${ROLE_TONES[m.role] ?? 'bg-steel-500'}`}
                        >
                          {initialsOf(m.name)}
                        </span>
                        <div className="min-w-0 max-w-40">
                          <div className="truncate font-medium text-steel-900">{m.name}</div>
                          <div className="truncate text-xs text-steel-500" title={m.email}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap ${dim(m)}`}>
                      <RoleBadge role={m.role} />
                      {m.role === 'site_manager' && reportCounts[m.id] > 0 && (
                        <div className="mt-1 text-xs text-steel-500">
                          {reportCounts[m.id]} report{reportCounts[m.id] === 1 ? '' : 's'}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-3 ${dim(m)}`}>
                      <SiteChips siteIds={m.siteIds} siteNames={siteNames} />
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-steel-700 ${dim(m)}`}>{names[m.managerId] ?? <span className="text-steel-400">—</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusBadge status={m.status} />
                      <div className="mt-1 text-xs text-steel-500">{m.lastLoginAt ? formatDate(m.lastLoginAt) : 'Never signed in'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: 'edit', member: m })}>
                          Edit
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setAccessMember(m)}>
                          Access
                        </Button>
                        <MoreActions member={m} onPassword={() => setDialog({ kind: 'password', member: m })} onStatus={() => setStatusTarget(m)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onClose={() => setDialog(null)}
        wide
        title={dialog?.kind === 'edit' ? `Edit ${dialog.member.name}` : 'Add user'}
        description={dialog?.kind === 'create' ? 'They will get an email with a link to set their password.' : undefined}
      >
        {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
          <MemberForm
            key={dialog.member?.id ?? 'new'}
            mode={dialog.kind}
            initial={dialog.member}
            sites={sites}
            members={members}
            onCancel={() => setDialog(null)}
            onSaved={handleSaved}
          />
        )}
      </Modal>

      <Modal open={dialog?.kind === 'password'} onClose={() => setDialog(null)} title={dialog?.member ? `New password for ${dialog.member.name}` : 'New password'}>
        {dialog?.kind === 'password' && <MemberPasswordForm member={dialog.member} onCancel={() => setDialog(null)} onSaved={handleSaved} />}
      </Modal>

      <MemberAccessDialog member={accessMember} onClose={() => setAccessMember(null)} onSaved={setNotice} />

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === 'active' ? `Deactivate ${roleLabel(statusTarget?.role)}?` : `Reactivate ${roleLabel(statusTarget?.role)}?`}
        description={
          statusTarget?.status === 'active'
            ? `${statusTarget?.name} will be signed out on their next request and will not be able to sign in again until reactivated.`
            : `${statusTarget?.name} will be able to sign in again.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button variant={statusTarget?.status === 'active' ? 'danger' : 'primary'} loading={statusPending} onClick={toggleStatus}>
              {statusTarget?.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      />
    </div>
  );
}
