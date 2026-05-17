import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, LayoutAnimation, Platform, UIManager } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  fetchCasesByStudent,
  fetchNTEsByStudent,
  fetchSanctionsByStudent,
  mapNTEToCardProps,
} from '@/lib/discipline-office/disciplineApi';

import {
  DisciplineOfficeScreenShell,
  ScreenHeader,
  NTECard,
} from '@/components/discipline-office';
import { IconsaxArrowDownIcon } from '@/components/icons/IconsaxArrowDownIcon';
import { IconsaxBriefcaseIcon } from '@/components/icons/IconsaxBriefcaseIcon';
import { IconsaxPaperIcon } from '@/components/icons/IconsaxPaperIcon';
import { IconsaxCloseCircleIcon } from '@/components/icons/IconsaxCloseCircleIcon';
import { IconsaxEditIcon } from '@/components/icons/IconsaxEditIcon';
import { IconsaxLikeIcon } from '@/components/icons/IconsaxLikeIcon';
import { IconsaxInfoCircleIcon } from '@/components/icons/IconsaxInfoCircleIcon';
import { SCHEDULE_PARTNER } from '@/lib/health-service/bookingScheduleTheme';

const T = SCHEDULE_PARTNER;

// ── Stats Strip ───────────────────────────────────────────────────────────────

function StatsStrip({
  noticeCount,
  openCases,
  sanctions,
}: {
  noticeCount: number;
  openCases: number;
  sanctions: number;
}) {
  const cells = [
    { value: String(noticeCount), label: 'Notice' },
    { value: String(openCases), label: 'Open Cases' },
    { value: String(sanctions), label: 'Sanctions' },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        height: 94,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E9EAEB',
        backgroundColor: '#FAFAFA',
        overflow: 'hidden',
      }}>
      {cells.map((cell, i) => (
        <View
          key={cell.label}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            borderLeftWidth: i > 0 ? 1 : 0,
            borderLeftColor: '#DCDDDE',
          }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '600',
              letterSpacing: -0.64,
              color: '#000000',
            }}>
            {cell.value}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '400',
              color: '#717680',
              letterSpacing: -0.32,
              textAlign: 'center',
            }}>
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Clean Record Banner ───────────────────────────────────────────────────────

function CleanRecordBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: '#2970FF',
        borderWidth: 1,
        borderColor: '#B2CCFF',
        borderRadius: 9999,
        paddingLeft: 24,
        paddingRight: 20,
        paddingVertical: 12,
      }}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <IconsaxLikeIcon size={32} color="#FFFFFF" />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '400',
          color: '#FFFFFF',
          lineHeight: 20,
        }}>
        You're disciplinary records are clean. Keep up the good work!
      </Text>
      <Pressable
        onPress={onDismiss}
        accessibilityLabel="Dismiss clean record banner"
        hitSlop={8}
        className="active:opacity-70">
        <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
          <IconsaxCloseCircleIcon size={28} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

// ── Pending NTE Urgent Banner ─────────────────────────────────────────────────

function PendingNTEBanner({
  count,
}: {
  count: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: '#FFFAEB',
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#FEF0C7',
        paddingLeft: 20,
        paddingRight: 18,
        paddingVertical: 12,
      }}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <IconsaxInfoCircleIcon size={28} color="#F79009" />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '400',
            color: '#B45309',
            lineHeight: 20,
          }}>
          A notice has been <Text style={{ fontWeight: '700' }}>issued</Text> on you and it requires your response immediately.
        </Text>
      </View>
    </View>
  );
}

// ── Quick Action Card ─────────────────────────────────────────────────────────

