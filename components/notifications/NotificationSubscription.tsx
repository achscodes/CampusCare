import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useNotificationStore } from '@/lib/notifications/notificationStore';

/**
 * NotificationSubscription - Global subscription to notification realtime updates.
 * Place this in the root layout so it stays active across all screens.
 */
export function NotificationSubscription() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const subscribe = useNotificationStore((s) => s.subscribe);
  const fetchAll = useNotificationStore((s) => s.fetchAll);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) {
      // Clean up existing subscription if user logs out
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    console.log('[NotificationSubscription] Starting subscription for user:', userId);

    // Initial fetch
    fetchAll(userId);

    // Set up realtime subscription
    const unsubscribe = subscribe(userId);
    unsubscribeRef.current = unsubscribe;

    return () => {
      console.log('[NotificationSubscription] Cleaning up subscription');
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [userId, subscribe, fetchAll]);

  // Refresh when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && userId) {
        console.log('[NotificationSubscription] App active - refreshing notifications');
        fetchAll(userId);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId, fetchAll]);

  return null;
}
