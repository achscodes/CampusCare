/**
 * Global shared design tokens used across features.
 * Promotes consistency and prevents cross-feature import leaks.
 */
export const SCHEDULE_PARTNER = {
  radius: 20,
  cardBorder: 'rgba(15, 23, 42, 0.08)',
  surface: '#FFFFFF',
  divider: '#EEF2F6',
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  textDisabled: '#94A3B8',
  borderCell: '#E8EEF4',
  /** Neutral track for week arrows / period tabs — no blue outline */
  segmentTrackBg: '#F8FAFC',
  segmentTrackBorder: '#E8EEF4',
  brand: '#2970FF',
  slotTint: 'rgba(41, 112, 255, 0.08)',
} as const;
