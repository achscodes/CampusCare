import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { registerPushToken } from '@/lib/notifications/registerPushToken';
import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';

/** Extract tokens from a Supabase magic-link redirect URL hash fragment. */
function extractTokensFromUrl(url: string) {
  const hash = url.split('#')[1];
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { access_token, refresh_token };
  return null;
}

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  isConfigured: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    // Auto-refresh token when app comes to foreground
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase!.auth.startAutoRefresh();
      } else {
        supabase!.auth.stopAutoRefresh();
      }
    });

    // Handle incoming deep-link URLs (magic link callback)
    const handleUrl = async (event: { url: string }) => {
      const tokens = extractTokensFromUrl(event.url);
      if (tokens) {
        await supabase!.auth.setSession(tokens);
      }
    };

    // Check if the app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    // Listen for links while the app is open
    const linkSub = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.unsubscribe();
      appStateListener.remove();
      linkSub.remove();
    };
  }, []);

  // Register Expo push token with Supabase whenever we have a session.
  useEffect(() => {
    if (session?.user?.id) {
      registerPushToken(session.user.id);
    }
  }, [session?.user?.id]);

  // Pre-fetch scholarship data right after login so detail screen opens instantly.
  const { fetchPrograms, fetchMyApplications, fetchMyEnrollment, reset: resetScholarships } = useScholarshipStore();
  useEffect(() => {
    if (session?.user?.id) {
      fetchPrograms();
      fetchMyApplications();
      fetchMyEnrollment();
    } else if (session === null && !isLoading) {
      resetScholarships();
    }
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider value={{ session, isLoading, isConfigured: isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
