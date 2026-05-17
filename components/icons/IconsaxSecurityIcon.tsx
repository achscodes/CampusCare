import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** Security/shield icon (Iconsax style) */
export function IconsaxSecurityIcon({ size = 24, color = '#2970FF' }: Props) {
  const clipId = useId().replace(/:/g, '_');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id={clipId}>
          <Rect width="24" height="24" fill="none" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Path
          d="M11.9999 22C11.9999 22 20.3999 18 20.3999 12V5L11.9999 2L3.59985 5V12C3.59985 18 11.9999 22 11.9999 22Z"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9 12L11 14L15 10"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
