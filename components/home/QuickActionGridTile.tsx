import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { SCHEDULE_PARTNER } from '@/lib/ui/theme';

const ICON_WELL = 'rgba(41, 112, 255, 0.12)';
const ICON_COLOR = SCHEDULE_PARTNER.brand;
const RIPPLE = 'rgba(41, 112, 255, 0.12)';

const PRESS_SPRING = { damping: 20, stiffness: 420, mass: 0.32 } as const;
const PRESS_SCALE = 0.97;
const PRESS_OPACITY = 0.94;

export type QuickActionIconProps = {
  size?: number;
  color?: string;
};

export type QuickActionGridTileProps = {
  label: string;
  Icon: ComponentType<QuickActionIconProps>;
  onPress?: () => void;
  className?: string;
};

/**
 * Compact quick-action tile: one brand accent, white surface, light border and shadow.
 */
export function QuickActionGridTile({ label, Icon, onPress, className }: QuickActionGridTileProps) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);

  const pressVisualStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dim.value,
  }));

  return (
    <View className={`min-w-0 flex-1 opacity-95 ${className ?? ''}`}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className="w-full active:opacity-100"
        android_ripple={{ color: RIPPLE, foreground: true }}
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
          className="w-full overflow-hidden rounded-2xl px-4 pb-4 pt-4"
          style={[
            pressVisualStyle,
            {
              backgroundColor: SCHEDULE_PARTNER.surface,
              minHeight: 110,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
              borderWidth: 1,
              borderColor: '#FFFFFF',
            },
          ]}>
          {/* Soft gradient wash — bottom-right corner */}
          <LinearGradient
            colors={['transparent', 'rgba(41, 112, 255, 0.04)', 'rgba(41, 112, 255, 0.08)']}
            locations={[0.2, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View className="items-start">
            <Icon color={ICON_COLOR} size={48} />
          </View>
          <View className="mt-4">
            <Text
              className="text-[14px] font-semibold leading-4"
              style={{ color: SCHEDULE_PARTNER.textPrimary }}
              numberOfLines={2}>
              {label}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
