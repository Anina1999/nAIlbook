import { Route, Routes } from 'react-router';
import GuestGuard from './components/guards/GuestGuard';
import Layout from './components/layout/Layout';
import AuthProvider from './contexts/AuthProvider';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Home from './pages/home/Home';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route element={<GuestGuard />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
