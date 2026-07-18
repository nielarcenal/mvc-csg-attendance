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

const AuthContext = createContext<AuthState>({
  loading: false, profile: null,
  signIn: async () => null, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(hasBackend);
  const [profile, setProfile] = useState<Profile | null>(null);

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
    if (!supabase) return 'Backend not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
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
