import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SCHEDULE_PARTNER } from '../../lib/health-service/bookingScheduleTheme';
import type { Appointment } from '../../lib/health-service/types';
import { IconsaxCalendar2Icon } from '../icons/IconsaxCalendar2Icon';

const BRAND = SCHEDULE_PARTNER.brand;

type Props = {
  appointment: Appointment;
  staffName: string;
  whenLabel: string;
  onPress: () => void;
};

export function AppointmentListCard({ appointment, staffName, whenLabel, onPress }: Props) {
  const pending = appointment.status === 'pending';
  const accent = pending ? '#F59E0B' : BRAND;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Appointment with ${staffName}, ${whenLabel}${pending ? ', pending' : ''}. Open details.`}
      onPress={onPress}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: SCHEDULE_PARTNER.segmentTrackBorder,
        backgroundColor: '#FFFFFF',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
      className="active:opacity-92">
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: SCHEDULE_PARTNER.textPrimary }} numberOfLines={1}>
            {staffName}
          </Text>
          {pending ? (
            <View style={{ borderRadius: 999, backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#B45309' }}>PENDING</Text>
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconsaxCalendar2Icon size={18} color={SCHEDULE_PARTNER.textMuted} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: SCHEDULE_PARTNER.textMuted, flex: 1 }} numberOfLines={2}>
            {whenLabel}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C5C6CC" />
    </Pressable>
  );
}
