import { Navigate, useNavigate } from 'react-router-dom';
import { usersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import PasswordChangeForm from '../components/PasswordChangeForm';
import AuthShell from './AuthShell';

// Shown after signing in with a temporary password from the Super Admin. Nothing else opens until it is replaced.
export default function ChangePasswordPage() {
  const { user, mustChangePassword, updateSession, logOut } = useAuth();
  const navigate = useNavigate();

  if (!mustChangePassword) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(passwords) {
    const response = await usersApi.changeOwnPassword(passwords);
    updateSession(response.data);
    navigate('/dashboard', { replace: true });
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Set a new password to continue"
      footer={
        <button type="button" onClick={logOut} className="font-semibold text-brand-600 hover:underline">
          Sign out
        </button>
      }
    >
      <Alert tone="info">
        Welcome{user?.name ? `, ${user.name}` : ''}. You signed in with a temporary password. Choose your own password
        before using the app.
      </Alert>

      <PasswordChangeForm currentLabel="Temporary password" submitLabel="Save and continue" onSubmit={handleSubmit} />
    </AuthShell>
  );
}
