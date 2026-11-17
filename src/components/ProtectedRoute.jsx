import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const CHANGE_PASSWORD_PATH = '/change-password';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role, sessionExpired, previousUserId, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const notice = sessionExpired ? 'Your session has expired. Please sign in again.' : undefined;
    return <Navigate to="/login" replace state={{ from: location, fromUserId: previousUserId, notice, noticeTone: 'warning' }} />;
  }

  // A temporary password must be replaced before anything else in the app opens.
  if (mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
