import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { IconsaxArrowRightIcon } from '@/components/icons/IconsaxArrowRightIcon';

export type ProfileMenuRowProps = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  variant?: 'default' | 'danger';
};

/**
 * Reusable menu row component for profile screen.
 * Individual rounded card with icon, label, and chevron.
 */
export function ProfileMenuRow({
  icon,
  label,
  onPress,
  variant = 'default',
}: ProfileMenuRowProps) {
  const isDanger = variant === 'danger';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-60">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FAFAFA',
          borderRadius: 16,
          padding: 16,
          gap: 12,
        }}>
        <View style={{ width: 24, height: 24 }}>{icon}</View>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: '400',
            color: isDanger ? '#D92D20' : '#000',
          }}>
          {label}
        </Text>
        <IconsaxArrowRightIcon size={20} color={isDanger ? '#D92D20' : '#A4A7AE'} />
      </View>
    </Pressable>
  );
}
