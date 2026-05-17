import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconsaxTimerIcon } from '@/components/icons/IconsaxTimerIcon';
import { IconsaxVerifyIcon } from '@/components/icons/IconsaxVerifyIcon';

// ── Design tokens ─────────────────────────────────────────────────────────────
const PROGRESS_FILL = '#006FFD';
const PROGRESS_TRACK = '#E9EAEB';
const UPLOAD_BTN_BG = '#2970FF';
const UPLOAD_BTN_BORDER = '#84ADFF';

const STATUS_TOKENS: Record<SanctionStatus, { bg: string; border: string; text: string; label: string }> = {
  in_progress: { bg: '#EFF4FF', border: '#D1E0FF', text: '#2970FF', label: 'In Progress' },
  pending:     { bg: '#FFFAEB', border: '#FEF0C7', text: '#F79009', label: 'Pending' },
  in_review:   { bg: '#ECFDF3', border: '#DCFAE6', text: '#17B26A', label: 'In Review' },
  case_closed: { bg: '#EFF4FF', border: '#D1E0FF', text: '#2970FF', label: 'Case Closed' },
};

// ── Dashed separator ─────────────────────────────────────────────────────────
const DASHES = Array.from({ length: 45 });
function DashedRule() {
  return (
    <View style={s.dashedRow}>
      {DASHES.map((_, i) => <View key={i} style={s.dash} />)}
    </View>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type SanctionStatus = 'in_progress' | 'pending' | 'in_review' | 'case_closed';

export type SanctionType =
  | 'community_service'
  | 'disciplinary_warning'
  | 'probation'
  | 'suspension'
  | 'other';

const SANCTION_TYPE_LABELS: Record<SanctionType, string> = {
  community_service:    'Community Service',
  disciplinary_warning: 'Disciplinary Warning',
  probation:            'Probation',
  suspension:           'Suspension',
  other:                'Other',
};

export type SanctionProgress = {
  current: number;
  total: number;
  unit: string;
};

export type SanctionCardProps = {
  status: SanctionStatus;
  title: string;
  description: string;
  sanctionType?: SanctionType;
  dueDateLabel: string;
  progress?: SanctionProgress;
  /** Relative time label shown top-right, e.g. "1 hour ago" */
  timeAgoLabel?: string;
  /** Date string for the submitted footer, e.g. "Apr 20, 2026" */
  submittedAtLabel?: string;
  /** Date string for the completed footer, e.g. "Apr 20, 2026" */
  completedAtLabel?: string;
  onUploadProof?: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────
export function SanctionCard({
  status,
  title,
  description,
  sanctionType,
  dueDateLabel,
  progress,
  timeAgoLabel,
  submittedAtLabel,
  completedAtLabel,
  onUploadProof,
}: SanctionCardProps) {
  const token = STATUS_TOKENS[status];
  const pct = progress
    ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100))
    : 0;

  const showProgress = !!progress && status === 'in_progress';
  const showUploadBtn = (status === 'in_progress' || status === 'pending') && !!onUploadProof;
  const showSubmitted = status === 'in_review' && !!submittedAtLabel;
  const showCompleted = status === 'case_closed' && !!completedAtLabel;

  const isDisabled = status === 'case_closed';

  return (
    <View style={[s.card, isDisabled && s.cardDisabled]}>
      <View style={s.inner}>

        {/* ── Title + description + pills ── */}
        <View style={s.topSection}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={2}>{title}</Text>
            {timeAgoLabel ? <Text style={s.timeAgo}>{timeAgoLabel}</Text> : null}
          </View>

          <Text style={s.description}>{description}</Text>

          <View style={s.pillsRow}>
            {/* Status pill — hidden when progress bar shows (in_progress) or status is pending */}
            {!showProgress && status !== 'pending' ? (
              <View style={[s.pill, { backgroundColor: token.bg, borderColor: token.border }]}>
                <Text style={[s.pillText, { color: token.text }]}>{token.label}</Text>
              </View>
            ) : null}

            {/* Due date pill */}
            <View style={[s.pill, s.pillLight, s.pillRow]}>
              <IconsaxTimerIcon size={14} color="#717680" />
              <Text style={s.pillTextDark}>{dueDateLabel}</Text>
            </View>

            {/* Sanction type pill */}
            {sanctionType ? (
              <View style={[s.pill, s.pillLight]}>
                <Text style={s.pillTextDark}>{SANCTION_TYPE_LABELS[sanctionType]}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Separator ── */}
        <DashedRule />

        {/* ── Progress (in_progress only) ── */}
        {showProgress ? (
          <>
            <View style={s.progressSection}>
              <View style={s.progressLabelRow}>
                <Text style={s.progressLabel}>Overall Progress</Text>
                <Text style={s.progressValue}>
                  {progress!.current} / {progress!.total} {progress!.unit}
                </Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
            </View>
            <DashedRule />
          </>
        ) : null}

        {/* ── Footer ── */}
        {showUploadBtn ? (
          <Pressable
            onPress={onUploadProof}
            accessibilityRole="button"
            accessibilityLabel="Upload proof of compliance"
            className="active:opacity-80"
            style={s.uploadBtn}>
            <Text style={s.uploadBtnText}>Upload Proof of Compliance</Text>
          </Pressable>
        ) : showSubmitted ? (
          <View style={s.footerRow}>
            <Ionicons name="checkmark" size={16} color="#717680" />
            <Text style={s.footerText}>Submitted at {submittedAtLabel}</Text>
          </View>
        ) : showCompleted ? (
          <View style={s.footerRow}>
            <IconsaxVerifyIcon size={18} color="#17B26A" />
            <Text style={s.footerText}>Completed at {completedAtLabel}</Text>
          </View>
        ) : null}

      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 2,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  inner: {
    gap: 20,
  },
  // Top section
  topSection: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.4,
    minWidth: 0,
  },
  timeAgo: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '400',
    color: '#414651',
    letterSpacing: -0.24,
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    color: '#717680',
    lineHeight: 20,
  },
  pillsRow: {
    flexDirection: 'row',
    rowGap: 6,
    columnGap: 4,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F5F5F5',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.24,
  },
  pillTextDark: {
    fontSize: 12,
    fontWeight: '500',
    color: '#252B37',
    lineHeight: 16,
    letterSpacing: -0.24,
  },
  // Dashed separator
  dashedRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    height: 2,
    alignItems: 'center',
  },
  dash: {
    width: 4,
    height: 2,
    backgroundColor: '#E9EAEB',
    marginRight: 4,
  },
  // Progress
  progressSection: {
    gap: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#252B37',
    lineHeight: 16,
    letterSpacing: -0.28,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '400',
    color: '#252B37',
    lineHeight: 16,
    letterSpacing: -0.28,
    textAlign: 'right',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: PROGRESS_TRACK,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: PROGRESS_FILL,
  },
  // Upload button
  uploadBtn: {
    borderRadius: 24,
    backgroundColor: UPLOAD_BTN_BG,
    borderWidth: 2,
    borderColor: UPLOAD_BTN_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.28,
  },
  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#414651',
    letterSpacing: -0.24,
  },
});
