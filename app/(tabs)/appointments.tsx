import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { Container } from '@/components/Container';

export default function AppointmentsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Appointments',
          headerBackTitleVisible: false,
        }}
      />
      <Container>
        <View className="px-1">
          <Text className="text-base text-[#535862]">
            Your full appointment list will appear here.
          </Text>
        </View>
      </Container>
    </>
  );
}
