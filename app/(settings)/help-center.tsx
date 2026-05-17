import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { IconsaxArrowDownIcon } from '@/components/icons/IconsaxArrowDownIcon';
import { IconsaxArrowUpIcon } from '@/components/icons/IconsaxArrowUpIcon';
import { ScreenNavbar } from '@/components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

type FAQItem = { q: string; a: string };

const FAQS: FAQItem[] = [
  {
    q: 'How do I book an appointment?',
    a: 'Go to the Health Service tab, choose a provider, select a date and time slot, then confirm your booking. You will receive a notification once confirmed.',
  },
  {
    q: 'Can I cancel a booked appointment?',
    a: 'Yes. Open the appointment from the Health Service screen and tap "Cancel Appointment." Cancellations must be made at least 2 hours before the scheduled time.',
  },
  {
    q: 'How do I apply for a scholarship?',
    a: 'Navigate to the Student Development tab and tap "Apply for a Scholarship." Fill in the required details and submit your application. Track its status from the same screen.',
  },
  {
    q: 'What should I do if I receive a discipline notice?',
    a: 'Read the notice carefully and respond within the deadline indicated. You may access the Discipline Office tab for details, or visit the office in person during working hours.',
  },
  {
    q: 'Why is my account not loading data?',
    a: 'Ensure you have a stable internet connection. If the issue persists, try signing out and signing back in via your magic link email. Contact IT Support if the problem continues.',
  },
  {
    q: 'How do I update my personal information?',
    a: 'Your academic information is managed by the Registrar\'s Office. For corrections, visit the Registrar with a valid ID and supporting documents.',
  },
  {
    q: 'Is my health data kept private?',
    a: 'Yes. Health-related information is strictly confidential and only accessible to authorized Health Service Office personnel. See our Privacy Policy for full details.',
  },
];

function FAQRow({ item, isLast }: { item: FAQItem; isLast?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: SCHEDULE_PARTNER.divider,
        backgroundColor: SCHEDULE_PARTNER.surface,
      }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        className="active:opacity-70"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 13,
          paddingHorizontal: 14,
          gap: 10,
        }}>
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '500',
            color: SCHEDULE_PARTNER.textPrimary,
            lineHeight: 20,
          }}>
          {item.q}
        </Text>
        {open ? (
          <IconsaxArrowUpIcon size={16} color={SCHEDULE_PARTNER.textMuted} />
        ) : (
          <IconsaxArrowDownIcon size={16} color={SCHEDULE_PARTNER.textMuted} />
        )}
      </Pressable>
      {open && (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
          }}>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: SCHEDULE_PARTNER.textMuted,
            }}>
            {item.a}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function HelpCenterScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenNavbar title="Help Center" />
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
          Frequently Asked Questions
        </Text>
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.cardBorder,
            overflow: 'hidden',
          }}>
          {FAQS.map((item, i) => (
            <FAQRow key={item.q} item={item} isLast={i === FAQS.length - 1} />
          ))}
        </View>

        <Text
          style={{
            marginTop: 20,
            marginLeft: 4,
            fontSize: 13,
            lineHeight: 19,
            color: SCHEDULE_PARTNER.textMuted,
          }}>
          Still need help? Reach us at{' '}
          <Text style={{ color: SCHEDULE_PARTNER.brand, fontWeight: '500' }}>
            support@campuscare.edu.ph
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}
