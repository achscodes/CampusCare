import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SCHEDULE_PARTNER } from '../../lib/health-service/bookingScheduleTheme';
import { IconsaxArrowLeftIcon } from '../icons/IconsaxArrowLeftIcon';
import { IconsaxArrowRightIcon } from '../icons/IconsaxArrowRightIcon';

// ─── Shared constants ────────────────────────────────────────────────────────

const BRAND = SCHEDULE_PARTNER.brand;
const SURFACE = SCHEDULE_PARTNER.surface;
const BORDER_CELL = SCHEDULE_PARTNER.borderCell;
const TEXT_PRIMARY = SCHEDULE_PARTNER.textPrimary;
const TEXT_MUTED = SCHEDULE_PARTNER.textMuted;
const TEXT_DISABLED = SCHEDULE_PARTNER.textDisabled;
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.35 } as const;
const PRESS_SCALE = 0.94;
/** Mon–Sat are available; Sunday is always closed. */
const CLINIC_DAYS: Set<number> = new Set([1, 2, 3, 4, 5, 6]); // 0=Sun … 6=Sat

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Mon–Sat (6 days) for the week containing `anchor`. Sunday is never included. */
function weekDaysMondayFirst(anchor: Date): Date[] {
  const s = startOfDay(anchor);
  const dow = s.getDay(); // 0=Sun … 6=Sat
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  s.setDate(s.getDate() + daysToMonday);
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(s);
    x.setDate(s.getDate() + i);
    return startOfDay(x);
  });
}

function addWeeks(anchor: Date, delta: number): Date {
  const x = startOfDay(anchor);
  x.setDate(x.getDate() + delta * 7);
  return x;
}

// ─── Individual day pill ──────────────────────────────────────────────────────

type DayPillProps = {
  day: Date;
  selected: boolean;
  disabled: boolean;
  isCurrentMonth: boolean;
  onSelect: () => void;
};

function DayPill({ day, selected, disabled, isCurrentMonth, onSelect }: DayPillProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const a11yLabel = day.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const weekday = day.toLocaleDateString(undefined, { weekday: 'short' });
  const num = day.getDate();

  const muted = disabled || !isCurrentMonth;
  const bg = selected ? BRAND : muted ? '#F1F5F9' : SURFACE;
  const borderColor = selected ? BRAND : muted ? 'transparent' : BORDER_CELL;
  const labelColor = selected ? 'rgba(255,255,255,0.92)' : muted ? TEXT_DISABLED : TEXT_MUTED;
  const numColor = selected ? '#FFFFFF' : muted ? TEXT_DISABLED : TEXT_PRIMARY;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      onPressIn={() => { scale.value = withSpring(PRESS_SCALE, PRESS_SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, PRESS_SPRING); }}
      style={{ flex: 1, minWidth: 0 }}>
      <Animated.View
        style={[
          animStyle,
          {
            width: '100%',
            minHeight: 72,
            borderRadius: 14,
            paddingVertical: 8,
            paddingHorizontal: 2,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            backgroundColor: bg,
            borderWidth: selected ? 0 : muted ? 0 : 1,
            borderColor,
          },
        ]}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.2,
            textTransform: 'capitalize',
            color: labelColor,
          }}>
          {weekday}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: -0.3,
            lineHeight: 18,
            color: numColor,
          }}>
          {num}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Strip (7-day week row with navigation) ───────────────────────────────────

export type HealthBookingDateStripProps = {
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  /** Dates to mark as unavailable regardless of weekday (e.g. holidays). */
  holidays?: Date[];
  /** When true, no outer card — render inside a parent “partner” schedule shell. */
  embedded?: boolean;
};

/**
 * Week strip in a light card: month + week nav, Mon–Sat day cells (Sun excluded), holiday mute.
 */
