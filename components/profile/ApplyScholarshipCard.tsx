import { Pressable, Text, View } from 'react-native';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

type ApplyScholarshipCardProps = {
  onPress: () => void;
};

/**
 * Card shown when student has no scholarship.
 * Displays "Apply for Scholarship" button.
 */
export function ApplyScholarshipCard({ onPress }: ApplyScholarshipCardProps) {
  return (
    <View
      style={{
        marginTop: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: SCHEDULE_PARTNER.cardBorder,
        backgroundColor: SCHEDULE_PARTNER.surface,
        paddingVertical: 14,
        paddingHorizontal: 14,
      }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Apply for scholarship"
        style={{
          backgroundColor: '#2970FF',
          borderRadius: 24,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#b2ccff',
          marginBottom: 4,
        }}
        className="active:opacity-80">
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#FFFFFF',
            letterSpacing: -0.64,
          }}>
          Apply for Scholarship
        </Text>
      </Pressable>
    </View>
  );
}
