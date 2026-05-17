import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const SELECTED_BLUE = '#2970FF';
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.35 } as const;
const PRESS_SCALE = 0.94;
const MAX_DOTS = 4;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Sunday → Saturday (7 days) for the week that contains `anchor`. */
function getWeekDaysSundayFirst(anchor: Date): Date[] {
  const s = startOfDay(anchor);
  const dow = s.getDay();
  s.setDate(s.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(s);
    x.setDate(s.getDate() + i);
    return startOfDay(x);
  });
}

type DateStripPillProps = {
  day: Date;
  selected: boolean;
  displayDots: number;
  onSelect: () => void;
  accessibilityLabel: string;
};

function DateStripPill({ day, selected, displayDots, onSelect, accessibilityLabel }: DateStripPillProps) {
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const weekday = day.toLocaleDateString(undefined, { weekday: 'short' });
  const dayNum = day.getDate();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="min-w-0 flex-1"
      onPress={onSelect}
      onPressIn={() => {
        scale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}>
      <Animated.View
        style={[
          pressStyle,
          {
            width: '100%',
            minHeight: 70,
            borderRadius: 999,
            paddingVertical: 6,
            paddingHorizontal: 2,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            backgroundColor: selected ? SELECTED_BLUE : '#FFFFFF',
            borderWidth: 1,
            borderColor: selected ? SELECTED_BLUE : '#FFFFFF',
          },
        ]}>
        <Text
          className="text-[9px] font-semibold capitalize"
          style={{ color: selected ? '#FFFFFF' : '#535862' }}
          numberOfLines={1}>
          {weekday}
        </Text>
        <Text
          className="text-[15px] font-bold leading-none"
          style={{ color: selected ? '#FFFFFF' : '#1F2024' }}
          numberOfLines={1}>
          {dayNum}
        </Text>
        <View className="flex-row items-center justify-center gap-0.5">
          {Array.from({ length: MAX_DOTS }, (_, i) => (
            <View
              key={i}
              style={{
                width: 3,
                height: 3,
                borderRadius: 1.5,
                backgroundColor:
                  i < displayDots
                    ? selected
                      ? 'rgba(255,255,255,0.95)'
                      : 'rgba(41,112,255,0.35)'
                    : selected
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(41,112,255,0.10)',
              }}
            />
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export type HomeDateStripCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  appointmentCountForDay: (day: Date) => number;
  className?: string;
};

/**
 * Full-width week row (Sun–Sat): seven equal cells, no horizontal scroll.
 * Blue selected pill (`#2970FF`); inactive `#F5F8FF` pills with white border;
 * weekday label above number; bottom dots = appointment load.
 */
export function HomeDateStripCalendar({
  selectedDate,
  onSelectDate,
  appointmentCountForDay,
  className,
}: HomeDateStripCalendarProps) {
  const weekDays = useMemo(() => getWeekDaysSundayFirst(selectedDate), [selectedDate]);

  return (
    <View className={`w-full flex-row gap-1 ${className ?? ''}`}>
      {weekDays.map((day) => {
        const count = appointmentCountForDay(day);
        const displayDots = Math.min(MAX_DOTS, Math.max(0, count));
        const selected = isSameDay(day, selectedDate);
        const label = day.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        return (
          <DateStripPill
            key={day.getTime()}
            accessibilityLabel={`${label}, ${count} appointment${count === 1 ? '' : 's'}`}
            day={day}
            displayDots={displayDots}
            selected={selected}
            onSelect={() => onSelectDate(startOfDay(day))}
          />
        );
      })}
    </View>
  );
}
