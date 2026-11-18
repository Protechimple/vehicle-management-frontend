import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import { Alert, Button, Field, Input } from '../../components/ui';
import AuthShell from '../AuthShell';

export default function PlatformLoginPage() {
  const { logIn, isAuthenticated } = usePlatformAuth();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/platform/tenants" replace />;

  const notice = location.state?.notice ?? null;
  const noticeTone = location.state?.noticeTone ?? 'success';
  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await logIn(form);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Super Admin sign in" subtitle="Super Admin sign in">
      <Alert tone={noticeTone}>{notice}</Alert>
      <Alert tone="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email" required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              required
            />
          )}
        </Field>

        <Field label="Password" required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          )}
        </Field>

        <Button type="submit" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
