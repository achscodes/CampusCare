import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

/**
 * Native system tab bar (iOS `UITabBar` / Android Material tabs via `react-native-screens`).
 * @see https://docs.expo.dev/router/advanced/native-tabs/
 */
export default function TabLayout() {
  return (
    <NativeTabs blurEffect="systemDefault">
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notification">
        <Label>Notification</Label>
        <Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profiles">
        <Label>Profile</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="appointments" hidden>
        <Label>Appointments</Label>
        <Icon sf={{ default: 'calendar', selected: 'calendar' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
