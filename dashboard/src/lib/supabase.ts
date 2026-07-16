import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Backend is optional: without env config every page falls back to the
// demo dataset in src/data/mock.ts, so the app still runs standalone.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const hasBackend = supabase !== null;
