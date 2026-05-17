import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const BRAND = SCHEDULE_PARTNER.brand;

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: SCHEDULE_PARTNER.textMuted,
          marginBottom: 6,
          marginLeft: 2,
        }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry
        placeholder={placeholder ?? '••••••••'}
        placeholderTextColor={SCHEDULE_PARTNER.textDisabled}
        style={{
          backgroundColor: SCHEDULE_PARTNER.surface,
          borderWidth: 1,
          borderColor: SCHEDULE_PARTNER.borderCell,
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          fontSize: 15,
          color: SCHEDULE_PARTNER.textPrimary,
        }}
      />
    </View>
  );
}

export default function SecurityScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSave = () => {
    if (!current || !next || !confirm) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    Alert.alert('Password Updated', 'Your password has been changed successfully.');
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="Security & Password" />
      <ScrollView
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}>
        <Text
          style={{
            marginBottom: 16,
            marginLeft: 2,
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          Change Password
        </Text>

        <PasswordField label="Current Password" value={current} onChange={setCurrent} />
        <PasswordField label="New Password" value={next} onChange={setNext} placeholder="Min. 8 characters" />
        <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} />

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save new password"
          className="active:opacity-80"
          style={{
            marginTop: 8,
            backgroundColor: BRAND,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
            Save Changes
          </Text>
        </Pressable>

        <Text
          style={{
            marginTop: 16,
            marginLeft: 2,
            fontSize: 12,
            lineHeight: 18,
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          Choose a strong password with at least 8 characters, including letters and numbers.
        </Text>
      </ScrollView>
    </View>
  );
}
