import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useFrom } from '../../hooks/useFrom';
import Loader from '../loader/Loader';
import Sheet from '../sheet/Sheet';

/** Layout route for guest-only screens: a logged-in user goes back to where they came from. */
export default function GuestGuard() {
  const { user, loading } = useAuth();
  const from = useFrom();

  if (loading) {
    // On the same sheet as the form that follows, so the light text tokens apply.
    return (
      <Sheet narrow>
        <Loader />
      </Sheet>
    );
  }
  if (user) return <Navigate to={from} replace />;
  return <Outlet />;
}
