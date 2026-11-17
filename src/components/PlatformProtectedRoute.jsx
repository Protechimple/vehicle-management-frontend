import { Navigate } from 'react-router-dom';
import { usePlatformAuth } from '../context/PlatformAuthContext';

export default function PlatformProtectedRoute({ children }) {
  const { isAuthenticated, sessionExpired } = usePlatformAuth();

  if (!isAuthenticated) {
    const notice = sessionExpired ? 'Your session has expired. Please sign in again.' : undefined;
    return <Navigate to="/platform/login" replace state={{ notice, noticeTone: 'warning' }} />;
  }

  return children;
}
