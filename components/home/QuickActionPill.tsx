import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { IconsaxCalendar2Icon } from '@/components/icons/IconsaxCalendar2Icon';
import { IconsaxMedalIcon } from '@/components/icons/IconsaxMedalIcon';
import { IconsaxTagUserIcon } from '@/components/icons/IconsaxTagUserIcon';

const ICON_COLOR = '#2970FF';

const PRESS_SPRING = { damping: 18, stiffness: 380, mass: 0.35 } as const;
const PRESS_SCALE = 0.96;
const PRESS_OPACITY = 0.92;

export type QuickActionPillIcon = 'calendar' | 'tag-user' | 'medal';

export type QuickActionPillProps = {
  label: string;
  icon: QuickActionPillIcon;
  onPress?: () => void;
  className?: string;
};

/**
 * Capsule quick action (Figma 703:33274): soft gray pill, brand-tint icon well, 14px label.
 */
const ICON_MAP = {
  calendar: IconsaxCalendar2Icon,
  'tag-user': IconsaxTagUserIcon,
  medal: IconsaxMedalIcon,
} as const;

export function QuickActionPill({ label, icon, onPress, className }: QuickActionPillProps) {
  const IconComponent = ICON_MAP[icon];
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);

  const pressVisualStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dim.value,
  }));

  return (
    <View className={className}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className="w-full overflow-hidden rounded-full active:opacity-100"
        android_ripple={{ color: 'rgba(41,112,255,0.12)', foreground: true }}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
          dim.value = withSpring(PRESS_OPACITY, PRESS_SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
          dim.value = withSpring(1, PRESS_SPRING);
        }}>
        <Animated.View
          className="w-full flex-row items-center gap-2.5 rounded-full bg-[#FAFAFA] px-3 py-2.5"
          style={pressVisualStyle}>
          <View className="size-8 items-center justify-center rounded-2xl bg-[#EFF4FF] p-0.5">
            <IconComponent color={ICON_COLOR} size={20} />
          </View>
          <Text
            className="min-w-0 flex-1 text-sm leading-8 text-[#181D27]"
            numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}
