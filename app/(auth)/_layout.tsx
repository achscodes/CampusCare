import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

/**
 * Unauthenticated routes (login, register, forgot-password, etc.).
 * The `(auth)` segment is omitted from the URL — e.g. this stack serves `/login`.
 */
export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const sceneBackground = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: sceneBackground },
      }}>
      {/* Get Started — full screen card */}
      <Stack.Screen
        name="index"
        options={{ animation: 'fade' }}
      />
      {/* Login & Signup — transparent route so custom BottomSheetModal can animate in */}
      <Stack.Screen
        name="login"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