export function HealthBookingDateStrip({
  selectedDay,
  onSelectDay,
  holidays = [],
  embedded = false,
}: HealthBookingDateStripProps) {
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(selectedDay));
  const directionRef = useRef<'forward' | 'back'>('forward');
  const [slideKey, setSlideKey] = useState(0);

  const days = useMemo(() => weekDaysMondayFirst(weekAnchor), [weekAnchor]);

  const monthLabel = useMemo(() => {
    // Use the month that has the most days in this week
    const counts: Record<string, number> = {};
    for (const d of days) {
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const [y, m] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0].split('-').map(Number);
    return new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [days]);

  const navigate = useCallback((delta: number) => {
    directionRef.current = delta > 0 ? 'forward' : 'back';
    setSlideKey((k) => k + 1);
    setWeekAnchor((prev) => addWeeks(prev, delta));
  }, []);

  const isDisabled = useCallback((d: Date) => {
    if (!CLINIC_DAYS.has(d.getDay())) return true;
    return holidays.some((h) => isSameDay(h, d));
  }, [holidays]);

  const entering = directionRef.current === 'forward' ? FadeInRight.duration(180) : FadeInLeft.duration(180);
  const exiting = directionRef.current === 'forward' ? FadeOutLeft.duration(140) : FadeOutRight.duration(140);

  const shell = embedded
    ? {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: 'transparent' as const,
      }
    : {
        borderRadius: SCHEDULE_PARTNER.radius,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: SCHEDULE_PARTNER.cardBorder,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
        overflow: 'hidden' as const,
      };

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: 4}}>
        <View style={{ marginBottom: 0 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: TEXT_PRIMARY,
              letterSpacing: -0.2,
            }}>
            {monthLabel}
          </Text>
          <Text style={{ marginTop: 3, fontSize: 12, fontWeight: '500', color: TEXT_MUTED }}>
            Available depending on School Calendar
            {holidays.length > 0 ? ' · Holiday dates muted below' : ''}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 999,
            padding: 3,
            gap: 2,
            backgroundColor: SCHEDULE_PARTNER.segmentTrackBg,
            borderWidth: 1,
            borderColor: SCHEDULE_PARTNER.segmentTrackBorder,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            hitSlop={10}
            onPress={() => navigate(-1)}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? SURFACE : 'transparent',
            })}>
            <IconsaxArrowLeftIcon size={22} color={BRAND} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            hitSlop={10}
            onPress={() => navigate(1)}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? SURFACE : 'transparent',
            })}>
            <IconsaxArrowRightIcon size={22} color={BRAND} />
          </Pressable>
        </View>
      </View>

      <Animated.View
        key={slideKey}
        entering={entering}
        exiting={exiting}
        style={{ width: '100%', flexDirection: 'row', gap: 6 }}>
        {days.map((d) => {
          const anchorMonth = days[2].getMonth();
          return (
            <DayPill
              key={d.getTime()}
              day={d}
              selected={isSameDay(d, selectedDay)}
              disabled={isDisabled(d)}
              isCurrentMonth={d.getMonth() === anchorMonth}
              onSelect={() => {
                if (!isDisabled(d)) onSelectDay(d);
              }}
            />
          );
        })}
      </Animated.View>
    </>
  );

  return <View style={shell}>{body}</View>;
}

// ─── Feeling / symptoms group ─────────────────────────────────────────────────

export type HealthBookingFeelingOption = {
  id: string;
  label: string;
};

export const HEALTH_BOOKING_FEELING_OPTIONS: HealthBookingFeelingOption[] = [
  { id: 'checkup', label: 'General check-up' },
  { id: 'fever', label: 'Fever / flu symptoms' },
  { id: 'pain', label: 'Pain or injury' },
  { id: 'mental', label: 'Stress / mental health' },
  { id: 'digestive', label: 'Digestive issues' },
  { id: 'other', label: 'Something else' },
];

export type HealthBookingFeelingGroupProps = {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  comments: string;
  onCommentsChange: (text: string) => void;
};

/**
 * Multi-select chips for how the student has been feeling + multiline comments.
 */
export function HealthBookingFeelingGroup({
  selectedIds,
  onSelectedIdsChange,
  comments,
  onCommentsChange,
}: HealthBookingFeelingGroupProps) {
  const toggle = (id: string) => {
    onSelectedIdsChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  return (
    <View>
      <Text className="text-lg font-semibold text-[#1F2024]">{"What have you been feeling?"}</Text>
      <Text className="mt-1 text-xs text-[#8F9098]">Select any that apply (optional).</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {HEALTH_BOOKING_FEELING_OPTIONS.map((opt) => {
          const on = selectedIds.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={opt.label}
              onPress={() => toggle(opt.id)}
              className="rounded-full border px-4 py-2.5 active:opacity-85"
              style={{
                borderColor: on ? BRAND : 'rgba(0,0,0,0.08)',
                backgroundColor: on ? BRAND : '#FFFFFF',
              }}>
              <Text
                className="text-sm font-semibold"
                style={{ color: on ? '#FFFFFF' : '#535862' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-6 text-lg font-semibold text-[#1F2024]">Additional comments</Text>
      <TextInput
        accessibilityLabel="Additional comments for your visit"
        value={comments}
        onChangeText={onCommentsChange}
        placeholder="Anything else we should know before your visit?"
        placeholderTextColor="#8F9098"
        multiline
        textAlignVertical="top"
        className="mt-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#1F2024]"
        style={{ minHeight: 104 }}
      />
    </View>
  );
}
