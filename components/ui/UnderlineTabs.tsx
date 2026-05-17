import { useEffect, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Tabs, useTabs, useTabsMeasurements } from 'heroui-native';

const BRAND_UNDERLINE = '#006FFD';
const INDICATOR_SPRING = { stiffness: 1200, damping: 120 } as const;

/** Default underline: shorter than tab width; height = former 2px bar + 2px (Figma-style). */
const DEFAULT_INDICATOR_WIDTH = 20;
const DEFAULT_INDICATOR_HEIGHT = 4;

/** Single tab definition (Figma labels: e.g. "My Case", "My Sanctions"). */
export type UnderlineTabItem = {
  value: string;
  label: string;
};

export type UnderlineTabsProps = {
  /** Controlled selected tab value. */
  value: string;
  onValueChange: (value: string) => void;
  tabs: UnderlineTabItem[];
  /**
   * `Tabs.Content` nodes — one per `tabs[].value`, same `value` prop on each.
   * @example
   * <UnderlineTabs ...>
   *   <Tabs.Content value="a">…</Tabs.Content>
   * </UnderlineTabs>
   */
  children: ReactNode;
  /** Root `Tabs` className (e.g. `flex-1`). */
  className?: string;
  /** `Tabs.List` className override. */
  listClassName?: string;
  /** Underline width in px (shorter than full tab). @default 20 */
  indicatorWidth?: number;
  /** Underline thickness in px. @default 4 */
  indicatorHeight?: number;
};

function UnderlineTabIndicator({
  barWidth,
  barHeight,
}: {
  barWidth: number;
  barHeight: number;
}) {
  const { value } = useTabs();
  const { measurements } = useTabsMeasurements();
  const translateX = useSharedValue(0);

  const m = measurements[value];

  useEffect(() => {
    if (!m) return;
    translateX.value = withSpring(m.x + (m.width - barWidth) / 2, INDICATOR_SPRING);
  }, [value, measurements, barWidth, m, translateX]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: barWidth,
    height: barHeight,
    borderRadius: 2,
    backgroundColor: BRAND_UNDERLINE,
    transform: [{ translateX: translateX.value }],
  }));

  if (!m) {
    return null;
  }

  return <Animated.View pointerEvents="none" style={style} />;
}

/**
 * Horizontal underline tabs (CampusCare Figma 703:33546): 12px gap, 44px row, 14px labels,
 * active `#1F2024` bold + short brand underline, inactive `#71727A` regular — built on HeroUI Native
 * `Tabs` **secondary** variant with a custom centered indicator.
 */
export function UnderlineTabs({
  value,
  onValueChange,
  tabs,
  children,
  className,
  listClassName,
  indicatorWidth = DEFAULT_INDICATOR_WIDTH,
  indicatorHeight = DEFAULT_INDICATOR_HEIGHT,
}: UnderlineTabsProps) {
  return (
    <Tabs className={className} value={value} variant="secondary" onValueChange={onValueChange}>
      <Tabs.List
        className={
          listClassName ??
          'relative w-full flex-row items-center justify-center gap-3 border-0 bg-transparent p-0'
        }>
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            className="h-11 min-h-[44px] justify-center rounded-xl px-4 py-2"
            value={tab.value}>
            {({ isSelected }) => (
              <Tabs.Label
                className={
                  isSelected
                    ? 'text-center text-sm font-bold leading-normal text-[#1F2024]'
                    : 'text-center text-sm font-normal leading-5 text-[#71727A]'
                }>
                {tab.label}
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        ))}
        <UnderlineTabIndicator barHeight={indicatorHeight} barWidth={indicatorWidth} />
      </Tabs.List>
      {children}
    </Tabs>
  );
}
