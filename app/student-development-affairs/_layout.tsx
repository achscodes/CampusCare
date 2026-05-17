import { Stack } from 'expo-router';

/** Nested stack; add screens alongside `index.tsx`. */
export default function StudentDevelopmentAffairsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="apply" />
      <Stack.Screen name="about-scholarship" />
    </Stack>
  );
}
