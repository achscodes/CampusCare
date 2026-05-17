import Svg, { Path } from 'react-native-svg';
import { useId } from 'react';

type Props = {
  size?: number;
  color?: string;
};

/** `assets/icons/iconsax-tick-circle.svg` */
export function IconsaxTickCircleIcon({ size = 24, color = '#717680' }: Props) {
  const clipId = useId().replace(/:/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.75 11.9999L10.58 14.8299L16.25 9.16992"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
