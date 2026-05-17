import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconsaxArrowLeftIcon } from '@/components/icons/IconsaxArrowLeftIcon';

export function AuthBackRow() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  return (
    <View className="self-start pt-0">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="flex-row items-center gap-2 rounded-3xl py-4 pr-4 pl-4"
        onPress={handleBack}>
        <IconsaxArrowLeftIcon size={20} color="#181D27" />
        <Text className="text-md font-semibold leading-5 text-[#181D27]">Back</Text>
      </Pressable>
    </View>
  );
}
