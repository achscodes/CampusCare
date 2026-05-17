import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/** Set `EXPO_PUBLIC_SUPABASE_*` when you add a backend; until then the app runs without Supabase. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// TODO: Remove after debugging — verify env vars loaded
if (__DEV__) {
  console.log('[Supabase] configured:', isSupabaseConfigured, '| URL:', supabaseUrl ? supabaseUrl.slice(0, 30) + '…' : '(empty)');
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
