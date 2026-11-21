import { useAuth } from '../context/AuthContext';

// Shows its children only when the signed-in user may do this. anyOf: [[resource, action], ...] passes if one does.
export default function Can({ resource, action, anyOf, roles, fallback = null, children }) {
  const { role, can } = useAuth();

  if (roles && !roles.includes(role)) return fallback;
  if (resource && action && !can(resource, action)) return fallback;
  if (anyOf && !anyOf.some(([r, a]) => can(r, a))) return fallback;

  return children;
}
