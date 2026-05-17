import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  /** Default matches `assets/icons/iconsax-sort.svg` on light backgrounds. */
  color?: string;
};

/** `assets/icons/iconsax-sort.svg` */
export function IconsaxSortIcon({ size = 24, color = '#717680' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7H21"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M6 12H18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M10 17H14"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
