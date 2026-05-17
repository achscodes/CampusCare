import { Stack } from 'expo-router';

/**
 * Nested stack for Discipline Office: add routes as files next to `index.tsx`
 * (e.g. `detail.tsx` → `/discipline-office/detail`).
 */
export default function DisciplineOfficeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitleVisible: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="incident-report" />
      <Stack.Screen name="upload-proof" />
      <Stack.Screen name="nte-response" />
      <Stack.Screen name="my-cases" />
      <Stack.Screen name="statement-of-explanation" />
      <Stack.Screen name="my-sanctions" />
    </Stack>
  );
}
