import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  Text,
  View,
  type ViewToken,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Button } from 'heroui-native';

const BRAND_ICON = '#B4DBFF';

export type PromoBannerItem = {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  onButtonPress?: () => void;
  /** Remote or local URI for the right slot; placeholder icon if omitted. */
  imageUrl?: string | null;
};

export type PromoBannerCarouselProps = {
  items: PromoBannerItem[];
  className?: string;
};

/**
 * CampusCare promo banner carousel (Figma node 703:33217).
 * Card: #EAF2FF, 16px radius, 160px height; CTA pill; optional image; dot pager.
 */
export function PromoBannerCarousel({ items, className }: PromoBannerCarouselProps) {
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

  const onScrollMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / width);
      if (next >= 0 && next < items.length) {
        setActiveIndex(next);
      }
    },
    [width, items.length],
  );

  const renderItem = useCallback(
    ({ item }: { item: PromoBannerItem }) => (
      <View style={{ width }} className="min-h-[160px] flex-row overflow-hidden rounded-2xl bg-[#EAF2FF]">
        <View className="min-h-[160px] min-w-0 flex-1 justify-center gap-4 py-5 pl-5 pr-4">
          <View className="gap-1">
            <Text className="text-sm font-bold leading-tight text-[#1F2024]" numberOfLines={2}>
              {item.title}
            </Text>
            <Text
              className="text-xs leading-4 text-[#494A50]"
              numberOfLines={4}
              style={{ letterSpacing: 0.12 }}>
              {item.description}
            </Text>
          </View>
          <Button
            variant="primary"
            className="h-9 self-start rounded-3xl border border-[#001229]/10 bg-[#2970FF] px-4"
            onPress={() => item.onButtonPress?.()}>
            <Button.Label className="text-sm font-semibold text-white">{item.buttonLabel}</Button.Label>
          </Button>
        </View>
        <View className="min-h-[160px] w-[100px] items-center justify-center self-stretch bg-[#EAF2FF] px-10 py-10">
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons name="image-outline" size={32} color={BRAND_ICON} accessibilityRole="image" />
          )}
        </View>
      </View>
    ),
    [width],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View className={`w-full items-center gap-3 ${className ?? ''}`} onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          style={{ width }}
          data={items}
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
        <View className="h-40 w-full flex-row overflow-hidden rounded-2xl bg-[#EAF2FF]" />
      )}

      {items.length > 1 ? (
        <View className="flex-row items-center gap-1.5">
          {items.map((item, i) => (
            <View
              key={item.id}
              className={`h-2 w-2 rounded-full ${i === activeIndex ? 'bg-[#2970FF]' : 'bg-[#1F2024]/10'}`}
              accessibilityLabel={i === activeIndex ? `Slide ${i + 1} of ${items.length}, current` : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
