import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const BRAND = '#2970FF';
const TRACK = '#E8E9F1';

export type CircularProgressRingProps = {
  /** 0–100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

/**
 * Donut progress with centered percent label (Figma upload file row).
 */
export function CircularProgressRing({
  percent,
  size = 40,
  strokeWidth = 4,
  className,
}: CircularProgressRingProps) {
  const p = clamp(percent);
  const r = (size - strokeWidth) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - p / 100);

  return (
    <View
      className={`items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={TRACK}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={BRAND}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <Text className="text-xs font-semibold text-[#1F2024]">{Math.round(p)}%</Text>
    </View>
  );
}
