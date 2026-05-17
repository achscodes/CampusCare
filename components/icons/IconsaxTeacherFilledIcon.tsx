import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  /** Default matches `assets/icons/iconsax-teacher-filled.svg` brand tag row. */
  color?: string;
};

/** `assets/icons/iconsax-teacher-filled.svg` */
export function IconsaxTeacherFilledIcon({ size = 24, color = '#00359E' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        opacity={0.4}
        d="M18.3801 12.8398V17.7698C18.3801 19.0398 17.3901 20.3998 16.2001 20.7998L13.0101 21.8598C12.4501 22.0498 11.5401 22.0498 10.9901 21.8598L7.80012 20.7998C6.60012 20.3998 5.62012 19.0398 5.62012 17.7698L5.63012 12.8398L10.0501 15.7198C11.1301 16.4298 12.9101 16.4298 13.9901 15.7198L18.3801 12.8398Z"
        fill={color}
      />
      <Path
        d="M19.98 6.46055L13.99 2.53055C12.91 1.82055 11.13 1.82055 10.05 2.53055L4.03002 6.46055C2.10002 7.71055 2.10002 10.5405 4.03002 11.8005L5.63002 12.8405L10.05 15.7205C11.13 16.4305 12.91 16.4305 13.99 15.7205L18.38 12.8405L19.75 11.9405V15.0005C19.75 15.4105 20.09 15.7505 20.5 15.7505C20.91 15.7505 21.25 15.4105 21.25 15.0005V10.0805C21.65 8.79055 21.24 7.29055 19.98 6.46055Z"
        fill={color}
      />
    </Svg>
  );
}
