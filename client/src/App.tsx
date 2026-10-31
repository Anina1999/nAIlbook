import { Route, Routes } from 'react-router';
import GuestGuard from './components/guards/GuestGuard';
import RoleGuard from './components/guards/RoleGuard';
import Layout from './components/layout/Layout';
import AuthProvider from './contexts/AuthProvider';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/home/Home';
import ManicuristPage from './pages/manicurist/Manicurist';
import DaysOff from './pages/days-off/DaysOff';
import MyBookings from './pages/my-bookings/MyBookings';
import Schedule from './pages/schedule/Schedule';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/manicurists/:id" element={<ManicuristPage />} />
          <Route element={<GuestGuard />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route element={<RoleGuard roles={['CLIENT']} />}>
            <Route path="/my-bookings" element={<MyBookings />} />
          </Route>
          <Route element={<RoleGuard roles={['MANICURIST']} />}>
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/days-off" element={<DaysOff />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
