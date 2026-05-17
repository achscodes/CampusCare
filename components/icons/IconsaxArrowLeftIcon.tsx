import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  /** Default matches `assets/icons/iconsax-arrow-left.svg` stroke. */
  color?: string;
};

/** `assets/icons/iconsax-arrow-left.svg` */
export function IconsaxArrowLeftIcon({ size = 20, color = '#181D27' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.9998 19.9201L8.47984 13.4001C7.70984 12.6301 7.70984 11.3701 8.47984 10.6001L14.9998 4.08008"
        stroke={color}
        strokeWidth={1.5}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
