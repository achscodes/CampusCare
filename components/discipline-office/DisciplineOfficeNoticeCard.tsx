import { Text, View } from 'react-native';

import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const BRAND = SCHEDULE_PARTNER.brand;

export type DisciplineOfficeNoticeCardProps = {
  /** When true, no outer border — for use inside a parent card with a shared outline. */
  embedded?: boolean;
};

/**
 * Single static notice (Health Service announcement styling, without carousel) — keeps the hub calm and readable.
 */
export function DisciplineOfficeNoticeCard({ embedded = false }: DisciplineOfficeNoticeCardProps) {
  return (
    <View
      style={{
        borderRadius: embedded ? 0 : 16,
        borderWidth: embedded ? 0 : 1,
        borderColor: SCHEDULE_PARTNER.cardBorder,
        backgroundColor: embedded ? 'transparent' : SCHEDULE_PARTNER.surface,
        paddingVertical: embedded ? 16 : 14,
        paddingHorizontal: 16,
      }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: BRAND,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}>
        Student conduct
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 15,
          fontWeight: '700',
          color: SCHEDULE_PARTNER.textPrimary,
          lineHeight: 21,
          letterSpacing: -0.2,
        }}>
        Reports are reviewed fairly. You can track your case steps and sanctions here.
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: '400',
          color: SCHEDULE_PARTNER.textMuted,
          lineHeight: 19,
        }}>
        Demo data only — replace with your campus process when backend is connected.
      </Text>
    </View>
  );
}
