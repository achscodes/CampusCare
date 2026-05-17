import { Alert, Pressable, Text, View } from 'react-native';

import type { Appointment, QueueTicket } from '../../lib/health-service/types';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

function queueExplainerCopy(): void {
  Alert.alert(
    'Tickets after approval',
    'When you book, your request is sent for provider review — it is not confirmed yet. After the provider approves it, your visit is confirmed and an arrival ticket is created automatically. Use that ticket when you are at the clinic for queue order (demo).',
    [{ text: 'OK' }],
  );
}

export type QueueTicketCardProps = {
  /** Confirmed visit for today that already has an auto-issued arrival ticket. */
  todayConfirmedWithTicket: Appointment | null;
  /** Any booking request for today still awaiting provider review. */
  hasPendingToday: boolean;
};

function TicketBody({ ticket }: { ticket: QueueTicket }) {
  return (
    <>
      <Text className="text-xs font-medium uppercase tracking-wide text-[#8F9098]">Your arrival ticket</Text>
      <Text
        className="mt-1 font-mono text-3xl font-bold tracking-widest text-[#1F2024]"
        accessibilityLabel={`Arrival ticket ${ticket.code}`}>
        {ticket.code}
      </Text>
      <Text className="mt-2 text-sm text-[#535862]">
        Queue position: <Text className="font-semibold text-[#1F2024]">#{ticket.position}</Text>
        {' · '}
        Est. wait:{' '}
        <Text className="font-semibold text-[#1F2024]">{ticket.estimatedMinutes} min</Text>
      </Text>
      <Text className="mt-2 text-xs leading-5 text-[#8F9098]">
        This ticket was created when your provider confirmed your visit. Staff may call numbers in order when you are
        on site (demo).
      </Text>
    </>
  );
}

export function QueueTicketCard({ todayConfirmedWithTicket, hasPendingToday }: QueueTicketCardProps) {
  const ticket = todayConfirmedWithTicket?.arrivalTicket ?? null;

  return (
    <View
      className="overflow-hidden rounded-3xl border border-black/5 bg-[#FAFAFA] p-4"
      style={CARD_SHADOW}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-lg font-semibold text-[#1F2024]">Arrival ticket</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="How arrival tickets work"
          onPress={queueExplainerCopy}
          hitSlop={8}
          className="active:opacity-70">
          <Text className="text-sm font-semibold text-[#2970FF]">How it works</Text>
        </Pressable>
      </View>
      <Text className="mt-1 text-xs leading-5 text-[#8F9098]">
        After the provider confirms your booking, a ticket is created for you automatically — nothing to tap here
        (demo).
      </Text>

      {ticket ? (
        <View className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
          <TicketBody ticket={ticket} />
        </View>
      ) : hasPendingToday ? (
        <View className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-4">
          <Text className="text-center text-sm font-medium text-[#92400E]">Awaiting provider review</Text>
          <Text className="mt-2 text-center text-xs leading-5 text-[#A16207]">
            Your visit for today is not confirmed yet. Once the provider approves it, your ticket will appear here
            automatically (demo).
          </Text>
        </View>
      ) : (
        <View className="mt-4 rounded-2xl border border-black/5 bg-white px-4 py-4">
          <Text className="text-center text-sm leading-5 text-[#8F9098]">
            When you have a confirmed visit for today, your arrival ticket will show here after provider approval
            (demo).
          </Text>
        </View>
      )}
    </View>
  );
}
