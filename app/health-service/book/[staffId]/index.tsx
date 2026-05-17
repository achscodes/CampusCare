import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { HealthBookingDateStrip } from '../../../../components/health-service/HealthBookingDateStrip';
import { HealthServiceScreenShell } from '../../../../components/health-service/HealthServiceScreenShell';
import { TimeSlotGrid } from '../../../../components/health-service/TimeSlotGrid';
import { ScreenNavbar } from '../../../../components/ScreenNavbar';
import { SCHEDULE_PARTNER } from '../../../../lib/health-service/bookingScheduleTheme';
import { useHealthServiceStore } from '../../../../lib/health-service/healthServiceStore';
import {
  getClinicPublicHoursSummary,
  getSlotLabelsForPeriod,
  isStaffWorkingOnDate,
} from '../../../../lib/health-service/slotUtils';
import type { SlotPeriod, Staff, StaffRole } from '../../../../lib/health-service/types';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date): string {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function roleLabel(role: string): string {
  if (role === 'doctor') return 'Doctor';
  if (role === 'nurse') return 'Nurse';
  return 'Dentist';
}

function schoolClinicRoleLine(role: StaffRole): string {
  if (role === 'doctor') return 'School clinic · Physician';
  if (role === 'nurse') return 'School clinic · Nurse';
  return 'School clinic · Dentist';
}

function initialsFromName(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? '';
    const b = parts[parts.length - 1]?.[0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

const ACCENT = '#2970FF';
const CARD_BORDER = 'rgba(15, 23, 42, 0.08)';
const TINT_BG = '#F5F8FF';

type ProviderBookingCardProps = {
  staff: Staff;
  selectedDay: Date;
  working: boolean;
  rating: number;
};

function ProviderBookingCard({ staff, selectedDay, working, rating }: ProviderBookingCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [staff.id, staff.photoUrl]);

  const dateLine = selectedDay.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const hoursLine = getClinicPublicHoursSummary();
  const showPhoto = Boolean(staff.photoUrl) && !avatarFailed;

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: CARD_BORDER,
        overflow: 'hidden',
      }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: ACCENT }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to favorites"
        hitSlop={12}
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          zIndex: 2,
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderWidth: 1,
          borderColor: 'rgba(15, 23, 42, 0.06)',
        }}>
        <Ionicons name="heart-outline" size={20} color={ACCENT} />
      </Pressable>

      <View style={{ flexDirection: 'row', paddingLeft: 18, paddingRight: 14, paddingTop: 16, paddingBottom: 14, gap: 14 }}>
        {showPhoto ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: staff.photoUrl! }}
            onError={() => setAvatarFailed(true)}
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              borderWidth: 1,
              borderColor: 'rgba(41, 112, 255, 0.12)',
              backgroundColor: TINT_BG,
            }}
          />
        ) : (
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: TINT_BG,
              borderWidth: 1,
              borderColor: 'rgba(41, 112, 255, 0.15)',
            }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: ACCENT }}>{initialsFromName(staff.name)}</Text>
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0, paddingRight: 36 }}>
          <Text style={{ fontSize: 21, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 }} numberOfLines={2}>
            {staff.name}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, fontWeight: '500', color: '#64748B' }} numberOfLines={1}>
            {schoolClinicRoleLine(staff.role)}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: '#94A3B8' }} numberOfLines={2}>
            {staff.specialtyLabel}
            {staff.priceLabel ? ` · ${staff.priceLabel}` : ''}
          </Text>

          <View
            style={{
              marginTop: 10,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: working ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.2)',
            }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: working ? '#10B981' : '#94A3B8',
              }}
            />
            <Text style={{ fontSize: 12, fontWeight: '600', color: working ? '#047857' : '#64748B' }}>
              {working ? 'Taking appointments' : 'Not on schedule this day'}
            </Text>
          </View>

          {working ? (
            <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B', lineHeight: 17 }}>
              <Text style={{ fontWeight: '600', color: '#334155' }}>{dateLine}</Text>
              <Text>{' · Typical windows '}</Text>
              <Text style={{ fontWeight: '600', color: ACCENT }}>{hoursLine}</Text>
              <Text>{' (mock).'}</Text>
            </Text>
          ) : (
            <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B', lineHeight: 17 }}>
              <Text style={{ fontWeight: '600', color: '#334155' }}>{dateLine}</Text>
              <Text>{' — choose another day or a different provider.'}</Text>
            </Text>
          )}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: TINT_BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(41, 112, 255, 0.08)',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="star" size={15} color="#F59E0B" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{rating.toFixed(1)}</Text>
          <Text style={{ fontSize: 12, color: '#94A3B8' }}>Student reviews (demo)</Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(41,112,255,0.08)' }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: ACCENT }}>{roleLabel(staff.role)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HealthServiceBookScreen() {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  const insets = useSafeAreaInsets();
  const { staff: allStaff } = useHealthServiceStore();

  const staff = useMemo(() => (staffId ? allStaff.find((s) => s.id === staffId) : undefined), [staffId, allStaff]);

  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [period, setPeriod] = useState<SlotPeriod>('morning');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const working = staff ? isStaffWorkingOnDate(staff.id, selectedDay) : false;
  const dk = dateKey(selectedDay);

  const slotLabelsByPeriod = useMemo((): Record<SlotPeriod, string[]> => {
    const empty: Record<SlotPeriod, string[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    if (!staff || !working) return empty;
    return {
      morning: getSlotLabelsForPeriod(staff.id, dk, 'morning'),
      afternoon: getSlotLabelsForPeriod(staff.id, dk, 'afternoon'),
      evening: getSlotLabelsForPeriod(staff.id, dk, 'evening'),
      night: getSlotLabelsForPeriod(staff.id, dk, 'night'),
    };
  }, [staff, working, dk]);

  const goToVisitNotes = useCallback(() => {
    if (!staff || !selectedSlot) return;
    const q = new URLSearchParams({
      dateKey: dk,
      slot: selectedSlot,
    });
    router.push(`/health-service/book/${staff.id}/feelings?${q.toString()}`);
  }, [staff, selectedSlot, dk]);

  if (!staff) {
    return (
      <HealthServiceScreenShell>
        <ScreenNavbar title="Book" onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[#535862]">Provider not found.</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="font-semibold text-[#2970FF]">Go back</Text>
          </Pressable>
        </View>
      </HealthServiceScreenShell>
    );
  }

  const rating = staff.rating ?? 4.8;

  return (
    <HealthServiceScreenShell>
      <View className="flex-1">
        <ScreenNavbar title="Book Appointment" onBackPress={() => router.back()} className="mb-4" />
        <ScrollView
          className="flex-1 bg-transparent"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 120 + Math.max(insets.bottom, 8),
          }}>
          <ProviderBookingCard staff={staff} selectedDay={selectedDay} working={working} rating={rating} />

          <View
            className="mt-6"
            style={{
              borderRadius: SCHEDULE_PARTNER.radius,
              borderWidth: 1,
              borderColor: SCHEDULE_PARTNER.cardBorder,
              backgroundColor: SCHEDULE_PARTNER.surface,
              overflow: 'hidden',
            }}>
            <HealthBookingDateStrip
              embedded
              selectedDay={selectedDay}
              onSelectDay={(d) => {
                setSelectedDay(startOfDay(d));
                setSelectedSlot(null);
              }}
            />
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 12,
                height: StyleSheet.hairlineWidth,
                backgroundColor: SCHEDULE_PARTNER.divider,
              }}
            />
            {!working ? (
              <Text
                className="px-5 py-7 text-center text-sm leading-5"
                style={{ color: SCHEDULE_PARTNER.textMuted }}>
                No clinic hours on this day for this provider (mock schedule).
              </Text>
            ) : (
              <TimeSlotGrid
                embedded
                period={period}
                onPeriodChange={(p) => {
                  setPeriod(p);
                  setSelectedSlot(null);
                }}
                labelsByPeriod={slotLabelsByPeriod}
                selectedLabel={selectedSlot}
                onSelect={setSelectedSlot}
                emptyMessage="No open slots in this period. Try another time of day."
              />
            )}
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 border-t border-black/5 bg-white/90 px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Book appointment, then add how you are feeling"
            accessibilityState={{ disabled: !selectedSlot }}
            onPress={goToVisitNotes}
            disabled={!selectedSlot}
            className="overflow-hidden rounded-2xl active:opacity-90"
            style={{ opacity: selectedSlot ? 1 : 0.45 }}>
            <View
              style={{ backgroundColor: '#2970FF', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text className="text-base font-semibold text-white">Book an Appointment</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </HealthServiceScreenShell>
  );
}
