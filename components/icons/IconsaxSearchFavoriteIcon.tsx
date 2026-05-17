import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** `assets/icons/iconsax-search-favorite.svg` */
export function IconsaxSearchFavoriteIcon({ size = 24, color = '#2970FF' }: Props) {
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
          d="M10.97 20.02C15.94 20.02 19.97 15.99 19.97 11.02C19.97 6.05002 15.94 2.02002 10.97 2.02002C6 2.02002 1.97 6.04002 1.97 11.02C1.97 16 6 20.02 10.97 20.02Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M18.87 20.48C19.15 22.14 20.33 22.48 21.46 21.24C22.49 20.1 22.1 18.98 20.57 18.75C19.44 18.57 18.68 19.34 18.87 20.48Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M7.7 11.16C7.32 9.96997 7.77 8.47997 9.02 8.07997C9.68 7.85997 10.49 8.04997 10.96 8.68997C11.39 8.02997 12.24 7.87997 12.89 8.07997C14.15 8.47997 14.59 9.96997 14.21 11.16C13.61 13.06 11.53 14.04 10.96 14.04C10.39 14.04 8.31 13.08 7.7 11.16Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
