import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route that requires authentication.
 * - Not logged in → /login
 * - schoolSlug mismatch → correct school's dashboard
 * - allowedRoles provided and user not in list → their dashboard
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { auth } = useAuth();
  const { schoolSlug } = useParams();

  if (!auth) return <Navigate to="/login" replace />;

  if (schoolSlug && auth.schoolSlug && schoolSlug !== auth.schoolSlug) {
    return <Navigate to={`/${auth.schoolSlug}/dashboard`} replace />;
  }

  // Multi-role check: user passes if primary role OR any additional role matches
  if (allowedRoles) {
    const userRoles = [auth.role, ...(auth.roles ?? [])];
    const hasRole = allowedRoles.some(r => userRoles.includes(r));
    if (!hasRole) return <Navigate to={`/${auth.schoolSlug}/dashboard`} replace />;
  }

  return children;
}

