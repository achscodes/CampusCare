import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** Matches `assets/icons/iconsax-menu.svg` — use for the drawer trigger. */
export function IconsaxMenuIcon({ size = 32, color = '#1F2024' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16.0001 22.6666H25.3334M6.66675 15.9999H25.3334M6.66675 9.33325H25.3334"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </Svg>
  );
}
