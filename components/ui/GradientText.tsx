import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

export type GradientTextProps = {
  children: string;
  /** NativeWind / Tailwind classes for typography (same on mask + measure text). */
  className?: string;
  /** Figma 1263:3171 — `from` #B4DBFF → `to` #EFF4FF, `bg-gradient-to-l`. */
  colors?: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

/**
 * Text filled with a linear gradient (Figma `bg-clip-text` equivalent).
 * Uses a mask so typography matches the rest of the app via `className`.
 */
export function GradientText({
  children,
  className,
  colors = ['#B4DBFF', '#EFF4FF'],
  start = { x: 1, y: 0 },
  end = { x: 0, y: 0 },
}: GradientTextProps) {
  return (
    <MaskedView
      androidRenderingMode="software"
      style={{ flexShrink: 1 }}
      maskElement={
        <View className="bg-transparent">
          <Text className={className} style={{ color: '#000000' }}>
            {children}
          </Text>
        </View>
      }>
      <LinearGradient colors={[...colors]} start={start} end={end}>
        <Text className={className} style={{ opacity: 0 }}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
