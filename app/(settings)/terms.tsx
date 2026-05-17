import { ScrollView, Text, View } from 'react-native';

import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By accessing or using CampusCare, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the application.',
  },
  {
    heading: '2. Use of the Application',
    body: 'CampusCare is intended solely for enrolled students, faculty, and authorized staff of the institution. You agree to use the application only for lawful purposes and in accordance with these Terms.',
  },
  {
    heading: '3. Account Responsibilities',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. Any activity conducted under your account is your responsibility. Report unauthorized access immediately to the IT Support Office.',
  },
  {
    heading: '4. Health & Welfare Services',
    body: 'Information provided through the Health Service and Welfare modules is for campus coordination purposes only. CampusCare does not replace professional medical advice, diagnosis, or treatment.',
  },
  {
    heading: '5. Data Accuracy',
    body: 'You agree to provide accurate and current information when using the application. Providing false or misleading information may result in suspension of access and appropriate disciplinary action.',
  },
  {
    heading: '6. Intellectual Property',
    body: 'All content, design, logos, and features within CampusCare are the intellectual property of the institution. You may not reproduce, distribute, or modify any part of the application without prior written consent.',
  },
  {
    heading: '7. Limitation of Liability',
    body: 'The institution and its affiliates shall not be liable for any indirect, incidental, or consequential damages arising from your use of the application or inability to access it.',
  },
  {
    heading: '8. Modifications',
    body: 'We reserve the right to update these Terms at any time. Continued use of the application after changes constitutes your acceptance of the revised Terms.',
  },
  {
    heading: '9. Contact',
    body: 'For questions regarding these Terms, please contact the Office of the Registrar or the IT Support Office at support@campuscare.edu.ph.',
  },
];

export default function TermsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="Terms & Conditions" />
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
          Please read these Terms and Conditions carefully before using the CampusCare mobile application.
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
