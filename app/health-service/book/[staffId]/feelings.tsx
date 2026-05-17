import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HealthBookingFeelingGroup,
  HEALTH_BOOKING_FEELING_OPTIONS,
} from '../../../../components/health-service/HealthBookingDateStrip';
import { IconsaxCalendarIcon } from '../../../../components/icons/IconsaxCalendarIcon';
import { IconsaxClockIcon } from '../../../../components/icons/IconsaxClockIcon';
import { IconsaxHourglassIcon } from '../../../../components/icons/IconsaxHourglassIcon';
import { IconsaxStickynoteIcon } from '../../../../components/icons/IconsaxStickynoteIcon';
import { IconsaxTagUserIcon } from '../../../../components/icons/IconsaxTagUserIcon';
import { HealthServiceScreenShell } from '../../../../components/health-service/HealthServiceScreenShell';
import { ScreenNavbar } from '../../../../components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '../../../../lib/health-service/bookingScheduleTheme';
import { useHealthServiceStore } from '../../../../lib/health-service/healthServiceStore';

const BRAND = '#2970FF';
const ICON_TINT = 'rgba(41, 112, 255, 0.12)';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

export default function HealthServiceBookFeelingsScreen() {
  const insets = useSafeAreaInsets();
  const { bookAppointment, staff: allStaff } = useHealthServiceStore();
  const { staffId, dateKey, slot } = useLocalSearchParams<{
    staffId: string;
    dateKey: string;
    slot: string;
  }>();

  const slotLabel = useMemo(() => {
    if (!slot) return '';
    try {
      return decodeURIComponent(String(slot));
    } catch {
      return String(slot);
    }
  }, [slot]);

  const visitDay = useMemo(() => (dateKey ? parseDateKey(String(dateKey)) : null), [dateKey]);
  const staff = useMemo(() => (staffId ? allStaff.find((s) => s.id === staffId) : undefined), [staffId, allStaff]);

  const [feelingIds, setFeelingIds] = useState<string[]>([]);
  const [visitComments, setVisitComments] = useState('');

  const onSubmit = useCallback(async () => {
    if (!staff || !visitDay || !slotLabel) return;
    
    const feelingLabels = feelingIds
      .map((id) => HEALTH_BOOKING_FEELING_OPTIONS.find((o) => o.id === id)?.label)
      .filter(Boolean)
      .join(', ');
    
    const symptoms = [
      feelingLabels ? `Symptoms / concerns: ${feelingLabels}` : null, 
      visitComments.trim() ? `Comments: ${visitComments.trim()}` : null
    ]
      .filter(Boolean)
      .join('\n') || undefined;

    const extra = symptoms || 'No extra symptoms or comments added.';

    Alert.alert(
      'Submit booking request?',
      `Request ${slotLabel} on ${visitDay.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })} with ${staff.name}?\n\n${extra}\n\nA provider will review it before it is confirmed. Once confirmed, an arrival ticket is created automatically.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await bookAppointment({
                staffId: staff.id,
                day: visitDay,
                startLabel: slotLabel,
                symptoms,
              });
              Alert.alert(
                'Request sent',
                'Your booking is pending provider review. You will see it under My appointments with a Pending status. After approval, your visit is confirmed and a ticket is added automatically.',
                [{ text: 'OK', onPress: () => router.replace('/health-service') }],
              );
            } catch (error) {
              Alert.alert(
                'Booking failed',
                error instanceof Error ? error.message : 'Failed to book appointment. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ],
    );
  }, [staff, visitDay, slotLabel, bookAppointment, feelingIds, visitComments]);

  if (!staff || !visitDay || !slotLabel) {
    return (
      <HealthServiceScreenShell>
        <ScreenNavbar title="Visit details" onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[#535862]">Missing visit information. Go back and choose a time slot.</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="font-semibold text-[#2970FF]">Go back</Text>
          </Pressable>
        </View>
      </HealthServiceScreenShell>
    );
  }

  const weekdayLine = visitDay.toLocaleDateString(undefined, { weekday: 'long' });
  const dateLine = visitDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <HealthServiceScreenShell>
      <View className="flex-1">
        <ScreenNavbar title="Consultation Form" onBackPress={() => router.back()} className="mb-4" />
        <ScrollView
          className="flex-1 bg-transparent"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 120 + Math.max(insets.bottom, 8),
          }}>
          <View
            style={{
              borderRadius: SCHEDULE_PARTNER.radius,
              borderWidth: 1,
              borderColor: SCHEDULE_PARTNER.cardBorder,
              backgroundColor: SCHEDULE_PARTNER.surface,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 16,
              overflow: 'hidden',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: SCHEDULE_PARTNER.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}>
                  Appointment summary
                </Text>
                <Text style={{ marginTop: 2, fontSize: 13, fontWeight: '500', color: '#94A3B8' }}>School clinic · review before confirm</Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 14,
                marginBottom: 4,
                height: 1,
                backgroundColor: SCHEDULE_PARTNER.divider,
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: ICON_TINT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <IconsaxTagUserIcon size={22} color={BRAND} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: SCHEDULE_PARTNER.textMuted }}>Provider</Text>
                <Text style={{ marginTop: 2, fontSize: 18, fontWeight: '700', color: SCHEDULE_PARTNER.textPrimary, letterSpacing: -0.2 }} numberOfLines={2}>
                  {staff.name}
                </Text>
                <Text style={{ marginTop: 3, fontSize: 13, color: '#64748B' }} numberOfLines={2}>
                  {staff.specialtyLabel}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: ICON_TINT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <IconsaxCalendarIcon size={20} color={BRAND} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: SCHEDULE_PARTNER.textMuted }}>Date</Text>
                <Text style={{ marginTop: 2, fontSize: 16, fontWeight: '700', color: SCHEDULE_PARTNER.textPrimary }}>{weekdayLine}</Text>
                <Text style={{ marginTop: 2, fontSize: 14, fontWeight: '500', color: '#64748B' }}>{dateLine}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: ICON_TINT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <IconsaxClockIcon size={22} color={BRAND} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: SCHEDULE_PARTNER.textMuted }}>Time</Text>
                <View
                  style={{
                    marginTop: 6,
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: 'rgba(41, 112, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(41, 112, 255, 0.2)',
                  }}>
                  <IconsaxHourglassIcon size={17} color={BRAND} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND, letterSpacing: -0.2 }}>{slotLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mt-6">
            <HealthBookingFeelingGroup
              selectedIds={feelingIds}
              onSelectedIdsChange={setFeelingIds}
              comments={visitComments}
              onCommentsChange={setVisitComments}
            />
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 border-t border-black/5 bg-white/90 px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit booking request"
            onPress={onSubmit}
            className="overflow-hidden rounded-2xl active:opacity-90">
            <View
              style={{ backgroundColor: '#2970FF', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-base font-semibold text-white">Book Now</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </HealthServiceScreenShell>
  );
}
