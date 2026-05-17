import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconsaxArrowLeftIcon } from '@/components/icons/IconsaxArrowLeftIcon';

export type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  paddingBottom?: number;
  align?: 'center' | 'flex-start';
  subtitleLines?: number;
};

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  paddingBottom = 24,
  align = 'center',
  subtitleLines,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: align,
        gap: 16,
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={handleBack}
        className="active:opacity-70"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#F5F5F5',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <IconsaxArrowLeftIcon size={20} color="#181D27" />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '600',
            color: '#000000',
            letterSpacing: -0.48,
          }}>
          {title}
        </Text>
        <Text
          numberOfLines={subtitleLines}
          style={{
            fontSize: 14,
            fontWeight: '300',
            color: '#535862',
            letterSpacing: -0.28,
            lineHeight: 20,
          }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
