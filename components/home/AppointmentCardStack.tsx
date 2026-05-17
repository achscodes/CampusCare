import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IconsaxCalendarIcon } from '@/components/icons/IconsaxCalendarIcon';
import { IconsaxCallFilledIcon } from '@/components/icons/IconsaxCallFilledIcon';
import { IconsaxClockIcon } from '@/components/icons/IconsaxClockIcon';
import { IconsaxHospitalFilledIcon } from '@/components/icons/IconsaxHospitalFilledIcon';

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 650;

/** First card behind the front (Figma stack). */
const STACK_OPACITY_MID = 0.68;
/** Deepest visible card in a 3+ deck. */
const STACK_OPACITY_BACK = 0.2;

/**
 * Stack placement — tweak here.
 * - STACK_TOP_*: distance from the stack container’s top to each back layer (smaller = higher on screen).
 * - STACK_LIFT_*: extra translateY while swiping (positive pushes down). First value = at rest, second = when front is mostly gone.
 */
const STACK_TOP_SECOND = 8;
const STACK_TOP_THIRD = 13;
const STACK_LIFT_MID_REST = 5;
const STACK_LIFT_MID_END = 0;
const STACK_LIFT_DEEP_REST = 12;
const STACK_LIFT_DEEP_END = 6;

/**
 * Spacing when the swipe hint is gone (or single-card deck):
 * - **STACK_PEEK_BOTTOM_BUFFER** — extra `minHeight` under the front card when `stack.length > 1`
 *   so back cards are not clipped. Smaller = tighter deck, less empty space under the cards.
 * - **`className` on `<AppointmentCardStack />`** — e.g. `mb-2` / `pb-1` for margin outside this component.
 * - **Home layout** — `app/(tabs)/index.tsx`: spacing between calendar and stack.
 *   between the “Upcoming Appointments” block and “Quick Actions”.
 *
 * While the hint is visible, gap under the cards is the hint’s **`mt-3`** on its wrapper (search “swipeHintStyle”).
 */
const STACK_PEEK_BOTTOM_BUFFER = 22
/** Hint row layout height cap (collapses with opacity so no gap after dismiss). */
const HINT_ROW_MAX_HEIGHT = 22;

const SPRING_RESET = { damping: 26, stiffness: 200, mass: 0.85 } as const;
const EXIT_EASING = Easing.out(Easing.cubic);

export type AppointmentCardData = {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  timeRangeLabel: string;
  onCallPress?: () => void;
};

type AppointmentCardFaceProps = {
  item: AppointmentCardData;
  /** Slightly faded for deck preview behind the front card. */
  preview?: boolean;
};

