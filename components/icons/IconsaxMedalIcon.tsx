import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  /** Medal stroke; default reads well on white (Figma gold accent). */
  color?: string;
};

/** `assets/icons/iconsax-medal.svg` */
export function IconsaxMedalIcon({ size = 24, color = '#E8A317' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15C15.7279 15 18.75 12.0899 18.75 8.5C18.75 4.91015 15.7279 2 12 2C8.27208 2 5.25 4.91015 5.25 8.5C5.25 12.0899 8.27208 15 12 15Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.51999 13.5198L7.51001 20.8998C7.51001 21.7998 8.14001 22.2398 8.92001 21.8698L11.6 20.5999C11.82 20.4899 12.19 20.4899 12.41 20.5999L15.1 21.8698C15.87 22.2298 16.51 21.7998 16.51 20.8998V13.3398"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
