import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** `assets/icons/iconsax-timer.svg` */
export function IconsaxTimerIcon({ size = 16, color = '#252B37' }: Props) {
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
          d="M20.75 13.25C20.75 18.08 16.83 22 12 22C7.17 22 3.25 18.08 3.25 13.25C3.25 8.42 7.17 4.5 12 4.5C16.83 4.5 20.75 8.42 20.75 13.25Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12 8V13"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M9 2H15"
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
