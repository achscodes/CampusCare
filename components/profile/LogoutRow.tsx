import { Pressable, Text, View } from 'react-native';
import { LogoutIcon } from '@/components/icons/LogoutIcon';

type LogoutRowProps = {
  onPress: () => void;
};

/**
 * Centered logout row with red icon and text.
 */
export function LogoutRow({ onPress }: LogoutRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      className="active:opacity-60"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
      }}>
      <LogoutIcon size={24} color="#D92D20" />
      <Text style={{ fontSize: 16, fontWeight: '400', color: '#D92D20' }}>
        Logout
      </Text>
    </Pressable>
  );
}
