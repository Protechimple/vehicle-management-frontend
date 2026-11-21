import { useEffect, useState } from 'react';
import { usersApi } from '../../api/client';
import { roleLabel } from '../../config/permissions';
import { Alert, Button, Modal, Spinner } from '../ui';
import AccessMatrix from './AccessMatrix';

const allKeys = (modules) => modules.flatMap((m) => m.resources.flatMap((r) => r.actions.map((a) => `${r.resource}:${a.action}`)));
const toChange = (key, allowed) => {
  const [resource, action] = key.split(':');
  return { resource, action, allowed };
};

// One person's exceptions to what their role may do. Anything left matching the role follows the role from then on.
export default function MemberAccessDialog({ member, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return undefined;
    let cancelled = false;
    setData(null);
    setDraft({});
    setError(null);
    usersApi
      .getAccess(member.id)
      .then((response) => !cancelled && setData(response.data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [member]);

  const saved = data?.access ?? {};
  const roleAccess = data?.roleAccess ?? {};
  const effective = (key) => (key in draft ? draft[key] : Boolean(saved[key]?.allowed));
  const dirtyKeys = Object.keys(draft).filter((key) => draft[key] !== Boolean(saved[key]?.allowed));
  const exceptions = data ? allKeys(data.modules).filter((key) => saved[key]?.overridden).length : 0;

  async function save(changes) {
    setSaving(true);
    setError(null);
    try {
      const response = await usersApi.updateAccess(member.id, changes);
      setData(response.data);
      setDraft({});
      onSaved?.(`Access for ${member.name} saved`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(member)}
      onClose={onClose}
      wide="xl"
      title={member ? `Access for ${member.name}` : 'Access'}
      description={
        member
          ? `Starts from what every ${roleLabel(member.role)} may do (Roles & access). Marked items are this person's exceptions.`
          : undefined
      }
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => save(allKeys(data.modules).map((key) => toChange(key, null)))}
            disabled={!data || saving || exceptions === 0}
          >
            Match role
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => save(dirtyKeys.map((key) => toChange(key, draft[key])))}
            loading={saving}
            disabled={dirtyKeys.length === 0}
          >
            Save{dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}
          </Button>
        </>
      }
    >
      <Alert tone="error">{error}</Alert>
      {!data && !error && <Spinner label="Loading access" />}
      {data && (
        <>
          <p className="mb-3 text-sm text-steel-500">
            {exceptions ? `${exceptions} exception${exceptions === 1 ? '' : 's'} to the role.` : 'Same as the role — no exceptions.'}
            {' '}Changes apply on their next page load.
          </p>
          <AccessMatrix
            modules={data.modules}
            effective={effective}
            baseline={(key) => Boolean(roleAccess[key]?.allowed)}
            onChange={(changes) => setDraft((current) => ({ ...current, ...changes }))}
            disabled={saving}
          />
        </>
      )}
    </Modal>
  );
}
