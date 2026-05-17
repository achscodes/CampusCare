import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export type AuthSegment = 'login' | 'signup';

type AuthSegmentedNavProps = {
  active: AuthSegment;
  /** Extra classes on the track (e.g. `mt-0` for register screen spacing). */
  className?: string;
};

export function AuthSegmentedNav({ active, className }: AuthSegmentedNavProps) {
  const router = useRouter();

  return (
    <View
      className={`mt-4 h-12 w-full flex-row rounded-full bg-[#F5F5F5] p-1 ${className ?? ''}`}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'login' }}
        className={`flex-1 items-center justify-center rounded-[20px] px-2.5 py-0.5 ${
          active === 'login' ? 'bg-white' : ''
        }`}
        onPress={() => router.replace('/login')}>
        <Text
          className={`text-center text-sm ${
            active === 'login' ? 'font-semibold text-[#181D27]' : 'font-medium text-[#717680]'
          }`}>
          Login
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'signup' }}
        className={`flex-1 items-center justify-center rounded-[20px] px-2.5 py-0.5 ${
          active === 'signup' ? 'bg-white' : ''
        }`}
        onPress={() => router.replace('/signup')}>
        <Text
          className={`text-center text-sm ${
            active === 'signup' ? 'font-semibold text-[#181D27]' : 'font-medium text-[#717680]'
          }`}>
          Sign Up
        </Text>
      </Pressable>
    </View>
  );
}
