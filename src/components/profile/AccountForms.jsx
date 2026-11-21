import { useState } from 'react';
import { usersApi } from '../../api/client';
import { Alert, Button, Field, Input } from '../ui';
import { useAuth } from '../../context/AuthContext';

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(form) {
  const errors = {};
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}

export function useFormFields(initial) {
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  };

  return { form, fieldErrors, setFieldErrors, update };
}

export function NewPasswordFields({ form, fieldErrors, update }) {
  return (
    <>
      <Field
        label="New password"
        error={fieldErrors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        required
      >
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            required
          />
        )}
      </Field>

      <Field label="Confirm new password" error={fieldErrors.confirmPassword} required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            required
          />
        )}
      </Field>
    </>
  );
}

export function OwnProfileForm({ account, organizationName, onCancel, onSaved }) {
  const { updateSession } = useAuth();
  const { form, update } = useFormFields({
    name: account.name,
    email: account.email,
    organizationName: organizationName ?? '',
    currentPassword: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emailChanged = form.email.trim().toLowerCase() !== account.email;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { currentPassword, ...profile } = form;
      const response = await usersApi.updateOwnProfile(emailChanged ? { ...profile, currentPassword } : profile);
      updateSession(response.data);
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

      <Field label="Name" required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={update('name')}
            required
          />
        )}
      </Field>

      <Field
        label="Email"
        required
        hint={emailChanged ? 'You will sign in with this email from now on.' : undefined}
      >
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

      <Field label="Organization name" required hint="Shown in the header and on printed reports.">
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            name="organizationName"
            autoComplete="organization"
            value={form.organizationName}
            onChange={update('organizationName')}
            required
          />
        )}
      </Field>

      {emailChanged && (
        <Field label="Current password" required hint="Required to change your email.">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={update('currentPassword')}
              required
            />
          )}
        </Field>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function OwnPasswordForm({ onCancel, onSaved }) {
  const { updateSession } = useAuth();
  const { form, fieldErrors, setFieldErrors, update } = useFormFields({
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const errors = validateNewPassword(form);
    if (!form.currentPassword) errors.currentPassword = 'Enter your current password';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await usersApi.changeOwnPassword({
        currentPassword: form.currentPassword,
        newPassword: form.password,
      });
      updateSession(response.data);
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

      <Field label="Current password" error={fieldErrors.currentPassword} required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update('currentPassword')}
            required
          />
        )}
      </Field>

      <NewPasswordFields form={form} fieldErrors={fieldErrors} update={update} />

      <p className="mb-3 text-xs text-steel-500">
        You stay signed in here; any other devices signed in to your account will be signed out.
      </p>

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

