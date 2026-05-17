import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DisciplineCaseProgressCard,
  DisciplineOfficeScreenShell,
  ScreenHeader,
} from '@/components/discipline-office';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fetchCasesByStudent, type DBCase } from '@/lib/discipline-office/disciplineApi';

// Build the tags array the card expects: ['Minor Offense', 'Code of Conduct Violation']
function buildTags(c: DBCase): string[] {
  const sev = c.severity === 'major' ? 'Major Offense' : 'Minor Offense';
  return c.case_type ? [sev, c.case_type] : [sev];
}

export default function MyCasesScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const studentId = (session?.user?.user_metadata?.student_id as string | undefined) ?? '';

  const [cases, setCases] = useState<DBCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    fetchCasesByStudent(studentId).then((rows) => {
      if (cancelled) return;
      setCases(rows);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [studentId]);

  return (
    <DisciplineOfficeScreenShell>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Your Cases"
          subtitle="View reports filed for your disciplinary concerns and track their status."
          paddingBottom={32}
        />

        {/* ── Cases list ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 20 },
          ]}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : cases.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No cases on file</Text>
              <Text style={styles.emptySubtitle}>
                You don't have any disciplinary cases yet. That's a good thing.
              </Text>
            </View>
          ) : (
            cases.map((c, i) => (
              <DisciplineCaseProgressCard
                key={c.id}
                description={c.description}
                tags={buildTags(c)}
                progressPercent={c.progress_percent ?? 0}
                currentStepIndex={c.current_step_index ?? 0}
                steps={Array.isArray(c.case_steps) ? c.case_steps : []}
                defaultExpanded={i === 0}
              />
            ))
          )}
        </ScrollView>
      </View>
    </DisciplineOfficeScreenShell>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
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
