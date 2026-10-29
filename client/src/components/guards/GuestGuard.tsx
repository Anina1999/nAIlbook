import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useFrom } from '../../hooks/useFrom';
import Loader from '../loader/Loader';

/** Layout route for guest-only screens: a logged-in user goes back to where they came from. */
export default function GuestGuard() {
  const { user, loading } = useAuth();
  const from = useFrom();

  if (loading) return <Loader />;
  if (user) return <Navigate to={from} replace />;
  return <Outlet />;
}
