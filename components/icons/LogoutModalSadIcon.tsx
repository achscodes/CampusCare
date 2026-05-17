import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

/** `assets/icons/iconsax-sad.svg` — paths traced 1:1. */
export function LogoutModalSadIcon({ size = 24, color = '#F04438' }: Props) {
  const clipId = `logout_sad_${useId().replace(/:/g, '_')}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id={clipId}>
          <Rect width="24" height="24" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        {/* Outer rounded square */}
        <Path
          d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Left eyebrow / eye arch */}
        <Path
          d="M7 8.75C8 7.75 9.63 7.75 10.64 8.75"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right eyebrow / eye arch */}
        <Path
          d="M13.36 8.75C14.36 7.75 15.99 7.75 17 8.75"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Sad mouth */}
        <Path
          d="M8.4 17.7008H15.6C16.1 17.7008 16.5 17.3008 16.5 16.8008C16.5 14.3108 14.49 12.3008 12 12.3008C9.51 12.3008 7.5 14.3108 7.5 16.8008C7.5 17.3008 7.9 17.7008 8.4 17.7008Z"
          stroke={color}
          strokeWidth={1.5}
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
