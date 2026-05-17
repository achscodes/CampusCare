import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconsaxNotificationIcon } from '@/components/icons/IconsaxNotificationIcon';
import { useNotificationStore } from '@/lib/notifications/notificationStore';

import profileCirclePlaceholder from '@/assets/profile-circle.png';

const ICON_MUTED = '#1F2024';

export type HomeScreenHeaderProps = {
  /** Large title (reference UI uses a single word like “Lessons”). */
  title?: string;
  avatarUrl?: string | null;
};

/**
 * Home top bar: bold title + notification + profile (reference lesson-app hero layout).
 */
export function HomeScreenHeader({ title = 'Home', avatarUrl }: HomeScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const unreadCount = useNotificationStore((s) => s.items.filter((n) => !n.read).length);

  return (
    <View
      className="w-full flex-row items-center justify-between pb-2 pl-1"
      style={{ paddingTop: Math.max(8) }}>
      <Text className="text-[32px] font-bold leading-9 text-[#1F2024]">{title}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel="Notifications"
          accessibilityRole="button"
          hitSlop={10}
          className="size-11 items-center justify-center rounded-full bg-white border border-black/5"
          onPress={() => router.push('/(tabs)/notification')}>
          <IconsaxNotificationIcon size={22} color={ICON_MUTED} />
          {unreadCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: '#EF4444',
                borderWidth: 1.5,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}>
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  lineHeight: 12,
                }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Profile"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.push('/(tabs)/profiles')}
          style={{ width: 44, height: 44, borderRadius: 24, borderWidth: 1, borderColor: '#FFFFFF' }}>
          <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden' }}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : profileCirclePlaceholder}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
