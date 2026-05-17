import { StyleSheet, Text, View } from 'react-native';

import { IconsaxDangerIcon } from '@/components/icons/IconsaxDangerIcon';

type Tone = 'error' | 'warning';

type AuthErrorBannerProps = {
  message: string;
  tone?: Tone;
};

type Theme = {
  border: string;
  bg: string;
  iconBg: string;
  text: string;
  icon: string;
};

const THEME: Record<Tone, Theme> = {
  error: {
    border: '#FEE4E2',
    bg: '#FFFBFA',
    iconBg: '#FEE4E2',
    text: '#912018',
    icon: '#D92D20',
  },
  warning: {
    border: '#FEDF89',
    bg: '#FFFCF5',
    iconBg: '#FEF0C7',
    text: '#93370D',
    icon: '#DC6803',
  },
};

/**
 * Inline alert card shown above auth forms. The triangular danger icon is
 * centered within a tinted circular badge that aligns to the first line of
 * the message.
 */
export function AuthErrorBanner({ message, tone = 'warning' }: AuthErrorBannerProps) {
  const t = THEME[tone];

  return (
    <View style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.iconBadge, { backgroundColor: t.iconBg }]}>
        <IconsaxDangerIcon size={18} color={t.icon} />
      </View>
      <Text style={[styles.message, { color: t.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.13,
  },
});