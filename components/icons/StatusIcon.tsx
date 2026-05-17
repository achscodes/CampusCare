import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type StatusVariant = 'warning' | 'info' | 'error' | 'success';

type Props = {
  variant: StatusVariant;
  /**
   * Diameter of the coloured background circle in px.
   * The outer translucent ring adds ~8 px (4 per side) on top.
   * Figma uses size=40 (bg circle 40 px, icon 32 px, ring ~4 px each side).
   */
  size?: number;
};

const COLORS: Record<StatusVariant, { bg: string; icon: string; ring: string }> = {
  warning: { bg: '#FFF3E0', icon: '#FDB022', ring: 'rgba(255,208,100,0.25)' },
  info:    { bg: '#D1E0FF', icon: '#528BFF', ring: 'rgba(209,224,255,0.4)'  },
  error:   { bg: '#FECDCA', icon: '#F97066', ring: 'rgba(254,205,202,0.3)'  },
  success: { bg: '#D7F4A1', icon: '#17B26A', ring: 'rgba(215,244,161,0.3)'  },
};

/**
 * Renders the SVG icon paths at a fixed 32×32 viewport.
 * Each path is taken directly from the asset SVG files.
 */
function IconPaths({ variant, color }: { variant: StatusVariant; color: string }) {
  if (variant === 'success') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 30">
        <Path
          d="M8.5 15L13.5004 20L23.5 10"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }

  if (variant === 'info') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Path
          d="M16.0001 9.5H16"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M16 23.5V15.5"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (variant === 'warning') {
    return (
      <Svg width={32} height={32} viewBox="0 0 24 24">
        <Path
          d="M12.0008 20.4646H6.54599C3.42256 20.4646 2.11738 18.2323 3.62959 15.5049L6.43799 10.4462L9.08435 5.69354C10.6866 2.80414 13.315 2.80414 14.9172 5.69354L17.5636 10.4552L20.372 15.5139C21.8842 18.2413 20.57 20.4736 17.4556 20.4736H12.0008V20.4646Z"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M12.0012 9.82751V14.3281"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M11.9963 17.0283H12.0069"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (variant === 'error') {
    return (
      <Svg width={32} height={32} viewBox="0 0 28 28">
        <Path
          d="M22 14.2857C22 18.7018 18.416 22.2859 14 22.2859C9.584 22.2859 6 18.7018 6 14.2857C6 9.86969 9.584 6.28564 14 6.28564C18.416 6.28564 22 9.86969 22 14.2857Z"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M14 11.1997V15.7712"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M11.2572 5.71411H16.7429"
          stroke={color}
          strokeWidth="4"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return null;
}

export function StatusIcon({ variant, size = 40 }: Props) {
  const { bg, icon, ring } = COLORS[variant];
  const ringWidth = 4;

  return (
    /* Outer ring — transparent coloured border */
    <View
      style={{
        width: size + ringWidth * 2,
        height: size + ringWidth * 2,
        borderRadius: (size + ringWidth * 2) / 2,
        backgroundColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {/* Background circle */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <IconPaths variant={variant} color={icon} />
      </View>
    </View>
  );
}
