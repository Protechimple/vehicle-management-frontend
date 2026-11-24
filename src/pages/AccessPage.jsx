import { useCallback, useEffect, useMemo, useState } from 'react';
import { accessApi } from '../api/client';
import AccessMatrix from '../components/access/AccessMatrix';
import { Alert, Button, Spinner, Tabs } from '../components/ui';

const ROLE_HINTS = {
  site_manager: 'Runs one or more sites. Sees every site they are given, and the people who report to them.',
  supervisor: 'Works at one site, recording day-to-day work there.',
  inventory_supervisor: 'Works at one site, looking after stock, purchases and issues.',
};

function allKeys(modules) {
  return modules.flatMap((m) => m.resources.flatMap((r) => r.actions.map((a) => `${r.resource}:${a.action}`)));
}

function defaultsFor(modules, role) {
  const map = {};
  for (const m of modules) for (const r of m.resources) for (const a of r.actions) map[`${r.resource}:${a.action}`] = a.defaults[role];
  return map;
}

export default function AccessPage() {
  const [data, setData] = useState(null);
  const [role, setRole] = useState('site_manager');
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData((await accessApi.roles()).data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const defaults = useMemo(() => (data ? defaultsFor(data.modules, role) : {}), [data, role]);
  const saved = data?.access?.[role] ?? {};
  const effective = (key) => (key in draft ? draft[key] : Boolean(saved[key]?.allowed));
  const dirtyKeys = Object.keys(draft).filter((key) => draft[key] !== Boolean(saved[key]?.allowed));
  const changedFromDefault = data ? allKeys(data.modules).filter((key) => saved[key]?.overridden).length : 0;

  function switchRole(next) {
    if (dirtyKeys.length && !window.confirm('Discard the unsaved changes for this role?')) return;
    setDraft({});
    setNotice(null);
    setRole(next);
  }

  async function save(permissions) {
    setSaving(true);
    setError(null);
    try {
      const response = await accessApi.updateRole(role, permissions);
      setData(response.data);
      setDraft({});
      setNotice('Access saved. People with this role get it on their next page load.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function saveDraft() {
    save(dirtyKeys.map((key) => {
      const [resource, action] = key.split(':');
      return { resource, action, allowed: draft[key] };
    }));
  }

  function resetToDefaults() {
    if (!window.confirm('Put every permission for this role back to the built-in default?')) return;
    save(allKeys(data.modules).map((key) => {
      const [resource, action] = key.split(':');
      return { resource, action, allowed: null };
    }));
  }

  if (!data) {
    return error ? (
      <div className="mx-auto max-w-4xl">
        <Alert tone="error">{error}</Alert>
        <Button variant="secondary" onClick={load}>Try again</Button>
      </div>
    ) : (
      <Spinner label="Loading access" />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-steel-900">Roles &amp; access</h1>
        <p className="mt-1 text-steel-500">
          Choose which modules each role sees and what it may do there. A switched-off module disappears from their menu and
          the server refuses it too. You can still give one person an exception from Organization users.
        </p>
      </div>

      <Tabs tabs={data.roles.map((r) => ({ value: r.role, label: r.label }))} active={role} onChange={switchRole} />

      <p className="mb-3 text-sm text-steel-500">{ROLE_HINTS[role]}</p>

      {notice && <Alert tone="success">{notice}</Alert>}
      <Alert tone="error">{error}</Alert>

      <div className="sticky top-(--app-header-height,4rem) z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-steel-200 bg-surface px-4 py-2.5">
        <span className="text-sm text-steel-600">
          {dirtyKeys.length
            ? `${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? '' : 's'}`
            : changedFromDefault
              ? `${changedFromDefault} setting${changedFromDefault === 1 ? '' : 's'} differ from the default`
              : 'Using the built-in defaults'}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={resetToDefaults} disabled={saving || changedFromDefault === 0}>
            Reset to defaults
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDraft({})} disabled={saving || dirtyKeys.length === 0}>
            Discard
          </Button>
          <Button size="sm" onClick={saveDraft} loading={saving} disabled={dirtyKeys.length === 0}>
            Save
          </Button>
        </div>
      </div>

      <AccessMatrix
        modules={data.modules}
        effective={effective}
        baseline={(key) => Boolean(defaults[key])}
        onChange={(changes) => setDraft((current) => ({ ...current, ...changes }))}
        disabled={saving}
      />
    </div>
  );
}
