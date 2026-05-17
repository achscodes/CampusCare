import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from 'heroui-native';

import { confirmCancelAppointment } from '../../../components/health-service/CancelAppointmentDialog';
import {
  formatAppointmentDateLong,
  formatAppointmentWhen,
  getPatientTicketLabel,
} from '../../../lib/health-service/appointmentDisplay';
import { SCHEDULE_PARTNER } from '../../../lib/health-service/bookingScheduleTheme';
import { healthServiceApi } from '../../../lib/health-service/healthServiceApi';
import { staffNameForAppointment, useHealthServiceStore } from '../../../lib/health-service/healthServiceStore';

const PAGE_BG = SCHEDULE_PARTNER.segmentTrackBg;
const BRAND = SCHEDULE_PARTNER.brand;
const SURFACE = SCHEDULE_PARTNER.surface;
const INK = SCHEDULE_PARTNER.textPrimary;
const MUTED = SCHEDULE_PARTNER.textMuted;
const SUB = SCHEDULE_PARTNER.textDisabled;

const CLINIC_NAME = 'CampusCare Student Health';
const NOTCH_R = 9;

function DashedRule({ color }: { color: string }) {
  const segments = 40;
  return (
    <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', paddingVertical: 8, gap: 3 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 2, maxWidth: 10, borderRadius: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** Side “bites” + dashed tear line, edge-to-edge inside the ticket card (matches card horizontal padding). */
function TicketPerforationRow({ pageBg, dashColor }: { pageBg: string; dashColor: string }) {
  const bleed = 18;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, marginHorizontal: -bleed }}>
      <View style={{ width: 22, height: NOTCH_R * 2, justifyContent: 'center', alignItems: 'flex-start' }}>
        <View
          style={{
            width: NOTCH_R * 2,
            height: NOTCH_R * 2,
            borderRadius: NOTCH_R,
            backgroundColor: pageBg,
            marginLeft: -NOTCH_R - 2,
          }}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <DashedRule color={dashColor} />
      </View>
      <View style={{ width: 22, height: NOTCH_R * 2, justifyContent: 'center', alignItems: 'flex-end' }}>
        <View
          style={{
            width: NOTCH_R * 2,
            height: NOTCH_R * 2,
            borderRadius: NOTCH_R,
            backgroundColor: pageBg,
            marginRight: -NOTCH_R - 2,
          }}
        />
      </View>
    </View>
  );
}

