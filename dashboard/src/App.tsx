import { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { AuthProvider, RequireAuth, useAuth } from './lib/auth';
import { hasBackend } from './lib/supabase';
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

// Hard requirement (CLAUDE.md): no backend → no fake data. The app refuses
// to render screens it cannot back with real queries.
function BackendMissing() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 26 }}>
      <div className="card" style={{ maxWidth: 460, borderRadius: 18, padding: 24, textAlign: 'center' }}>
        <div className="display" style={{ fontSize: 20 }}>Backend not configured</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.6 }}>
          This dashboard only renders live data. Set <b>VITE_SUPABASE_URL</b> and{' '}
          <b>VITE_SUPABASE_ANON_KEY</b> (e.g. in <code>.env.local</code>) and rebuild.
        </div>
      </div>
    </div>
  );
}

// Role guard (UX §1): an event maker deep-linking to a super-admin route is
// redirected, never shown a blank page.
function SuperOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (profile && profile.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { pathname } = useLocation();
  if (!hasBackend) return <BackendMissing />;
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
            <Route path="/events/:id/edit" element={<EventCreate />} />
            <Route path="/live" element={<LiveAttendance />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/reports" element={<BatchQr />} />
            <Route path="/audit" element={<SuperOnly><AuditLog /></SuperOnly>} />
            <Route path="/settings" element={<SuperOnly><Settings /></SuperOnly>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Shell>
      </RequireAuth>
    </AuthProvider>
  );
}
