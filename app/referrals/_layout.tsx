import { Stack } from 'expo-router';

/** Nested stack; add screens alongside `index.tsx`. */
export default function ReferralsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitleVisible: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
