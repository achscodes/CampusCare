import { useRouter } from 'expo-router';
import { Image, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Text, XStack, YStack } from 'tamagui';

import { IconsaxMenuIcon } from '@/components/icons/IconsaxMenuIcon';

import profileCirclePlaceholder from '@/assets/profile-circle.png';

const AVATAR_BG = '#EAF2FF';
const SUBTITLE_COLOR = '#414651';
const TITLE_COLOR = '#1F2024';

export type TopNavigationBarProps = {
  welcomeLabel?: string;
  userName?: string;
  avatarUrl?: string | null;
  showMenuButton?: boolean;
};

export function TopNavigationBar({
  welcomeLabel = 'Welcome back,',
  userName = 'Nationalian',
  avatarUrl,
  showMenuButton = false,
}: TopNavigationBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <XStack
      gap={12}
      pt={Math.max(insets.top, 12)}
      style={{ alignItems: 'center' }}>
      <Avatar circular size={48} backgroundColor={AVATAR_BG}>
        {avatarUrl ? <Avatar.Image src={avatarUrl} /> : null}
        <Avatar.Fallback
          alignItems="center"
          backgroundColor={AVATAR_BG}
          justifyContent="center">
          <Image
            accessibilityLabel="Profile picture"
            source={profileCirclePlaceholder}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            resizeMode="cover"
          />
        </Avatar.Fallback>
      </Avatar>

      <YStack flex={1} gap={2} justifyContent="center" minWidth={0}>
        <Text
          color={SUBTITLE_COLOR}
          fontSize={14}
          fontWeight="400"
          letterSpacing={0.12}
          lineHeight={16}>
          {welcomeLabel}
        </Text>
        <Text color={TITLE_COLOR} fontSize={16} fontWeight="600" numberOfLines={1}>
          {userName}
        </Text>
      </YStack>

      {showMenuButton ? (
        <Pressable
          accessibilityLabel="Open menu"
          hitSlop={12}
          onPress={() => router.push('/(tabs)')}>
          <IconsaxMenuIcon color={TITLE_COLOR} size={36} />
        </Pressable>
      ) : (
        <YStack height={32} width={32} />
      )}
    </XStack>
  );
}
