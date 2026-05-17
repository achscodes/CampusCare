import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  /** Default matches link color (`brand/text-brand-secondary`). */
  color?: string;
};

/** `components/icons/iconsax-import-circle-01.svg` */
export function IconsaxImportCircleIcon({ size = 20, color = '#004EEB' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.31982 11.6797L11.8798 14.2397L14.4398 11.6797"
        stroke={color}
        strokeWidth={1.5}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.8799 4V14.17"
        stroke={color}
        strokeWidth={1.5}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 12.1797C20 16.5997 17 20.1797 12 20.1797C7 20.1797 4 16.5997 4 12.1797"
        stroke={color}
        strokeWidth={1.5}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
