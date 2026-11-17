import { useState } from 'react';
import { Alert, Button, Field, Input } from './ui';

const MIN_PASSWORD_LENGTH = 8;

function validate(form) {
  const errors = {};
  if (!form.currentPassword) errors.currentPassword = 'Enter your current password';
  if (form.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  } else if (form.newPassword === form.currentPassword) {
    errors.newPassword = 'New password must be different from your current password';
  }
  if (form.confirmPassword !== form.newPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

// Current password + new password twice. `onSubmit` receives { currentPassword, newPassword } and may throw.
export default function PasswordChangeForm({ currentLabel = 'Current password', submitLabel = 'Change password', onSubmit, onCancel }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({ currentPassword: form.currentPassword, newPassword: form.newPassword });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const fields = [
    { name: 'currentPassword', label: currentLabel, autoComplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autoComplete: 'new-password', hint: `At least ${MIN_PASSWORD_LENGTH} characters` },
    { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Alert tone="error">{error}</Alert>

      {fields.map((field) => (
        <Field key={field.name} label={field.label} error={fieldErrors[field.name]} hint={field.hint} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              describedBy={describedBy}
              type="password"
              name={field.name}
              autoComplete={field.autoComplete}
              value={form[field.name]}
              onChange={update(field.name)}
              required
            />
          )}
        </Field>
      ))}

      <div className="mt-4 flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting} fullWidth={!onCancel}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
