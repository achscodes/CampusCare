import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Request permission + register the device's Expo push token with Supabase.
 * Safe to call multiple times — upserts on (user_id, device_id).
 *
 * Requires `expo-notifications` to be installed. This function lazy-imports it
 * so the app still builds if the package is missing in dev.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  if (!Device.isDevice) return; // Skip on simulator — can't get a real token

  try {
    // Lazy-import so the app doesn't crash on missing optional dep.
    // @ts-ignore — package is installed at runtime via `npx expo install expo-notifications`
    const Notifications = await import('expo-notifications');

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] Missing EAS projectId — cannot get Expo push token');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const expo_token = tokenData.data;
    const device_id = Device.osInternalBuildId ?? Device.modelId ?? 'unknown';
    const platform = (Device.osName ?? 'unknown').toLowerCase();

    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        device_id,
        expo_token,
        platform: platform.includes('ios') ? 'ios' : platform.includes('android') ? 'android' : 'web',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    );

    if (error) {
      console.warn('[push] Failed to save token:', error);
    } else {
      console.log('[push] Token registered successfully:', expo_token.slice(0, 20) + '...');
    }
  } catch (err) {
    console.warn('[push] registerPushToken failed:', err);
  }
}
