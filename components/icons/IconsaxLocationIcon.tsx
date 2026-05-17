import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  /** Default matches `assets/icons/iconsax-location.svg` stroke on dark; use `#717680` on light fields. */
  color?: string;
};

/** `assets/icons/iconsax-location.svg` */
export function IconsaxLocationIcon({ size = 24, color = '#FFFFFF' }: Props) {
  const clipId = useId().replace(/:/g, '');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G clipPath={`url(#${clipId})`}>
        <Path
          d="M12 13.4295C13.7231 13.4295 15.12 12.0326 15.12 10.3095C15.12 8.58633 13.7231 7.18945 12 7.18945C10.2769 7.18945 8.88 8.58633 8.88 10.3095C8.88 12.0326 10.2769 13.4295 12 13.4295Z"
          stroke={color}
          strokeWidth={1.5}
        />
        <Path
          d="M3.61995 8.49C5.58995 -0.169998 18.42 -0.159997 20.38 8.5C21.53 13.58 18.37 17.88 15.6 20.54C13.59 22.48 10.41 22.48 8.38995 20.54C5.62995 17.88 2.46995 13.57 3.61995 8.49Z"
          stroke={color}
          strokeWidth={1.5}
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
