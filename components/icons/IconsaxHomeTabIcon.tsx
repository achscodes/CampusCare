import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

export const HOME_TAB_ICON_INACTIVE = '#0C0C0C';
export const HOME_TAB_ICON_ACTIVE = '#2970FF';

type Props = {
  focused: boolean;
  size?: number;
};

export function IconsaxHomeTabIcon({ focused, size = 24 }: Props) {
  const uid = useId().replace(/:/g, '_');
  const clipId = `iconsax_home_${uid}`;

  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Defs>
          <ClipPath id={clipId}>
            <Rect width="24" height="24" fill="white" />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Path
            d="M20.83 8.01002L14.28 2.77002C13 1.75002 11 1.74002 9.72996 2.76002L3.17996 8.01002C2.23996 8.76002 1.66996 10.26 1.86996 11.44L3.12996 18.98C3.41996 20.67 4.98996 22 6.69996 22H17.3C18.99 22 20.59 20.64 20.88 18.97L22.14 11.43C22.32 10.26 21.75 8.76002 20.83 8.01002Z"
            fill={HOME_TAB_ICON_ACTIVE}
            opacity={0.4}
          />
          <Path
            d="M12 18.75C11.59 18.75 11.25 18.41 11.25 18V15C11.25 14.59 11.59 14.25 12 14.25C12.41 14.25 12.75 14.59 12.75 15V18C12.75 18.41 12.41 18.75 12 18.75Z"
            fill={HOME_TAB_ICON_ACTIVE}
          />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id={clipId}>
          <Rect width="24" height="24" fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Path
          d="M12 18.75C11.59 18.75 11.25 18.41 11.25 18V15C11.25 14.59 11.59 14.25 12 14.25C12.41 14.25 12.75 14.59 12.75 15V18C12.75 18.41 12.41 18.75 12 18.75Z"
          fill={HOME_TAB_ICON_INACTIVE}
        />
        <Path
          d="M17.6 22.5608H6.39996C4.57996 22.5608 2.91996 21.1608 2.61996 19.3708L1.28996 11.4008C1.06996 10.1608 1.67996 8.5708 2.66996 7.7808L9.59996 2.2308C10.94 1.1508 13.05 1.1608 14.4 2.2408L21.33 7.7808C22.31 8.5708 22.91 10.1608 22.71 11.4008L21.38 19.3608C21.08 21.1308 19.38 22.5608 17.6 22.5608ZM11.99 2.9308C11.46 2.9308 10.93 3.0908 10.54 3.4008L3.60996 8.9608C3.04996 9.4108 2.64996 10.4508 2.76996 11.1608L4.09996 19.1208C4.27996 20.1708 5.32996 21.0608 6.39996 21.0608H17.6C18.67 21.0608 19.72 20.1708 19.9 19.1108L21.23 11.1508C21.34 10.4508 20.94 9.3908 20.39 8.9508L13.46 3.4108C13.06 3.0908 12.52 2.9308 11.99 2.9308Z"
          fill={HOME_TAB_ICON_INACTIVE}
        />
      </G>
    </Svg>
  );
}
