import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View } from 'react-native';

export default function Modal() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">Modal</Text>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
