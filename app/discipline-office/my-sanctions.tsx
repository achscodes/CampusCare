import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'heroui-native';

import { sanctionsProgressStore } from '@/features/discipline/sanctionsProgressStore';

import {
  DisciplineOfficeScreenShell,
  ScreenHeader,
  SanctionCard,
  type SanctionStatus,
  type SanctionType,
} from '@/components/discipline-office';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  fetchSanctionsByStudent,
  mapSanctionToScreenRow,
  subscribeMySanctions,
} from '@/lib/discipline-office/disciplineApi';

type SanctionRow = ReturnType<typeof mapSanctionToScreenRow>;

type FilterKey = SanctionStatus | 'all';

type FilterDef = {
  key: FilterKey;
  label: string;
  dotColor: string;
  activeColor: string;
};

const FILTERS: FilterDef[] = [
  { key: 'all',         label: 'All',         dotColor: '#181D27', activeColor: '#181D27' },
  { key: 'in_progress', label: 'In Progress', dotColor: '#2970FF', activeColor: '#2970FF' },
  { key: 'pending',     label: 'Pending',     dotColor: '#F79009', activeColor: '#F79009' },
  { key: 'in_review',   label: 'In Review',   dotColor: '#17B26A', activeColor: '#17B26A' },
  { key: 'case_closed', label: 'Case Closed', dotColor: '#A4A7AE', activeColor: '#717680' },
];

export default function MySanctionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { session } = useAuth();
  const studentId = (session?.user?.user_metadata?.student_id as string | undefined) ?? '';

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [serverRows, setServerRows] = useState<SanctionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Optimistic "hours pending admin approval" — keyed by sanction id.
  // Bumps the visible progress on community_service rows until the server
  // catches up (admin approves → Realtime UPDATE → refetch overwrites it).
  const [pendingHours, setPendingHours] = useState<Record<string, number>>({});

  // ── Refetch helper ────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!studentId) { setIsLoading(false); return; }
    const rows = await fetchSanctionsByStudent(studentId);
    setServerRows(rows.map(mapSanctionToScreenRow));
    setIsLoading(false);
  }, [studentId]);

  // Initial load
  useEffect(() => { void refetch(); }, [refetch]);

  // Realtime: when admin approves a proof, the sanction row updates.
  // Refetch AND clear that sanction's optimistic bump (server is now authoritative).
  useEffect(() => {
    if (!studentId) return;
    const unsubscribe = subscribeMySanctions(studentId, (row) => {
      setPendingHours((prev) => {
        if (!(row.id in prev)) return prev;
        const { [row.id]: _omit, ...rest } = prev;
        return rest;
      });
      void refetch();
    });
    return unsubscribe;
  }, [studentId, refetch]);

  // On focus: drain the submit-queue and apply an optimistic bump + toast.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      const updates = sanctionsProgressStore.drain();
      if (updates.length === 0) return;

      setPendingHours((prev) => {
        const next = { ...prev };
        for (const u of updates) {
          next[u.sanctionId] = (next[u.sanctionId] ?? 0) + u.additionalHours;
        }
        return next;
      });

      const totalAdded = updates.reduce((sum, u) => sum + u.additionalHours, 0);
      toast.show({
        variant: 'success',
        placement: 'top',
        duration: 4200,
        label: 'Submitted for review',
        description: `${totalAdded.toFixed(2)} hrs logged. You'll be credited once admin approves.`,
        icon: (
          <View style={{ paddingTop: 2 }}>
            <Ionicons name="checkmark-circle" size={26} color="#079455" />
          </View>
        ),
      });
    }, [toast, refetch]),
  );

  // Merge optimistic pending hours into the server rows for display
  const sanctions: SanctionRow[] = serverRows.map((row) => {
    const pending = pendingHours[row.id];
    if (!pending || !row.progress || row.sanctionType !== 'community_service') return row;
    const nextCurrent = Math.min(row.progress.total, row.progress.current + pending);
    return { ...row, progress: { ...row.progress, current: nextCurrent } };
  });

  const handleUploadProof = (sanction: SanctionRow) => {
    router.push({
      pathname: '/discipline-office/upload-proof',
      params: {
        sanctionId: sanction.id,
        sanctionTitle: sanction.title,
        sanctionDescription: sanction.description,
        sanctionType: sanction.sanctionType ?? '',
        dueDateLabel: sanction.dueDateLabel,
        totalHours: sanction.progress?.total.toString() ?? '0',
        currentHours: sanction.progress?.current.toString() ?? '0',
      },
    });
  };

  const filtered =
    activeFilter === 'all'
      ? sanctions
      : sanctions.filter((s) => s.status === activeFilter);

  // Counts now derive from live `sanctions` state, not a static mock
  const counts: Record<FilterKey, number> = {
    all:         sanctions.length,
    in_progress: sanctions.filter((s) => s.status === 'in_progress').length,
    pending:     sanctions.filter((s) => s.status === 'pending').length,
    in_review:   sanctions.filter((s) => s.status === 'in_review').length,
    case_closed: sanctions.filter((s) => s.status === 'case_closed').length,
  };

  return (
    <DisciplineOfficeScreenShell>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Your Sanctions"
          subtitle="Track your assigned sanctions and upload proof of compliance for review."
          paddingBottom={16}
          align="flex-start"
        />

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
          bounces={false}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            const count = counts[f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                className="active:opacity-80"
                style={[
                  styles.filterChip,
                  isActive
                    ? { backgroundColor: f.activeColor, borderColor: f.activeColor }
                    : styles.filterChipInactive,
                ]}>
                {!isActive && (
                  <View style={[styles.filterDot, { backgroundColor: f.dotColor }]} />
                )}
                <Text
                  style={[
                    styles.filterLabel,
                    isActive ? styles.filterLabelActive : styles.filterLabelInactive,
                  ]}>
                  {f.label}
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    isActive ? styles.filterBadgeActive : styles.filterBadgeInactive,
                  ]}>
                  <Text
                    style={[
                      styles.filterBadgeText,
                      isActive ? styles.filterBadgeTextActive : styles.filterBadgeTextInactive,
                    ]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Sanctions list ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.listScroll}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 24 },
          ]}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No sanctions found</Text>
              <Text style={styles.emptySubtitle}>
                There are no sanctions matching this filter.
              </Text>
            </View>
          ) : (
            filtered.map((sanction) => (
              <SanctionCard
                key={sanction.id}
                status={sanction.status}
                title={sanction.title}
                description={sanction.description}
                sanctionType={sanction.sanctionType}
                dueDateLabel={sanction.dueDateLabel}
                progress={sanction.progress}
                timeAgoLabel={sanction.timeAgoLabel}
                submittedAtLabel={sanction.submittedAtLabel}
                completedAtLabel={sanction.completedAtLabel}
                onUploadProof={
                  sanction.status === 'in_progress' || sanction.status === 'pending'
                    ? () => handleUploadProof(sanction)
                    : undefined
                }
              />
            ))
          )}
        </ScrollView>
      </View>
    </DisciplineOfficeScreenShell>
  );
}

const styles = StyleSheet.create({
  // Filter row
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 12,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipInactive: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E9EAEB',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.26,
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  filterLabelInactive: {
    color: '#414651',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeInactive: {
    backgroundColor: '#E9EAEB',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.22,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  filterBadgeTextInactive: {
    color: '#535862',
  },
  // List
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 12,
  },
  // Empty state
  emptyState: {
    paddingTop: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#181D27',
    letterSpacing: -0.32,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#717680',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
