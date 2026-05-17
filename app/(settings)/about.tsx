import { ScrollView, Text, View } from 'react-native';

import { AppLogoIcon } from '@/components/icons/AppLogoIcon';
import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const BRAND = SCHEDULE_PARTNER.brand;

const FEATURES = [
  { label: 'Health Service Office', detail: 'Book appointments and manage health records' },
  { label: 'Student Development', detail: 'Scholarships, opportunities, and campus events' },
  { label: 'Discipline Office', detail: 'Case tracking and conduct management' },
  { label: 'Referrals', detail: 'Office-to-office referral coordination' },
];

export default function AboutScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="About CampusCare" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}>
        {/* App identity block */}
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.cardBorder,
            backgroundColor: SCHEDULE_PARTNER.surface,
            padding: 20,
            alignItems: 'center',
            gap: 10,
          }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: 'rgba(41,112,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <AppLogoIcon width={40} height={38} />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: SCHEDULE_PARTNER.textPrimary,
              letterSpacing: -0.2,
            }}>
            CampusCare
          </Text>
          <Text style={{ fontSize: 13, color: SCHEDULE_PARTNER.textMuted }}>Version 1.0.0</Text>
          <View
            style={{
              backgroundColor: 'rgba(41,112,255,0.08)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
            }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: BRAND }}>
              Student Welfare Platform
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text
          style={{
            marginTop: 20,
            marginLeft: 4,
            fontSize: 15,
            fontWeight: '500',
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          What is CampusCare?
        </Text>
        <View
          style={{
            marginTop: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.cardBorder,
            backgroundColor: SCHEDULE_PARTNER.surface,
            padding: 14,
          }}>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: SCHEDULE_PARTNER.textMuted,
            }}>
            CampusCare is a centralized student welfare application designed to streamline access to campus services. It connects students with the Health Service Office, Student Development and Activities Office, Discipline Office, and more — all in one place.
          </Text>
        </View>

        {/* Features */}
        <Text
          style={{
            marginTop: 20,
            marginLeft: 4,
            fontSize: 15,
            fontWeight: '500',
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          Services
        </Text>
        <View
          style={{
            marginTop: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.cardBorder,
            overflow: 'hidden',
          }}>
          {FEATURES.map((f, i) => (
            <View
              key={f.label}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: i === FEATURES.length - 1 ? 0 : 1,
                borderBottomColor: SCHEDULE_PARTNER.divider,
                backgroundColor: SCHEDULE_PARTNER.surface,
                gap: 2,
              }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: SCHEDULE_PARTNER.textPrimary }}>
                {f.label}
              </Text>
              <Text style={{ fontSize: 13, color: SCHEDULE_PARTNER.textMuted }}>{f.detail}</Text>
            </View>
          ))}
        </View>

        {/* Build info */}
        <Text
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 11,
            color: SCHEDULE_PARTNER.textDisabled,
          }}>
          CampusCare v1.0.0 · Build 2025.04
        </Text>
      </ScrollView>
    </View>
  );
}
