import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { loadReviewItems, initialsOf } from '../data/api';
import { ConfirmDialog } from './ConfirmDialog';

interface NavItem {
  to: string;
  label: string;
  tint: string;
  color: string;
  superOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', tint: 'rgba(63,155,216,.12)', color: 'var(--student-deep)' },
  { to: '/events', label: 'Events', tint: 'rgba(142,95,174,.12)', color: 'var(--maker-deep)' },
  { to: '/live', label: 'Live attendance', tint: 'rgba(142,95,174,.12)', color: 'var(--maker-deep)' },
  { to: '/review', label: 'Review queue', tint: 'rgba(226,145,63,.14)', color: 'var(--alert-deep)' },
  { to: '/accounts', label: 'Accounts', tint: 'rgba(63,155,216,.12)', color: 'var(--student-deep)' },
  { to: '/reports', label: 'Reports', tint: 'rgba(142,95,174,.12)', color: 'var(--maker-deep)' },
  // UX §1: last two are super_admin-only
  { to: '/audit', label: 'Audit log', tint: 'rgba(35,42,49,.08)', color: 'var(--ink)', superOnly: true },
  { to: '/settings', label: 'Settings', tint: 'rgba(35,42,49,.08)', color: 'var(--ink)', superOnly: true },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    loadReviewItems().then((items) => setReviewCount(items?.length ?? 0)).catch(() => {});
  }, [pathname]);

  const asSuper = profile?.role === 'super_admin';
  const items = NAV.filter((i) => asSuper || !i.superOnly);
  const displayName = profile?.full_name ?? '—';
  const initials = profile ? initialsOf(profile.full_name) : '·';

  return (
    <div style={{ display: 'flex', height: '100vh', minWidth: 1080 }}>
      <aside
        style={{
          width: 208,
          flex: 'none',
          background: 'var(--surface)',
          borderRight: '1px solid var(--hairline)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px' }}>
          <img src={`${import.meta.env.BASE_URL}assets/sg-logo.png`} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
          <span className="display" style={{ fontSize: 14 }}>CSG Events</span>
        </div>
        <nav style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, fontWeight: 600 }}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: '9px 12px',
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: isActive ? item.tint : 'transparent',
                color: isActive ? item.color : 'var(--text-2)',
                fontWeight: isActive ? 800 : 600,
              })}
            >
              {item.label}
              {item.to === '/review' && reviewCount != null && reviewCount > 0 && (
                <span style={{ background: 'var(--alert)', color: '#fff', borderRadius: 99, fontSize: 9.5, fontWeight: 800, padding: '2px 7px' }}>
                  {reviewCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div
          style={{
            marginTop: 'auto',
            padding: '14px 18px',
            borderTop: '1px solid var(--hairline)',
            display: 'flex',
            gap: 9,
            alignItems: 'center',
          }}
        >
          <span
            className="avatar"
            style={{ width: 28, height: 28, fontSize: 11, background: asSuper ? 'var(--dark-card)' : 'var(--maker)' }}
          >
            {initials}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
            <div style={{ fontSize: 9.5, color: asSuper ? 'var(--danger-deep)' : 'var(--muted)', fontWeight: asSuper ? 700 : 400 }}>
              {asSuper ? 'Super-admin' : 'Event maker'}
            </div>
          </div>
          <button
            onClick={() => setConfirmingSignOut(true)}
            title="Sign out"
            aria-label="Sign out"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 10.5, fontWeight: 700, padding: '8px 4px' }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>{children}</main>
      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out?"
          body="You'll need your password to sign back in."
          confirmLabel="Sign out"
          onCancel={() => setConfirmingSignOut(false)}
          onConfirm={async () => { setConfirmingSignOut(false); await signOut(); navigate('/login'); }}
        />
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  crumb,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={{ padding: '16px 22px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 'none' }}>
      <div>
        {crumb && <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{crumb}</div>}
        <div className="display" style={{ fontSize: 21, marginTop: crumb ? 2 : 0 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}
