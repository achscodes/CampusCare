import { ScrollView, Text, View } from 'react-native';

import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const FIELDS: { label: string; value: string }[] = [
  { label: 'Full Name', value: 'Juan Dela Cruz' },
  { label: 'Student ID', value: '2024-000123' },
  { label: 'Email', value: 'j.delacruz@student.edu.ph' },
  { label: 'Program', value: 'BS Computer Science' },
  { label: 'Year Level', value: '2nd Year' },
  { label: 'Section', value: 'CS-201' },
  { label: 'College', value: 'College of Engineering & Technology' },
];

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: SCHEDULE_PARTNER.divider,
        backgroundColor: SCHEDULE_PARTNER.surface,
        gap: 2,
      }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: SCHEDULE_PARTNER.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: SCHEDULE_PARTNER.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

export default function PersonalInfoScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="Personal Information" />
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
            marginLeft: 2,
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          Student Details
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.cardBorder,
            overflow: 'hidden',
          }}>
          {FIELDS.map((f, i) => (
            <InfoRow key={f.label} label={f.label} value={f.value} isLast={i === FIELDS.length - 1} />
          ))}
        </View>

        <Text
          style={{
            marginTop: 16,
            marginLeft: 2,
            fontSize: 12,
            lineHeight: 18,
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          To update your personal information, please coordinate with the Registrar's Office.
        </Text>
      </ScrollView>
    </View>
  );
}
