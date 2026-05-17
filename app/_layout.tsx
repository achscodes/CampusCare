import '../global.css';
import { useFonts } from 'expo-font';
import { HeroUINativeProvider } from 'heroui-native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { UniwindInsetSync } from '@/components/UniwindInsetSync';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { NotificationHandler } from '@/components/notifications/NotificationHandler';
import { NotificationSubscription } from '@/components/notifications/NotificationSubscription';
import { tamaguiConfig } from '../tamagui.config';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    InstrumentSans: require('../assets/fonts/InstrumentSans-Variable.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  const themeName = colorScheme === 'dark' ? 'dark' : 'light';
  const rootBackgroundColor = colorScheme === 'dark' ? '#000000' : '#FFFFFF';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: rootBackgroundColor }}>
      <HeroUINativeProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme={themeName}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <AuthProvider>
              <NotificationHandler />
              <NotificationSubscription />
              <UniwindInsetSync />
              <Stack
                screenOptions={{
                  contentStyle: { flex: 1 },
                  headerShown: false,
                  /** Avoid iOS back labels derived from route segment names like `(tabs)`. */
                  headerBackTitleVisible: false,
                }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="student-development-affairs" />
                <Stack.Screen name="discipline-office" />
                <Stack.Screen name="health-service" />
                <Stack.Screen name="referrals" />
                <Stack.Screen name="my-scholarship" />
                <Stack.Screen name="logout" />
                <Stack.Screen name="(settings)" />
                <Stack.Screen
                  name="modal"
                  options={{ headerShown: true, title: 'Modal', presentation: 'modal' }}
                />
              </Stack>
              </AuthProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </TamaguiProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
