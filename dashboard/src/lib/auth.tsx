import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, hasBackend } from './supabase';

export interface Profile {
  id: string;
  role: 'super_admin' | 'event_maker' | 'checker' | 'student';
  full_name: string;
  email: string;
}

interface AuthState {
  loading: boolean;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<string | null>; // error msg
  signOut: () => Promise<void>;
}

// Demo profile used when no backend is configured (mirrors the mocks).
const DEMO_PROFILE: Profile = {
  id: 'demo', role: 'event_maker', full_name: 'Uy, Rica S.', email: 'r.uy@mvc.edu.ph',
};

const AuthContext = createContext<AuthState>({
  loading: false, profile: DEMO_PROFILE,
  signIn: async () => null, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(hasBackend);
  const [profile, setProfile] = useState<Profile | null>(hasBackend ? null : DEMO_PROFILE);

  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const load = async (userId: string | undefined) => {
      if (!userId) { setProfile(null); setLoading(false); return; }
      const { data } = await sb
        .from('profiles').select('id, role, full_name, email').eq('id', userId).single();
      setProfile((data as Profile) ?? null);
      setLoading(false);
    };
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => load(session?.user.id));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return null; // demo mode: any credentials work
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signOut = async () => { await supabase?.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ loading, profile, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Staff-only gate: checkers/students have their own apps.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, profile } = useAuth();
  const location = useLocation();
  if (!hasBackend) return <>{children}</>;
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-2)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (!profile || !['super_admin', 'event_maker'].includes(profile.role)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
