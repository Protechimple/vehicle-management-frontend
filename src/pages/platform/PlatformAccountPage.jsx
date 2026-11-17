import { useState } from 'react';
import { platformApi } from '../../api/platformClient';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import { Alert, Card } from '../../components/ui';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import { Initials, PageHeader } from './tenantDisplay';

export default function PlatformAccountPage() {
  const { user, startSession } = usePlatformAuth();
  const [message, setMessage] = useState(null);
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(passwords) {
    const response = await platformApi.changeOwnPassword(passwords);
    startSession(response.data);
    setMessage(response.message);
    setFormKey((key) => key + 1);
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="My account" />

      <div className="mb-5 flex items-center gap-3 rounded border border-steel-200 bg-surface p-4">
        <Initials name={user?.name} tone="admin" size="md" />
        <div className="min-w-0 leading-tight">
          <p className="font-semibold text-steel-900">{user?.name}</p>
          <p className="text-sm break-all text-steel-500">{user?.email}</p>
        </div>
        <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
          Super Admin
        </span>
      </div>

      <Alert tone="success">{message}</Alert>

      <Card title="Change password">
        <PasswordChangeForm key={formKey} onSubmit={handleSubmit} />
      </Card>
    </div>
  );
}
