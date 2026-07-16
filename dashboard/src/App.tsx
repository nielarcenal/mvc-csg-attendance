import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AuthProvider, RequireAuth } from './lib/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventCreate from './pages/EventCreate';
import LiveAttendance from './pages/LiveAttendance';
import ReviewQueue from './pages/ReviewQueue';
import Accounts from './pages/Accounts';
import BatchQr from './pages/BatchQr';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/login') {
    return (
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </AuthProvider>
    );
  }
  return (
    <AuthProvider>
      <RequireAuth>
        <Shell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/new" element={<EventCreate />} />
            <Route path="/live" element={<LiveAttendance />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/reports" element={<BatchQr />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Shell>
      </RequireAuth>
    </AuthProvider>
  );
}
