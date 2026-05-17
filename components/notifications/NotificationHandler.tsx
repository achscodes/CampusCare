import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth/AuthProvider';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * NotificationHandler sets up push notification listeners and handles
 * incoming notifications both when the app is in foreground and background.
 */
export function NotificationHandler() {
  const router = useRouter();
  const { session } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    // Listen for notifications received while the app is in the foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[notification] Received:', notification);
      }
    );

    // Listen for user tapping on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[notification] Tapped:', data);

        // Navigate to the relevant screen if href is provided
        if (data?.href) {
          router.push(data.href as any);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [session?.user, router]);

  return null;
}
