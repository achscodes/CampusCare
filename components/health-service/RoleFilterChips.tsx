import { Pressable, Text, View } from 'react-native';

import type { StaffRole } from '../../lib/health-service/types';
import { SCHEDULE_PARTNER } from '../../lib/health-service/bookingScheduleTheme';

const ROLES: { id: StaffRole | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'doctor', label: 'Doctor' },
];

const BRAND = SCHEDULE_PARTNER.brand;

export type RoleFilterChipsProps = {
  value: StaffRole | 'all';
  onChange: (next: StaffRole | 'all') => void;
};

export function RoleFilterChips({ value, onChange }: RoleFilterChipsProps) {
  return (
    <View style={{ gap: 10 }}>
      {ROLES.map((r) => {
        const selected = value === r.id;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Filter providers: ${r.label}`}
            onPress={() => onChange(r.id)}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? BRAND : SCHEDULE_PARTNER.segmentTrackBorder,
              backgroundColor: selected ? 'rgba(41, 112, 255, 0.06)' : '#F8FAFC',
            }}
            className="active:opacity-90">
            <Text
              style={{
                fontSize: 16,
                fontWeight: selected ? '600' : '400',
                color: selected ? SCHEDULE_PARTNER.textPrimary : SCHEDULE_PARTNER.textMuted,
              }}>
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
