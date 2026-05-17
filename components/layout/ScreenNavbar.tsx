import { useNavigation, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconsaxArrowLeftIcon } from '@/components/icons/IconsaxArrowLeftIcon';
import { IconsaxMenuIcon } from '@/components/icons/IconsaxMenuIcon';

const TITLE_COLOR = '#181D27';
const DEFAULT_ICON_SIZE = 24;

export type ScreenNavbarProps = {
  /** Screen title (Figma: Heading/H2, 18px bold). */
  title: string;
  /** Optional line under the title (e.g. user name). */
  subtitle?: string;
  /** Override back behavior; default: `router.back()` or replace to tabs if nothing to pop. */
  onBackPress?: () => void;
  /** Override menu behavior when `showMenu` is true. */
  onMenuPress?: () => void;
  /** @default false — no global drawer; set true with `onMenuPress` for a custom menu. */
  showMenu?: boolean;
  className?: string;
  /** Icon size in px for both sides; default 24 (Figma). */
  iconSize?: number;
  /** Optional: different size for the back arrow only. */
  backIconSize?: number;
  /** Optional: different size for the menu icon only. */
  menuIconSize?: number;
  /** Allow long titles to wrap (Figma: Student Development & Activities). */
  titleNumberOfLines?: number;
};

/**
 * In-screen top bar (Figma 703:33544): rounded white bar, back + title + menu.
 * Uses `assets/icons/iconsax-arrow-left.svg` and `assets/icons/iconsax-menu.svg` via icon components.
 */
export function ScreenNavbar({
  title,
  subtitle,
  onBackPress,
  onMenuPress,
  showMenu = false,
  className,
  iconSize = DEFAULT_ICON_SIZE,
  backIconSize,
  menuIconSize,
  titleNumberOfLines = 1,
}: ScreenNavbarProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const backSize = backIconSize ?? iconSize;
  const menuSize = menuIconSize ?? iconSize;

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleMenu = () => {
    if (onMenuPress) {
      onMenuPress();
    }
  };

  return (
    <View className="w-full" style={{ paddingTop: insets.top }}>
      <View
        className={`w-full flex-row items-center gap-5 rounded-[24px] px-4 py-2 ${className ?? ''}`}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleBack}
          className="active:opacity-70">
          <IconsaxArrowLeftIcon color={TITLE_COLOR} size={backSize} />
        </Pressable>

        {subtitle ? (
          <View className="min-w-0 flex-1">
            <Text
              className="text-lg font-bold text-[#181D27]"
              numberOfLines={titleNumberOfLines}
              style={{ letterSpacing: 0.09 }}>
              {title}
            </Text>
            <Text className="mt-0.5 text-sm font-medium text-[#64748B]" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        ) : (
          <Text
            className="min-w-0 flex-1 text-xl font-bold text-[#181D27]"
            numberOfLines={titleNumberOfLines}
            style={{ letterSpacing: 0.09 }}>
            {title}
          </Text>
        )}

        {showMenu ? (
          <Pressable
            accessibilityLabel="Open menu"
            accessibilityRole="button"
            className="active:opacity-70"
            hitSlop={12}
            onPress={handleMenu}>
            <IconsaxMenuIcon color={TITLE_COLOR} size={menuSize} />
          </Pressable>
        ) : (
          <View style={{ width: menuSize, height: menuSize }} />
        )}
      </View>
    </View>
  );
}
