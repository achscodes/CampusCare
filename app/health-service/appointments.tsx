import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppointmentListCard } from '../../components/health-service/AppointmentListCard';
import { HealthServiceScreenShell } from '../../components/health-service/HealthServiceScreenShell';
import { ScreenNavbar } from '../../components/ScreenNavbar';
import { formatAppointmentWhen } from '../../lib/health-service/appointmentDisplay';
import { SCHEDULE_PARTNER } from '../../lib/health-service/bookingScheduleTheme';
import { staffNameForAppointment, useHealthServiceStore } from '../../lib/health-service/healthServiceStore';

type AppointmentFilter = 'all' | 'pending' | 'confirmed';

const BRAND = SCHEDULE_PARTNER.brand;

export default function HealthServiceAppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>('all');

  const appointments = useHealthServiceStore((s) => s.appointments);

  const active = useMemo(() => {
    return appointments
      .filter((a) => a.status !== 'cancelled')
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return a.startLabel.localeCompare(b.startLabel);
      });
  }, [appointments]);

  const filtered = useMemo(() => {
    if (appointmentFilter === 'all') return active;
    return active.filter((a) => a.status === appointmentFilter);
  }, [active, appointmentFilter]);

  const segmentBtn = (selected: boolean) => ({
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: selected ? BRAND : 'transparent',
  });

  return (
    <HealthServiceScreenShell>
      <ScreenNavbar title="Appointments" onBackPress={() => router.back()} />
      <ScrollView
        className="flex-1 bg-transparent"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 12) + 24,
        }}>
        <View className="gap-4 pt-2">
          <Text style={{ fontSize: 14, lineHeight: 21, color: SCHEDULE_PARTNER.textMuted }}>
            All booking requests and confirmed visits. Pending means a provider has not approved the time yet (demo).
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: SCHEDULE_PARTNER.segmentTrackBorder,
              backgroundColor: SCHEDULE_PARTNER.segmentTrackBg,
              padding: 4,
              gap: 4,
            }}>
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'pending' as const, label: 'Pending' },
                { id: 'confirmed' as const, label: 'Confirmed' },
              ] as const
            ).map((opt) => {
              const selected = appointmentFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setAppointmentFilter(opt.id)}
                  style={{ flex: 1, minWidth: '28%', ...segmentBtn(selected) }}
                  className="active:opacity-90">
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: selected ? '600' : '400',
                      color: selected ? '#FFFFFF' : SCHEDULE_PARTNER.textMuted,
                    }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 12 }}>
            {filtered.length === 0 ? (
              <Text style={{ paddingVertical: 28, textAlign: 'center', fontSize: 14, color: SCHEDULE_PARTNER.textDisabled }}>
                {active.length === 0
                  ? 'No appointments yet. Book a visit from Health Service home.'
                  : 'Nothing in this filter. Try All or another status.'}
              </Text>
            ) : (
              filtered.map((item) => (
                <AppointmentListCard
                  key={item.id}
                  appointment={item}
                  staffName={staffNameForAppointment(item)}
                  whenLabel={formatAppointmentWhen(item)}
                  onPress={() => router.push({ pathname: '/health-service/appointment/[id]', params: { id: item.id } })}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </HealthServiceScreenShell>
  );
}
