import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** `assets/icons/iconsax-calendar.svg` */
export function IconsaxCalendarIcon({ size = 20, color = '#FFFFFF' }: Props) {
  const clipId = useId().replace(/:/g, '');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G clipPath={`url(#${clipId})`}>
        <Path
          d="M8 2V5"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M16 2V5"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M3.5 9.08984H20.5"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15.6947 13.6992H15.7037"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M15.6947 16.6992H15.7037"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M11.9955 13.6992H12.0045"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M11.9955 16.6992H12.0045"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M8.29431 13.6992H8.30329"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M8.29431 16.6992H8.30329"
          stroke={color}
          strokeWidth={2}
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
