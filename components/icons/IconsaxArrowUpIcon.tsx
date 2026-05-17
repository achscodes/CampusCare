import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  /** Default matches `assets/icons/iconsax-arrow-up.svg` stroke. */
  color?: string;
};

/** `assets/icons/iconsax-arrow-up.svg` */
export function IconsaxArrowUpIcon({ size = 18, color = '#717680' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.9201 15.0496L13.4001 8.52965C12.6301 7.75965 11.3701 7.75965 10.6001 8.52965L4.08008 15.0496"
        stroke={color}
        strokeWidth={1.5}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