function QuickActionCard({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        width: 160,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 2,
        gap: 12,
      }}
      className="active:opacity-75">
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: '#F5F5F5',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {icon}
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: '#000000',
          letterSpacing: -0.28,
          lineHeight: 20,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const chevronAngle = useSharedValue(defaultExpanded ? 180 : 0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAngle.value}deg` }],
  }));

  const toggle = () => {
    const next = !expanded;
    chevronAngle.value = withTiming(next ? 180 : 0, { duration: 220 });
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: 'easeInEaseOut' },
    });
    setExpanded(next);
  };

  return (
    <View style={{ gap: 16 }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
        }}
        className="active:opacity-70">
        <Text
          style={{
            flex: 1,
            fontSize: 20,
            fontWeight: '500',
            color: '#000000',
          }}>
          {title}
        </Text>
        <Animated.View style={[{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }, chevronStyle]}>
          <IconsaxArrowDownIcon size={20} color="#717680" />
        </Animated.View>
      </Pressable>
      {expanded && <View>{children}</View>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DisciplineOfficeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const [ntes, setNtes] = useState<ReturnType<typeof mapNTEToCardProps>[]>([]);
  const [openCasesCount, setOpenCasesCount] = useState(0);
  const [sanctionsCount, setSanctionsCount] = useState(0);

  const studentId = (session?.user?.user_metadata?.student_id as string | undefined) ?? '';

  // Initial fetch
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    Promise.all([
      fetchNTEsByStudent(studentId),
      fetchCasesByStudent(studentId),
      fetchSanctionsByStudent(studentId),
    ]).then(([rawNTEs, rawCases, rawSanctions]) => {
      if (cancelled) return;
      setNtes(rawNTEs.filter((n) => n.status !== 'escalated').map(mapNTEToCardProps));
      setOpenCasesCount(rawCases.length);
      setSanctionsCount(rawSanctions.length);
      setHasLoaded(true);
    });
    return () => { cancelled = true; };
  }, [studentId]);

  // Refetch data when screen is focused (e.g., after submitting statement of explanation)
  useFocusEffect(
    useCallback(() => {
      if (!studentId) return;
      let cancelled = false;
      Promise.all([
        fetchNTEsByStudent(studentId),
        fetchCasesByStudent(studentId),
        fetchSanctionsByStudent(studentId),
      ]).then(([rawNTEs, rawCases, rawSanctions]) => {
        if (cancelled) return;
        setNtes(rawNTEs.filter((n) => n.status !== 'escalated').map(mapNTEToCardProps));
        setOpenCasesCount(rawCases.length);
        setSanctionsCount(rawSanctions.length);
      });
      return () => { cancelled = true; };
    }, [studentId]),
  );

  // Check if returning from statement explanation with responded NTE
  useFocusEffect(
    useCallback(() => {
      const respondedNTEId = router.params?.respondedNTEId as string | undefined;
      if (respondedNTEId) {
        // Optimistically update the NTE status before refetching
        setNtes((prev) =>
          prev.map((nte) =>
            nte.id === respondedNTEId
              ? {
                  ...nte,
                  status: 'responded' as const,
                  respondedAtLabel: formatDateLabel(new Date()),
                }
              : nte,
          ),
        );
        // Clear the param to avoid re-triggering
        router.setParams({ respondedNTEId: undefined });
      }
    }, [router]),
  );

  const nteCount = ntes.length;
  const pendingNTECount = ntes.filter((n) => n.status === 'pending_response').length;
  const isClean = openCasesCount === 0 && sanctionsCount === 0;

  return (
    <DisciplineOfficeScreenShell>
      <ScreenHeader
        title="Discipline Office"
        subtitle="Reports are reviewed fairly. You can track your case and sanctions here."
        paddingBottom={8}
      />

      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-transparent"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 28,
          gap: 28,
        }}>

        {/* ── Stats Strip ── */}
        <StatsStrip
          noticeCount={nteCount}
          openCases={openCasesCount}
          sanctions={sanctionsCount}
        />

        {/* ── Clean Record Banner ── */}
        {hasLoaded && isClean && !bannerDismissed && (
          <CleanRecordBanner onDismiss={() => setBannerDismissed(true)} />
        )}

        {/* ── Pending NTE Urgent Banner ── */}
        {pendingNTECount > 0 && (
          <PendingNTEBanner count={pendingNTECount} />
        )}

        {/* ── Quick Actions ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            gap: 12,
            paddingRight: 16,
          }}>
          <QuickActionCard
            icon={<IconsaxEditIcon size={20} color="#0A0D12" />}
            label="Report an Incident"
            accessibilityLabel="Open incident report form"
            onPress={() => router.push('/discipline-office/incident-report')}
          />
          <QuickActionCard
            icon={<IconsaxBriefcaseIcon size={20} color="#0A0D12" />}
            label="View my Cases"
            accessibilityLabel="View my cases"
            onPress={() => router.push('/discipline-office/my-cases')}
          />
          <QuickActionCard
            icon={<IconsaxPaperIcon size={20} color="#0A0D12" />}
            label="View my Sanctions"
            accessibilityLabel="View my sanctions"
            onPress={() => router.push('/discipline-office/my-sanctions')}
          />
        </ScrollView>

        {/* ── Notice to Explain ── */}
        <CollapsibleSection title="Notice to Explain" defaultExpanded>
          {ntes.length > 0 ? (
            <View style={{ gap: 12 }}>
              {ntes.map((item) => (
                <NTECard
                  key={item.id}
                  variant="default"
                  id={item.id}
                  caseType={item.caseType}
                  description={item.description}
                  issuedAtLabel={item.issuedAtLabel}
                  deadlineLabel={item.deadlineLabel}
                  status={item.status}
                  isOverdue={item.isOverdue}
                  respondedAtLabel={item.respondedAtLabel}
                  waivedAtLabel={item.waivedAtLabel}
                  onRespond={() =>
                    router.push({
                      pathname: '/discipline-office/statement-of-explanation',
                      params: {
                        nteId: item.id,
                        caseType: item.caseType,
                        issuedAtLabel: item.issuedAtLabel,
                        deadlineLabel: item.deadlineLabel,
                        onResponded: item.id, // Pass NTE ID to identify which one was responded to
                      },
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '400',
                color: '#535862',
                textAlign: 'center',
                paddingVertical: 32,
              }}>
              Nothing to see here...
            </Text>
          )}
        </CollapsibleSection>

      </ScrollView>
    </DisciplineOfficeScreenShell>
  );
}
