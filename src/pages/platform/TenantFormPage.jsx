import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { platformApi } from '../../api/platformClient';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui';
import TemporaryPasswordField, { MIN_PASSWORD_LENGTH } from './TemporaryPasswordField';
import { PageHeader } from './tenantDisplay';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EMPTY_FORM = {
  organizationName: '',
  email: '',
  phone: '',
  address: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

function validate(form, isCreate) {
  const errors = {};
  if (!form.organizationName.trim()) errors.organizationName = 'Organization name is required';
  if (!isCreate && !EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address';
  if (isCreate) {
    if (!form.adminName.trim()) errors.adminName = 'Admin name is required';
    if (!EMAIL_PATTERN.test(form.adminEmail.trim())) errors.adminEmail = 'Enter a valid email address';
    if (form.adminPassword.length < MIN_PASSWORD_LENGTH) {
      errors.adminPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
  }
  return errors;
}

function TextField({ label, name, form, errors, update, required = false, type = 'text', hint, autoComplete = 'off' }) {
  return (
    <Field label={label} error={errors[name]} hint={hint} required={required}>
      {({ id, invalid, describedBy }) => (
        <Input
          id={id}
          invalid={invalid}
          describedBy={describedBy}
          type={type}
          name={name}
          autoComplete={autoComplete}
          value={form[name]}
          onChange={update(name)}
          required={required}
        />
      )}
    </Field>
  );
}

export default function TenantFormPage() {
  const { tenantId } = useParams();
  const isCreate = !tenantId;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isCreate) return undefined;
    let cancelled = false;
    platformApi
      .getTenant(tenantId)
      .then(({ data }) => {
        if (cancelled) return;
        setForm({
          ...EMPTY_FORM,
          organizationName: data.organizationName ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreate, tenantId]);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const nextErrors = validate(form, isCreate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // On create the organization email is taken from the admin's email.
    const organization = {
      organizationName: form.organizationName,
      ...(isCreate ? {} : { email: form.email }),
      phone: form.phone,
      address: form.address,
    };

    setSubmitting(true);
    try {
      if (isCreate) {
        const { data } = await platformApi.createTenant({
          ...organization,
          admin: { name: form.adminName, email: form.adminEmail, password: form.adminPassword },
        });
        navigate(`/platform/tenants/${data.tenantId}`, {
          replace: true,
          state: {
            notice: `Organization created. Give ${form.adminEmail} the temporary password — they must change it at first sign-in.`,
          },
        });
      } else {
        await platformApi.updateTenant(tenantId, organization);
        navigate(`/platform/tenants/${tenantId}`, { replace: true, state: { notice: 'Organization updated.' } });
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner label="Loading organization" />;

  const backTo = isCreate ? '/platform/tenants' : `/platform/tenants/${tenantId}`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={
          <Link to={backTo} className="mb-3 inline-block text-sm text-brand-600 hover:underline">
            ← {isCreate ? 'All organizations' : 'Back to organization'}
          </Link>
        }
        title={isCreate ? 'Create organization' : 'Edit organization'}
        description={
          isCreate
            ? 'Creates the organization and its admin. The admin signs in with the temporary password and must change it before using the app.'
            : 'Update the organization’s contact details.'
        }
      />

      <Alert tone="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Card title="Organization">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <TextField label="Organization name" name="organizationName" required form={form} errors={errors} update={update} />
            {!isCreate && (
              <TextField label="Email" name="email" type="email" required form={form} errors={errors} update={update} />
            )}
            <TextField label="Phone" name="phone" type="tel" form={form} errors={errors} update={update} />
            <TextField label="Address" name="address" form={form} errors={errors} update={update} />
          </div>
        </Card>

        {isCreate && (
          <Card title="Organization admin" subtitle="Each organization has one admin. They can add supervisors after signing in.">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <TextField label="Name" name="adminName" required form={form} errors={errors} update={update} />
              <TextField
                label="Email (used to sign in)"
                name="adminEmail"
                type="email"
                required
                form={form}
                errors={errors}
                update={update}
              />
            </div>
            <TemporaryPasswordField
              value={form.adminPassword}
              error={errors.adminPassword}
              onChange={(value) => setForm((f) => ({ ...f, adminPassword: value }))}
            />
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button as={Link} to={backTo} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isCreate ? 'Create organization' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
