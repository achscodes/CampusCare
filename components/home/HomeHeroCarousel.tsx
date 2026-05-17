import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  Pressable,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { IconsaxHospitalFilledIcon } from '@/components/icons/IconsaxHospitalFilledIcon';
import { IconsaxJudgeFilledIcon } from '@/components/icons/IconsaxJudgeFilledIcon';
import { IconsaxTeacherFilledIcon } from '@/components/icons/IconsaxTeacherFilledIcon';

const HERO_SOLID = '#2970FF';
const HERO_BORDER = 'rgba(0, 64, 193, 0.35)';
const BADGE_ICON = '#2970FF';
/** Inactive pager dot (light grey). */
const DOT_INACTIVE = '#D1D5DB';
/** Active pager dot (darker gray). */
const DOT_ACTIVE = '#6B7280';

export type HomeHeroBadge = 'hospital' | 'teacher' | 'judge';

export type HomeHeroSlide = {
  id: string;
  badge: HomeHeroBadge;
  title: string;
  description: string;
  ctaLabel: string;
  onCtaPress?: () => void;
};

export type HomeHeroCarouselProps = {
  slides: HomeHeroSlide[];
  className?: string;
};

function HeroBadgeIcon({ type, size }: { type: HomeHeroBadge; size: number }) {
  switch (type) {
    case 'hospital':
      return <IconsaxHospitalFilledIcon size={size} color={BADGE_ICON} />;
    case 'teacher':
      return <IconsaxTeacherFilledIcon size={size} color={BADGE_ICON} />;
    case 'judge':
      return <IconsaxJudgeFilledIcon size={size} color={BADGE_ICON} />;
  }
}

/**
 * Slidable hero cards: solid brand blue, Iconsax badges, white pill CTA.
 */
export function HomeHeroCarousel({ slides, className }: HomeHeroCarouselProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const idx = viewableItems[0]?.index;
      if (typeof idx === 'number') {
        setActiveIndex(idx);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const flatListRef = useRef<FlatList<HomeHeroSlide>>(null);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (slides.length <= 1 || width <= 0) return;
    const timer = setInterval(() => {
      const next = (activeIndexRef.current + 1) % slides.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length, width]);

  const onScrollMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / width);
      if (next >= 0 && next < slides.length) {
        setActiveIndex(next);
      }
    },
    [width, slides.length],
  );

  const renderItem = useCallback(
    ({ item }: { item: HomeHeroSlide }) => (
      <View style={{ width }} className="px-0">
        <View
          className="overflow-hidden rounded-3xl"
          style={{
            borderWidth: 1,
            borderColor: HERO_BORDER,
            backgroundColor: HERO_SOLID,
            minHeight: 220,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 20,
          }}>
          {/* Decorative wave curves */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 300">
              {/* Filled wave band — top */}
              <Path
                d="M0 0 L0 60 Q60 30 130 55 T260 35 T400 50 L400 0 Z"
                fill="rgba(255,255,255,0.04)"
              />
              {/* Filled wave band — bottom */}
              <Path
                d="M0 300 L0 220 Q80 190 170 215 T340 195 L400 200 L400 300 Z"
                fill="rgba(255,255,255,0.035)"
              />
              {/* Stroke wave — upper sweep */}
              <Path
                d="M-20 70 C60 20 140 90 220 55 S340 15 420 45"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={2}
                fill="none"
              />
              {/* Stroke wave — mid flow */}
              <Path
                d="M-20 155 C70 110 150 175 240 140 S360 100 420 130"
                stroke="rgba(255,255,255,0.09)"
                strokeWidth={1.8}
                fill="none"
              />
              {/* Stroke wave — lower gentle curve */}
              <Path
                d="M-20 230 C90 195 180 250 280 215 S380 185 420 205"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1.5}
                fill="none"
              />
            </Svg>
          </View>

          <View className="min-h-[190px] justify-between">
            <View className="gap-3">
              <View className="self-start rounded-2xl bg-white px-2.5 py-2.5 opacity-85">
                <HeroBadgeIcon type={item.badge} size={24} />
              </View>
              <Text className="text-2xl font-bold leading-8 text-white" numberOfLines={3}>
                {item.title}
              </Text>
              <Text className="text-base font-normal leading-6 text-white/90" numberOfLines={3}>
                {item.description}
              </Text>
            </View>


            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.ctaLabel}
              onPress={() => item.onCtaPress?.()}
              className="mt-5 w-full items-center justify-center rounded-full bg-white py-3.5 active:opacity-95">
              <Text className="text-base font-semibold text-[#2970FF]">{item.ctaLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [width],
  );

  if (slides.length === 0) {
    return null;
  }

  return (
    <View className={`w-full items-center gap-3 ${className ?? ''}`} onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          ref={flatListRef}
          style={{ width }}
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={onScrollMomentumEnd}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
        />
      ) : (
        <View
          className="h-[220px] w-full rounded-3xl"
          style={{ borderWidth: 1, borderColor: HERO_BORDER, backgroundColor: HERO_SOLID }}
        />
      )}

      {slides.length > 1 ? (
        <View className="flex-row items-center gap-1.5">
          {slides.map((item, i) => (
            <View
              key={item.id}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: i === activeIndex ? DOT_ACTIVE : DOT_INACTIVE }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
