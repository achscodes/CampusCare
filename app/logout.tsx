import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

/** Fallback when opened by URL (e.g. deep link to `/logout`). */
export default function LogoutScreen() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      await supabase?.auth.signOut();
      router.replace('/(auth)');
    })();
  }, [router]);

  return <Stack.Screen options={{ headerShown: false, title: 'Logout' }} />;
}
