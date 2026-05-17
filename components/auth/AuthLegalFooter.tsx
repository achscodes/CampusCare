import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

type AuthLegalFooterProps = {
  /** Extra margin above legal copy (default: stacked below form). */
  topSpacing?: boolean;
};

export function AuthLegalFooter({ topSpacing = true }: AuthLegalFooterProps) {
  const router = useRouter();

  const openTerms = () => router.push('/terms');
  const openPrivacy = () => router.push('/privacy');

  return (
    <>
      <View className={`${topSpacing ? 'mt-6' : 'mt-0'} items-center gap-0.5 px-1`}>
        <Text className="text-center text-sm leading-5 text-[#71727A]">
          <Text>By continuing, you accept our </Text>
          <Text className="font-medium underline" onPress={openTerms}>
            Terms & Condition
          </Text>
          <Text> and </Text>
        </Text>
        <Pressable onPress={openPrivacy}>
          <Text className="text-sm font-medium leading-5 text-[#71727A] underline">Privacy Policy</Text>
        </Pressable>
      </View>
    </>
  );
}
