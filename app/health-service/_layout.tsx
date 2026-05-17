import { Stack } from 'expo-router';

/** Nested stack; add screens alongside `index.tsx` (e.g. `detail.tsx`). */
export default function HealthServiceLayout() {
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
