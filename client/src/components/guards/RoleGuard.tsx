import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import ConnectionError from '../connection-error/ConnectionError';
import Loader from '../loader/Loader';
import Sheet from '../sheet/Sheet';

type RoleGuardProps = {
  /** The roles that may open the screens under this route. */
  roles: readonly Role[];
};

/**
 * Layout route for the screens of one or more roles. A guest goes to `/login` with
 * `state.from` set to this page with its params, so login brings them back; a user with
 * another role goes to `/`. When the startup /me could not reach the server, it shows
 * ConnectionError instead.
 */
export default function RoleGuard({ roles }: RoleGuardProps) {
  const { user, loading, offline } = useAuth();
  const location = useLocation();

  if (loading) {
    // On a sheet like the screen that follows, so the light text tokens apply.
    return (
      <Sheet>
        <Loader />
      </Sheet>
    );
  }
  // /me could not reach the server: the user may be logged in, so no redirect to /login.
  if (offline) return <ConnectionError />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