function AppointmentCardFace({ item, preview }: AppointmentCardFaceProps) {
  return (
    <View className="w-full shadow-none" style={{ elevation: 0 }}>
      <View
        className="w-full overflow-hidden rounded-xl shadow-none"
        style={{ elevation: 0, shadowOpacity: 0 }}>
        <LinearGradient
          colors={['#2970FF', '#155EEF']}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={{ padding: 14, width: '100%' }}>
          <View className="gap-4">
          <View className="flex-row items-center gap-1.5 px-1">
            <IconsaxHospitalFilledIcon color="rgba(255,255,255,0.95)" size={32} />
            <View className="min-w-0 flex-1 pl-1 pt-1">
              <Text className="text-sm font-semibold text-white" numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="text-sm font-normal text-white/90" numberOfLines={2}>
                {item.subtitle}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Call"
              accessibilityRole="button"
              className="rounded-full bg-white p-2"
              hitSlop={8}
              android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
              style={{ elevation: 0, shadowOpacity: 0 }}
              onPress={() => item.onCallPress?.()}
              disabled={preview}>
              <IconsaxCallFilledIcon color="#2970FF" size={20} />
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between rounded-lg bg-[#0040C1] px-3 py-2">
            <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
              <IconsaxCalendarIcon color="#FFFFFF" size={18} />
              <Text className="text-sm font-normal leading-5 text-white" numberOfLines={1}>
                {item.dateLabel}
              </Text>
            </View>
            <View className="mx-1 h-6 w-px bg-white/35" />
            <View className="min-w-0 flex-1 flex-row items-center justify-center gap-1.5">
              <IconsaxClockIcon color="#FFFFFF" size={18} />
              <Text className="text-sm font-normal leading-5 text-white" numberOfLines={1}>
                {item.timeRangeLabel}
              </Text>
            </View>
          </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

export type AppointmentCardStackProps = {
  appointments: AppointmentCardData[];
  /** Applied to the outer wrapper; use for margin/padding vs siblings after the hint is dismissed (e.g. `mb-2`). */
  className?: string;
};

/**
 * Swipeable appointment deck (Figma 703:33228). Up to three cards: deeper layers are more faded;
 * swiping brings the next card to full opacity and eases the stack forward.
 */
export function AppointmentCardStack({ appointments, className }: AppointmentCardStackProps) {
  const [stack, setStack] = useState<AppointmentCardData[]>(appointments);
  const [hintUnmounted, setHintUnmounted] = useState(false);
  const [frontCardHeight, setFrontCardHeight] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const stackLen = useSharedValue(appointments.length);
  const hintOpacity = useSharedValue(1);
  const hintMaxHeight = useSharedValue(HINT_ROW_MAX_HEIGHT);

  const appointmentsKey = useMemo(() => appointments.map((a) => a.id).join('|'), [appointments]);

  useEffect(() => {
    setStack(appointments);
  }, [appointments]);

  useEffect(() => {
    stackLen.value = stack.length;
  }, [stack.length, stackLen]);

  useEffect(() => {
    setHintUnmounted(false);
    hintOpacity.value = 1;
    hintMaxHeight.value = HINT_ROW_MAX_HEIGHT;
  }, [appointmentsKey, hintOpacity, hintMaxHeight]);

  const rotate = useCallback(() => {
    setStack((prev) => (prev.length <= 1 ? prev : [...prev.slice(1), prev[0]]));
  }, []);

  const fadeOutSwipeHint = useCallback(() => {
    const timing = { duration: 280, easing: Easing.out(Easing.cubic) };
    hintOpacity.value = withTiming(0, timing);
    hintMaxHeight.value = withTiming(0, timing, (finished) => {
      if (finished) runOnJS(setHintUnmounted)(true);
    });
  }, [hintOpacity, hintMaxHeight]);

  const onSwipeDismissComplete = useCallback(() => {
    rotate();
    fadeOutSwipeHint();
  }, [rotate, fadeOutSwipeHint]);

  const onFrontCardLayout = useCallback((e: LayoutChangeEvent) => {
    setFrontCardHeight(Math.ceil(e.nativeEvent.layout.height));
  }, []);

  const stackContainerStyle = useMemo(() => {
    if (stack.length <= 1) {
      return undefined;
    }
    if (frontCardHeight > 0) {
      return { minHeight: frontCardHeight + STACK_PEEK_BOTTOM_BUFFER };
    }
    return { minHeight: 172 };
  }, [stack.length, frontCardHeight]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.12;
    })
    .onEnd((e) => {
      const shouldDismiss =
        stackLen.value > 1 &&
        (Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY);
      if (shouldDismiss) {
        const toX = e.translationX >= 0 ? 420 : -420;
        translateX.value = withTiming(
          toX,
          { duration: 340, easing: EXIT_EASING },
          (finished) => {
            if (finished) {
              runOnJS(onSwipeDismissComplete)();
              translateX.value = 0;
              translateY.value = 0;
            }
          },
        );
      } else {
        translateX.value = withSpring(0, SPRING_RESET);
        translateY.value = withSpring(0, SPRING_RESET);
      }
    });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-220, 220],
          [-10, 10],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  /** Second in stack: dim at rest, full opacity as it becomes the front while swiping. */
  const midStackStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const t = interpolate(absX, [0, 100, 220], [0, 0.75, 1], Extrapolation.CLAMP);
    const scale = 0.96 + 0.04 * t;
    const opacity = STACK_OPACITY_MID + (1 - STACK_OPACITY_MID) * t;
    const lift = interpolate(
      absX,
      [0, 220],
      [STACK_LIFT_MID_REST, STACK_LIFT_MID_END],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY: lift }, { scale }],
    };
  });

  /** Third in stack: more faded; rises and brightens toward “second card” level while swiping. */
  const deepStackStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const t = interpolate(absX, [0, 100, 220], [0, 0.55, 1], Extrapolation.CLAMP);
    const scale = 0.92 + 0.04 * t;
    const opacity = STACK_OPACITY_BACK + (STACK_OPACITY_MID - STACK_OPACITY_BACK) * t;
    const lift = interpolate(
      absX,
      [0, 220],
      [STACK_LIFT_DEEP_REST, STACK_LIFT_DEEP_END],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY: lift }, { scale }],
    };
  });

  const swipeHintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const second = stack[1];
  const third = stack[2];
  const front = stack[0];

  if (!front) {
    return (
      <View className={`w-full rounded-xl border border-dashed border-[#C5C6CC] p-6 ${className ?? ''}`}>
        <Text className="text-center text-sm text-[#8F9098]">No upcoming appointments</Text>
      </View>
    );
  }

  return (
    <View className={`w-full ${className ?? ''}`}>
      <View className="w-full" style={stackContainerStyle}>
        {third ? (
          <Animated.View
            className="absolute left-0 right-0 z-0 px-3 shadow-none"
            pointerEvents="none"
            style={[
              deepStackStyle,
              { top: STACK_TOP_THIRD, elevation: 0, shadowOpacity: 0 },
            ]}>
            <AppointmentCardFace item={third} preview />
          </Animated.View>
        ) : null}

        {second ? (
          <Animated.View
            className="absolute left-0 right-0 z-[5] px-0.5 shadow-none"
            pointerEvents="none"
            style={[
              midStackStyle,
              { top: STACK_TOP_SECOND, elevation: 0, shadowOpacity: 0 },
            ]}>
            <AppointmentCardFace item={second} preview />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View
            className="z-10 w-full shadow-none"
            onLayout={onFrontCardLayout}
            style={[frontStyle, { elevation: 0, shadowOpacity: 0 }]}>
            <AppointmentCardFace item={front} />
          </Animated.View>
        </GestureDetector>
      </View>

      {stack.length > 1 && !hintUnmounted ? (
        <Animated.View className="mt-6" style={swipeHintStyle}>
          <Text
            className="text-center text-[11px] text-[#8F9098]"
            includeFontPadding={false}
            style={{ lineHeight: 13, marginVertical: 0, paddingVertical: 0 }}>
            Swipe left or right for next appointment
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
