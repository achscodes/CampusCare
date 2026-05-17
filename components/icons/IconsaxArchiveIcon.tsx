import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** Archive box icon (Iconsax style) */
export function IconsaxArchiveIcon({ size = 24, color = '#2970FF' }: Props) {
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
          d="M21 7V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V7C3 4 4.5 2 8 2H16C19.5 2 21 4 21 7Z"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15.5 2V9.86C15.5 10.3 14.98 10.54 14.64 10.27L12.36 8.47C12.16 8.31 11.85 8.31 11.64 8.47L9.36 10.27C9.02 10.54 8.5 10.3 8.5 9.86V2"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9 14H15"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
