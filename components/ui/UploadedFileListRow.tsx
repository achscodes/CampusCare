import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconDocumentUploadIcon } from '@/components/icons/IconDocumentUploadIcon';

// ── Design tokens (match Figma exactly) ──────────────────────────────────────
const PROGRESS_FILL = '#006FFD';
const TRACK_BG      = '#E9EAEB';
const RED           = '#D92D20';
const RED_BG        = '#FEF3F2';
const RED_BORDER    = '#FECDCA';

// ── Types ─────────────────────────────────────────────────────────────────────
export type UploadedFileListRowProps = {
  fileName: string;
  /** 0–100. When >= 100 the bar and % are hidden (upload complete). */
  progress?: number;
  /** Shows red border + message when provided. */
  error?: string;
  /** Custom icon — defaults to document-upload SVG. */
  fileThumbnail?: ReactNode;
  onRemove?: () => void;
  /** @deprecated Not shown in the new design */
  dateLabel?: string;
  /** @deprecated Not shown in the new design */
  timeLabel?: string;
  /** @deprecated Not shown in the new design */
  sizeLabel?: string;
  className?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────
export function UploadedFileListRow({
  fileName,
  progress,
  error,
  fileThumbnail,
  onRemove,
}: UploadedFileListRowProps) {
  const pct      = progress != null ? Math.min(100, Math.max(0, progress)) : null;
  const isDone   = pct != null && pct >= 100;
  const hasError = !!error;
  const showBar  = pct != null && !isDone && !hasError;

  return (
    <View style={[s.card, hasError && s.cardError]}>
      <View style={s.row}>

        {/* ── Left group: icon + content ── */}
        <View style={s.leftGroup}>
          {/* Pill icon wrap — matches Figma rounded-[999px] overflow-clip px-[2px] */}
          <View style={s.iconWrap}>
            {fileThumbnail ?? (
              <IconDocumentUploadIcon
                size={20}
                color={hasError ? RED : '#252B37'}
              />
            )}
          </View>

          {/* Content column */}
          <View style={s.content}>
            {/* Name + percentage row */}
            <View style={s.nameRow}>
              <Text style={s.fileName} numberOfLines={1} ellipsizeMode="middle">
                {fileName}
              </Text>
              {showBar && (
                <Text style={s.pctText}>{Math.round(pct!)}%</Text>
              )}
            </View>

            {/* Progress bar — in-progress only (Figma design 1) */}
            {showBar && (
              <View style={s.track}>
                <View style={[s.fill, { width: `${pct}%` as any }]} />
              </View>
            )}

            {/* Error message */}
            {hasError && (
              <Text style={s.errorText}>{error}</Text>
            )}
          </View>
        </View>

        {/* ── Remove ✕ button ── */}
        {onRemove ? (
          <Pressable
            accessibilityLabel={`Remove ${fileName}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onRemove}
            className="active:opacity-70"
            style={s.removeBtn}>
            <Ionicons name="close" size={12} color="#717680" />
          </Pressable>
        ) : null}

      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Card — Figma: bg #FAFAFA, radius 16, px 12, py 16
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  cardError: {
    backgroundColor: RED_BG,
    borderWidth: 1,
    borderColor: RED_BORDER,
  },
  // Outer row — gap 16 (Figma: gap-[16px] on the container)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  // Left group: icon + content — flex 1, gap 8 (Figma: gap-[8px])
  leftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  // Icon pill wrap — Figma: rounded-[999px] overflow-clip px-[2px]
  iconWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  // Content column
  content: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  // Name + % row — space-between
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Filename — Figma: 16px regular black
  fileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 20,
    minWidth: 0,
  },
  // Percentage — Figma: 14px light black
  pctText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#000000',
    lineHeight: 20,
    flexShrink: 0,
    marginLeft: 8,
  },
  // Progress track — Figma: h 7px, radius 4, bg #E9EAEB
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: TRACK_BG,
    overflow: 'hidden',
  },
  // Fill — Figma: bg #006FFD, radius 8
  fill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: PROGRESS_FILL,
  },
  // Error text
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: RED,
    lineHeight: 16,
    letterSpacing: -0.24,
  },
  // Remove button — Figma: 24x24 circle, bg #E9EAEB
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TRACK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