export default function AppointmentTicketScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = typeof id === 'string' ? id : id?.[0] ?? '';

  const appointments = useHealthServiceStore((s) => s.appointments);
  const { staff: allStaff } = useHealthServiceStore();

  const ap = useMemo(
    () => appointments.find((a) => a.id === appointmentId),
    [appointments, appointmentId],
  );

  const staff = ap ? allStaff.find((s) => s.id === ap.staffId) : undefined;
  const staffName = ap ? staffNameForAppointment(ap) : '';
  const whenLabel = ap ? formatAppointmentWhen(ap) : '';
  const dateLong = ap ? formatAppointmentDateLong(ap) : '';
  const patientLabel = ap ? getPatientTicketLabel(ap.id) : '';

  if (!ap) {
    return (
      <View style={{ flex: 1, backgroundColor: PAGE_BG, paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={INK} />
        </Pressable>
        <Text style={{ marginTop: 32, fontSize: 17, fontWeight: '600', color: INK }}>Appointment not found</Text>
        <Text style={{ marginTop: 8, fontSize: 15, color: MUTED, lineHeight: 22 }}>
          It may have been removed or the link is out of date.
        </Text>
        <Button
          variant="primary"
          size="md"
          className="mt-7 h-11 w-full rounded-full bg-[#2970FF]"
          onPress={() => router.replace('/health-service')}>
          <Button.Label className="text-sm font-semibold text-white">Go back</Button.Label>
        </Button>
      </View>
    );
  }

  const isPending = ap.status === 'pending';
  const isConfirmed = ap.status === 'confirmed';
  const isCancelled = ap.status === 'cancelled';
  /** Tickets exist only after confirmation — pending never has one. */
  const ticket = isConfirmed ? ap.arrivalTicket : undefined;

  const headline = isCancelled
    ? 'This visit was cancelled.'
    : isConfirmed
      ? 'Your appointment is confirmed — your check-in code is ready below.'
      : 'Your request is pending — no ticket until your provider confirms.';

  const dashColor = 'rgba(15, 23, 42, 0.18)';

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <ScrollView
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 20) + 24,
          paddingHorizontal: 20,
        }}>
        <Text style={{ marginTop: 14, textAlign: 'center', fontSize: 16, fontWeight: '400', color: MUTED, lineHeight: 23, paddingHorizontal: 8 }}>
          {headline}
        </Text>

        {/* Ticket stub: wider top radius, tighter bottom — reads as one pass */}
        <View
          style={{
            marginTop: 22,
            backgroundColor: SURFACE,
            borderTopLeftRadius: SCHEDULE_PARTNER.radius,
            borderTopRightRadius: SCHEDULE_PARTNER.radius,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 18,
            overflow: 'visible',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: SCHEDULE_PARTNER.slotTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="medkit" size={24} color={BRAND} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: SUB, letterSpacing: 0.6 }}>CARE WITH</Text>
              <Text style={{ marginTop: 2, fontSize: 17, fontWeight: '800', color: INK }} numberOfLines={2}>
                {staffName}
              </Text>
            </View>
          </View>

          <TicketPerforationRow pageBg={PAGE_BG} dashColor={dashColor} />

          <View accessibilityLabel={`${staff?.specialtyLabel ?? ''}. ${CLINIC_NAME}`}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: SUB, letterSpacing: 0.6 }}>PATIENT</Text>
            <Text style={{ marginTop: 6, fontSize: 22, fontWeight: '800', color: INK, letterSpacing: 0.5 }}>
              {isConfirmed && ticket != null && ticket.status === 'called' ? patientLabel : 'Waiting'}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 14, fontWeight: '400', color: MUTED, lineHeight: 20 }}>
              {staff?.specialtyLabel ? `${staff.specialtyLabel} · ` : null}
              {CLINIC_NAME}
            </Text>
          </View>

          <TicketPerforationRow pageBg={PAGE_BG} dashColor={dashColor} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: SUB, letterSpacing: 0.4 }}>VISIT DATE</Text>
              <Text style={{ marginTop: 6, fontSize: 14, fontWeight: '600', color: INK, lineHeight: 20 }}>{dateLong}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: SUB, letterSpacing: 0.4 }}>TIME</Text>
              <Text style={{ marginTop: 6, fontSize: 14, fontWeight: '600', color: INK }}>{ap.startLabel}</Text>
            </View>
          </View>

          {!isCancelled && isPending ? (
            <>
              <TicketPerforationRow pageBg={PAGE_BG} dashColor={dashColor} />
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: SUB, letterSpacing: 0.5 }}>CHECK-IN CODE</Text>
                <Text style={{ fontSize: 12, fontWeight: '400', color: MUTED, textAlign: 'center', lineHeight: 17, paddingHorizontal: 4 }}>
                  Present this code to the nurse at the clinic desk to confirm your appointment and get your patient number.
                </Text>
                <View
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 14,
                    backgroundColor: SCHEDULE_PARTNER.slotTint,
                    borderWidth: 1,
                    borderColor: 'rgba(41, 112, 255, 0.14)',
                  }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: INK, letterSpacing: 4, textAlign: 'center' }}>
                    {ap.checkInCode || ap.id}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '500', color: MUTED, textAlign: 'center', lineHeight: 19 }}>
                  Waiting for confirmation · Present code to nurse
                </Text>
              </View>
            </>
          ) : !isCancelled && isConfirmed && ticket != null ? (
            <>
              <TicketPerforationRow pageBg={PAGE_BG} dashColor={dashColor} />
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: SUB, letterSpacing: 0.5 }}>CHECK-IN CODE</Text>
                <Text style={{ fontSize: 12, fontWeight: '400', color: MUTED, textAlign: 'center', lineHeight: 17, paddingHorizontal: 4 }}>
                  Present this code to the nurse at the clinic desk. The code expires in 1 hour.
                </Text>
                <View
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 14,
                    backgroundColor: SCHEDULE_PARTNER.slotTint,
                    borderWidth: 1,
                    borderColor: 'rgba(41, 112, 255, 0.14)',
                  }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: INK, letterSpacing: 4, textAlign: 'center' }}>
                    {ticket.code}
                  </Text>
                </View>
                {ticket.status === 'called' ? (
                  <Text style={{ fontSize: 13, fontWeight: '500', color: MUTED, textAlign: 'center', lineHeight: 19 }}>
                    You are Patient #{ticket.position} · Please proceed to the clinic
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '500', color: MUTED, textAlign: 'center', lineHeight: 19 }}>
                    Waiting for check-in · Present code to nurse to get your patient number
                  </Text>
                )}
              </View>
            </>
          ) : !isCancelled && isPending ? (
            <>
              <TicketPerforationRow pageBg={PAGE_BG} dashColor={dashColor} />
              <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '500', color: '#B45309', lineHeight: 21 }}>
                When your provider confirms, your check-in code and queue details will appear here (demo).
              </Text>
            </>
          ) : isCancelled ? (
            <>
              <TicketPerforationRow pageBg={PAGE_BG} dashColor={dashColor} />
              <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '500', color: MUTED, lineHeight: 21 }}>
                This slot is released. You can book another visit anytime from Health Service.
              </Text>
            </>
          ) : null}
        </View>

        <View className="mt-3 w-full gap-3">
          {!isCancelled && isPending ? (
            <Button
              variant="primary"
              size="md"
              className="h-11 w-full rounded-full bg-[#2970FF]"
              onPress={() => void healthServiceApi.confirmAppointmentByProvider(ap.id)}
              accessibilityLabel="Simulate provider confirming this appointment for demo">
              <Button.Label className="text-sm font-semibold text-white">Simulate provider confirm (demo)</Button.Label>
            </Button>
          ) : null}

          {!isCancelled && (isPending || isConfirmed) ? (
            <Button
              variant="outline"
              size="md"
              className="h-11 w-full rounded-full border border-[#FECACA] bg-[#FEF2F2]"
              onPress={() =>
                confirmCancelAppointment({
                  staffName,
                  whenLabel,
                  status: isPending ? 'pending' : 'confirmed',
                  onConfirm: () => {
                    void healthServiceApi.cancelAppointment(ap.id);
                    router.back();
                  },
                })
              }
              accessibilityLabel="Cancel this appointment">
              <Button.Label className="text-sm font-normal text-[#DC2626]">Cancel Appointment</Button.Label>
            </Button>
          ) : null}

          <Button
            variant="primary"
            size="md"
            className="h-11 w-full rounded-full bg-[#2970FF]"
            onPress={() => router.back()}
            accessibilityLabel="Return to Health Service">
            <Button.Label className="text-sm font-bold text-white">Go back</Button.Label>
          </Button>
        </View>

        <Text style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: MUTED, lineHeight: 19 }}>
          Your visit ticket: who you&apos;re seeing, when, and how to check in. Demo data only.
        </Text>
      </ScrollView>
    </View>
  );
}
