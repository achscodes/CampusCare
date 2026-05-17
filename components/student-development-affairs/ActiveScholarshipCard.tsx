import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconsaxMedalStarFilledIcon } from '@/components/icons/IconsaxMedalStarFilledIcon';
import type { ScholarEnrollment, ScholarshipProgram, ComplianceItem } from '@/lib/scholarships/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrollmentWithDetails = ScholarEnrollment & {
  program: ScholarshipProgram;
  complianceItems: ComplianceItem[];
};

type Props = {
  enrollment: EnrollmentWithDetails;
};

// ─── Status label + color ────────────────────────────────────────────────────

type StatusConfig = { label: string; bg: string; text: string };

const STATUS_CONFIG: Record<string, StatusConfig> = {
  active:    { label: 'Active',    bg: '#DCFCE7', text: '#16A34A' },
  probation: { label: 'Probation', bg: '#FEF3F2', text: '#D92D20' },
  at_risk:   { label: 'At Risk',   bg: '#FEF9C3', text: '#CA8A04' },
  suspended: { label: 'Suspended', bg: '#E9EAEB', text: '#A4A7AE' },
};

function statusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? { label: status, bg: '#E9EAEB', text: '#717680' };
}

function formatExpiry(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActiveScholarshipCard({ enrollment }: Props) {
  const router = useRouter();

  const cfg = statusConfig(enrollment.status);

  const allItems = enrollment.complianceItems ?? [];
  const pendingCount = allItems.filter(
    (i) => i.status === 'pending' || i.status === 'rejected' || i.status === 'overdue',
  ).length;

  const verifiedCount = allItems.filter(
    (i) => i.status === 'verified' || i.status === 'waived',
  ).length;

  const progressPercent =
    allItems.length > 0 ? Math.round((verifiedCount / allItems.length) * 100) : 0;

  const expiry = formatExpiry(enrollment.expectedEndAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/my-scholarship')}
      style={({ pressed }) => [S.outerWrapper, pressed && { opacity: 0.92 }]}>
      <View style={S.card}>

        {/* ── Top row: icon + name/expiry + status badge ── */}
        <View style={S.topRow}>
          <View style={S.iconNameRow}>
            <IconsaxMedalStarFilledIcon size={32} color="#F6B800" />
            <View style={S.nameBlock}>
              <Text style={S.name} numberOfLines={1}>
                {enrollment.program?.name ?? 'My Scholarship'}
              </Text>
              {expiry ? (
                <Text style={S.expiry}>Expires on {expiry}</Text>
              ) : null}
            </View>
          </View>
          <View style={[S.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[S.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={S.divider} />

        {/* ── Stats row ── */}
        <View style={S.statsRow}>
          <View style={S.statItem}>
            <Text style={S.statValue}>{pendingCount}</Text>
            <Text style={S.statLabel}>Pending Requirements</Text>
          </View>
        </View>

      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  outerWrapper: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#181D27',
    letterSpacing: -0.64,
  },
  expiry: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#A4A7AE',
    letterSpacing: -0.48,
  },
  badge: {
    flexShrink: 0,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    letterSpacing: -0.24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E9EAEB',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#181D27',
    letterSpacing: -2.8,
  },
  statLabel: {
    fontSize: 12,
    color: '#717680',
    letterSpacing: -0.24,
  },
});
