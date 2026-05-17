import { Text, View } from 'react-native';

type ProfileSectionProps = {
  title: string;
  children: React.ReactNode;
};

/**
 * Section wrapper with label and gap container.
 * Groups related menu items with a consistent label above.
 */
export function ProfileSection({ title, children }: ProfileSectionProps) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '400',
          color: '#717680',
          marginBottom: 12,
        }}>
        {title}
      </Text>
      <View style={{ gap: 16 }}>{children}</View>
    </View>
  );
}
