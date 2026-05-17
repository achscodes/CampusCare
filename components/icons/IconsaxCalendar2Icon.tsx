import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** `assets/icons/iconsax-calendar-2.svg` */
export function IconsaxCalendar2Icon({ size = 20, color = '#2970FF' }: Props) {
  const clipId = useId().replace(/:/g, '');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G clipPath={`url(#${clipId})`}>
        <Path
          d="M3 18V8C3 5.8 4.8 4 7 4H17C19.2 4 21 5.8 21 8V18C21 20.2 19.2 22 17 22H7C4.8 22 3 20.2 3 18Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15.5 6V2"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M8.5 6V2"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12.9996 18V10L9.59961 13.4"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <Defs>
        <ClipPath id={clipId}>
          <Rect width={24} height={24} fill="none" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
