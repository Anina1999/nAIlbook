import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../loader/Loader';
import Sheet from '../sheet/Sheet';

type RoleGuardProps = {
  /** The roles that may open the screens under this route. */
  roles: readonly Role[];
};

/**
 * Layout route for the screens of one or more roles. A guest goes to `/login` with
 * `state.from` set to this page with its params, so login brings them back; a user with
 * another role goes to `/`.
 */
export default function RoleGuard({ roles }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // On a sheet like the screen that follows, so the light text tokens apply.
    return (
      <Sheet>
        <Loader />
      </Sheet>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
