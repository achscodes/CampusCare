import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const BRAND = SCHEDULE_PARTNER.brand;

type ToggleItem = {
  id: string;
  label: string;
  description: string;
};

const PUSH_TOGGLES: ToggleItem[] = [
  {
    id: 'appointments',
    label: 'Appointment Reminders',
    description: 'Upcoming and cancelled bookings',
  },
  {
    id: 'announcements',
    label: 'Campus Announcements',
    description: 'Important school-wide updates',
  },
  {
    id: 'scholarships',
    label: 'Scholarship Updates',
    description: 'New openings and application status',
  },
  {
    id: 'discipline',
    label: 'Discipline Notices',
    description: 'Case updates and hearing schedules',
  },
  {
    id: 'health',
    label: 'Health Alerts',
    description: 'Clinic announcements and health notices',
  },
];

function ToggleRow({
  item,
  value,
  onToggle,
  isLast,
}: {
  item: ToggleItem;
  value: boolean;
  onToggle: (id: string, v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: SCHEDULE_PARTNER.divider,
        backgroundColor: SCHEDULE_PARTNER.surface,
        gap: 12,
      }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: SCHEDULE_PARTNER.textPrimary }}>{item.label}</Text>
        <Text style={{ fontSize: 12, color: SCHEDULE_PARTNER.textMuted, marginTop: 2 }}>
          {item.description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => onToggle(item.id, v)}
        trackColor={{ false: SCHEDULE_PARTNER.borderCell, true: BRAND }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PUSH_TOGGLES.map((t) => [t.id, true]))
  );

  const handleToggle = (id: string, value: boolean) => {
    setEnabled((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="Notification Settings" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}>
        <Text
          style={{
            marginBottom: 8,
            marginLeft: 4,
            fontSize: 15,
            fontWeight: '500',
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          Push Notifications
        </Text>
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.cardBorder,
            overflow: 'hidden',
          }}>
          {PUSH_TOGGLES.map((item, i) => (
            <ToggleRow
              key={item.id}
              item={item}
              value={enabled[item.id] ?? true}
              onToggle={handleToggle}
              isLast={i === PUSH_TOGGLES.length - 1}
            />
          ))}
        </View>

        <Text
          style={{
            marginTop: 14,
            marginLeft: 4,
            fontSize: 12,
            lineHeight: 18,
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          You can manage notification permissions in your device's System Settings.
        </Text>
      </ScrollView>
    </View>
  );
}
