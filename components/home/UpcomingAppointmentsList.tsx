import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

export type UpcomingAppointmentTone = 'purple' | 'blue' | 'orange';

export type UpcomingAppointmentListItem = {
  id: string;
  timeLabel: string;
  title: string;
  subtitle: string;
  tone: UpcomingAppointmentTone;
  onPress?: () => void;
};

const TONE = {
  purple: { bg: '#F3F0FF', accent: '#7C3AED' },
  blue: { bg: '#EFF6FF', accent: '#3B82F6' },
  orange: { bg: '#FFF7ED', accent: '#EA580C' },
} as const;

const TONE_ICON: Record<UpcomingAppointmentTone, React.ComponentProps<typeof Ionicons>['name']> = {
  purple: 'people-outline',
  blue: 'heart-outline',
  orange: 'document-text-outline',
};

const CARD_GAP = 8;

export type UpcomingAppointmentsListProps = {
  items: UpcomingAppointmentListItem[];
  className?: string;
};

function parseHour(timeLabel: string): number {
  const match = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12:00';
  if (hour <= 12) return `${hour}:00`;
  return `${hour - 12}:00`;
}

type HourGroup = {
  hour: number;
  label: string;
  items: UpcomingAppointmentListItem[];
};

function groupByHour(items: UpcomingAppointmentListItem[]): HourGroup[] {
  const map = new Map<number, UpcomingAppointmentListItem[]>();
  for (const item of items) {
    const h = parseHour(item.timeLabel);
    if (!map.has(h)) map.set(h, []);
    map.get(h)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, groupItems]) => ({
      hour,
      label: formatHourLabel(hour),
      items: groupItems,
    }));
}

/**
 * Timeline appointment view matching reference design:
 * hour labels + horizontal separator, horizontally scrollable white cards.
 */
export function UpcomingAppointmentsList({ items, className }: UpcomingAppointmentsListProps) {
  if (items.length === 0) {
    return (
      <View className={`rounded-3xl bg-white px-4 py-10 ${className ?? ''}`}>
        <Text className="text-center text-sm text-[#8F9098]">No appointments for this day.</Text>
      </View>
    );
  }

  const groups = groupByHour(items);

  return (
    <View className={`${className ?? ''}`}>
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;

        return (
          <View key={group.hour}>
            {/* Hour label row + separator line */}
            <View className="flex-row items-center gap-2 q">
              <Text className="text-sm font-medium text-[#9CA3AF]" style={{ minWidth: 40 }}>
                {group.label}
              </Text>
              <View className="h-px flex-1 bg-[#EBEBEB]" />
            </View>

            {/* Horizontally scrollable cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: 52,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: isLast ? 4 : 4,
                gap: CARD_GAP,
              }}>
              {group.items.map((item) => {
                const colors = TONE[item.tone];
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole={item.onPress ? 'button' : undefined}
                    accessibilityLabel={`${item.timeLabel}, ${item.title}, ${item.subtitle}`}
                    className="flex-row items-center rounded-full bg-white active:bg-[#F9F9F9]"
                    style={{
                      paddingLeft: 10,
                      paddingRight: 14,
                      paddingVertical: 10,
                      gap: 8,
                    }}
                    disabled={!item.onPress}
                    onPress={item.onPress}>
                    {/* Icon */}
                    <View
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.bg }}>
                      <Ionicons name={TONE_ICON[item.tone]} size={14} color={colors.accent} />
                    </View>

                    {/* Title + time */}
                    <View className="min-w-0 flex-1">
                      <Text className="text-[12px] font-semibold text-[#1F2024]">
                        {item.title}
                      </Text>
                      <Text className="text-[12px] text-[#9CA3AF]" numberOfLines={1}>
                        {item.timeLabel}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
