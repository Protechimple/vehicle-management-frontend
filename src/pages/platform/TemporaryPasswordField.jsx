import { Button, Field, Input } from '../../components/ui';

export const MIN_PASSWORD_LENGTH = 8;

// No look-alike characters (0/O, 1/l/I), so the password can be read out or typed from a note.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generatePassword(length = 12) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join('');
}

// Shown as plain text: the Super Admin has to pass it on to the organization admin.
export default function TemporaryPasswordField({ value, error, onChange, label = 'Temporary password' }) {
  return (
    <Field
      label={label}
      error={error}
      hint={`At least ${MIN_PASSWORD_LENGTH} characters. Share it with the admin securely; they must change it at first sign-in.`}
      required
    >
      {({ id, invalid, describedBy }) => (
        <div className="flex gap-2">
          <Input
            id={id}
            invalid={invalid}
            describedBy={describedBy}
            type="text"
            name="temporaryPassword"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required
          />
          <Button variant="secondary" onClick={() => onChange(generatePassword())}>
            Generate
          </Button>
        </div>
      )}
    </Field>
  );
}
