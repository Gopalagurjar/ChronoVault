import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateCapsule from './pages/CreateCapsule.jsx';
import CapsuleDetails from './pages/CapsuleDetails.jsx';
import CheckIn from './pages/CheckIn.jsx';
import Contacts from './pages/Contacts.jsx';
import Access from './pages/Access.jsx';
import Confirm from './pages/Confirm.jsx';

function Protected() {
  const { user } = useAuth();
  return user ? <Layout><Outlet /></Layout> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/access/:token" element={<Access />} />
      <Route path="/confirm/:token" element={<Confirm />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateCapsule />} />
        <Route path="/capsules/:id" element={<CapsuleDetails />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/contacts" element={<Contacts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
