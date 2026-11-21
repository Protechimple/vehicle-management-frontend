import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const CHANGE_PASSWORD_PATH = '/change-password';

// anyOf: [[resource, action], ...] — the screen opens if the user may do at least one of them.
// allOf: the same, but every one is needed (a report needs its module and Reports).
export default function ProtectedRoute({ allowedRoles, anyOf, allOf, children }) {
  const { isAuthenticated, role, can, sessionExpired, previousUserId, mustChangePassword } = useAuth();
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

  if ((anyOf && !anyOf.some(([resource, action]) => can(resource, action))) || (allOf && !allOf.every(([resource, action]) => can(resource, action)))) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
