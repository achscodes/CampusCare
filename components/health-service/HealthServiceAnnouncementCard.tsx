import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';

import { SCHEDULE_PARTNER } from '../../lib/health-service/bookingScheduleTheme';

const BRAND = SCHEDULE_PARTNER.brand;

const SLIDE_COUNT = 3;
const AUTO_MS = 5000;

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  sub: string;
  a11y: string;
  /** Slight layout variation for background shapes (0–2). */
  decor: 0 | 1 | 2;
};

const SLIDES: Slide[] = [
  {
    id: 'a',
    eyebrow: 'Campus health',
    title: 'This week: longer walk-in hours for vitals & quick questions.',
    sub: 'Mon–Thu · Student Health · Bring your ID (demo copy).',
    a11y: 'Campus health. This week longer walk-in hours Monday through Thursday.',
    decor: 0,
  },
  {
    id: 'b',
    eyebrow: 'Flu & vaccines',
    title: 'Free flu shots for students — no appointment needed this Friday.',
    sub: 'Gym lobby · 10 AM–2 PM · Bring your campus ID (demo copy).',
    a11y: 'Flu and vaccines. Free flu shots for students Friday gym lobby ten to two.',
    decor: 1,
  },
  {
    id: 'c',
    eyebrow: 'Wellness tip',
    title: 'Short on sleep? Hydrate, stretch, and reach out if stress lasts more than two weeks.',
    sub: 'Counseling & Health are here to help (demo copy).',
    a11y: 'Wellness tip about sleep hydration and reaching out for stress.',
    decor: 2,
  },
];

function SlideDecor({ variant }: { variant: 0 | 1 | 2 }) {
  const blueBlob = variant === 1 ? { top: -24 as const, left: -18 as const, right: undefined, bottom: undefined } : { top: -28 as const, right: -20 as const, left: undefined, bottom: undefined };
  const mintBlob =
    variant === 2
      ? { bottom: -32 as const, right: -24 as const, left: undefined, top: undefined }
      : { bottom: -36 as const, left: -28 as const, right: undefined, top: undefined };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
      <View
        style={{
          position: 'absolute',
          ...blueBlob,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: variant === 2 ? 'rgba(41, 112, 255, 0.08)' : 'rgba(41, 112, 255, 0.1)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          ...mintBlob,
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 12,
          right: variant === 1 ? 20 : 12,
          width: 72,
          height: 28,
          borderRadius: 14,
          backgroundColor: 'rgba(41, 112, 255, 0.07)',
          transform: [{ rotate: variant === 0 ? '-8deg' : variant === 1 ? '6deg' : '-4deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: variant === 2 ? 22 : 18,
          right: variant === 1 ? 40 : 56,
          width: 26,
          height: 26,
          opacity: 0.4,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View style={{ position: 'absolute', width: 3, height: 22, borderRadius: 2, backgroundColor: BRAND }} />
        <View style={{ position: 'absolute', width: 22, height: 3, borderRadius: 2, backgroundColor: BRAND }} />
      </View>
      <View
        style={{
          position: 'absolute',
          top: 42,
          left: variant === 2 ? 20 : 12,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(41, 112, 255, 0.18)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 54,
          left: variant === 1 ? 22 : 28,
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: 'rgba(16, 185, 129, 0.22)',
        }}
      />
    </View>
  );
}

function SlidePanel({ slide, width }: { slide: Slide; width: number }) {
  return (
    <View style={{ width, paddingVertical: 14, paddingHorizontal: 16, minHeight: 118, position: 'relative', overflow: 'hidden' }}>
      <SlideDecor variant={slide.decor} />
      <View style={{ zIndex: 1, gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND, letterSpacing: 0.8, textTransform: 'uppercase' }}>{slide.eyebrow}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: SCHEDULE_PARTNER.textPrimary, lineHeight: 21, letterSpacing: -0.2 }}>{slide.title}</Text>
        <Text style={{ fontSize: 13, fontWeight: '400', color: SCHEDULE_PARTNER.textMuted, lineHeight: 19 }}>{slide.sub}</Text>
      </View>
    </View>
  );
}

/**
 * Three announcement slides with health-themed decor, dot pager, and auto-advance.
 */
export function HealthServiceAnnouncementCard() {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(() => Math.max(0, Dimensions.get('window').width - 16 * 2));
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  const syncIndexFromOffset = useCallback(
    (x: number) => {
      if (width <= 0) return;
      const i = Math.min(SLIDE_COUNT - 1, Math.max(0, Math.round(x / width)));
      indexRef.current = i;
      setIndex(i);
    },
    [width],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncIndexFromOffset(e.nativeEvent.contentOffset.x);
    },
    [syncIndexFromOffset],
  );

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (width <= 0) return;
    const id = setInterval(() => {
      const next = (indexRef.current + 1) % SLIDE_COUNT;
      indexRef.current = next;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [width]);

  const activeSlide = SLIDES[index];

  return (
    <View style={{ gap: 10 }}>
      <View
        accessible
        accessibilityLabel={`Announcement ${index + 1} of ${SLIDE_COUNT}. ${activeSlide?.a11y ?? ''}`}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
        }}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: SCHEDULE_PARTNER.cardBorder,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyboardShouldPersistTaps="handled">
          {SLIDES.map((slide) => (
            <SlidePanel key={slide.id} slide={slide} width={width} />
          ))}
        </ScrollView>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? BRAND : 'rgba(148, 163, 184, 0.55)',
            }}
          />
        ))}
      </View>
    </View>
  );
}
