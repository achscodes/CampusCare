import { Text } from 'react-native';
import { useNotificationStore } from '@/lib/notifications/notificationStore';

/**
 * NotificationBadge - Renders the badge count for the notification tab.
 * Use this as the badge prop in NativeTabs.Trigger.
 */
export function NotificationBadge() {
  const unreadCount = useNotificationStore((s) => s.unreadCount());

  if (unreadCount === 0) return null;

  return (
    <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </Text>
  );
}
