import { ScrollView, Text, View } from 'react-native';

import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const SECTIONS = [
  {
    heading: '1. Information We Collect',
    body: 'We collect information you provide directly, such as your name, student ID, email address, year level, program, and health-related details you submit through the application. We also collect usage data to improve the application experience.',
  },
  {
    heading: '2. How We Use Your Information',
    body: 'Your information is used to provide and personalize the CampusCare experience, process appointment bookings, send campus-related notifications, manage scholarship and discipline records, and comply with institutional policies.',
  },
  {
    heading: '3. Data Sharing',
    body: 'We do not sell or rent your personal information to third parties. Your data may be shared with authorized university offices (e.g., Health Service Office, Discipline Office, SDAO) strictly for service delivery purposes.',
  },
  {
    heading: '4. Health Information',
    body: 'Health-related information submitted through the Health Service module is treated with the highest level of confidentiality. Access is restricted to authorized health service personnel only.',
  },
  {
    heading: '5. Data Retention',
    body: 'We retain your personal data for the duration of your enrollment and for a period thereafter as required by institutional records policies. You may request deletion of non-essential data by contacting the Data Privacy Officer.',
  },
  {
    heading: '6. Security',
    body: 'We implement technical and organizational measures to protect your personal information against unauthorized access, disclosure, alteration, or destruction. However, no method of transmission over the Internet is 100% secure.',
  },
  {
    heading: '7. Your Rights',
    body: 'Under applicable data privacy laws, you have the right to access, correct, and request deletion of your personal data. To exercise these rights, contact our Data Privacy Officer at privacy@campuscare.edu.ph.',
  },
  {
    heading: '8. Cookies & Analytics',
    body: 'CampusCare may use anonymized analytics to understand usage patterns and improve the application. No personally identifiable information is used for analytics purposes.',
  },
  {
    heading: '9. Changes to This Policy',
    body: 'We may update this Privacy Policy periodically. We will notify you of significant changes through the application or via your registered email. Continued use after changes implies acceptance.',
  },
  {
    heading: '10. Contact Us',
    body: 'For privacy concerns or questions, contact our Data Privacy Officer at privacy@campuscare.edu.ph or visit the Office of the Registrar during working hours.',
  },
];

export default function PrivacyScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="Privacy Policy" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
        }}>
        <Text style={{ fontSize: 11, color: SCHEDULE_PARTNER.textMuted, marginBottom: 16 }}>
          Last updated: April 2025
        </Text>

        <Text style={{ fontSize: 14, lineHeight: 21, color: SCHEDULE_PARTNER.textMuted, marginBottom: 20 }}>
          This Privacy Policy describes how CampusCare collects, uses, and protects your personal information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.heading} style={{ marginBottom: 18 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: SCHEDULE_PARTNER.textPrimary,
                marginBottom: 5,
              }}>
              {s.heading}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: SCHEDULE_PARTNER.textMuted }}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
