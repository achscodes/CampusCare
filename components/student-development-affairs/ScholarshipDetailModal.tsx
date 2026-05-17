import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { BottomSheet } from 'heroui-native';

import { IconsaxMedalStarFilledIcon } from '@/components/icons/IconsaxMedalStarFilledIcon';
import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';
import type { ScholarshipProgram } from '@/lib/scholarships/types';

type ProgramWithRequirements = ScholarshipProgram & {
  requirements?: { name: string; description?: string | null }[];
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'description' | 'retention';

type Props = {
  program: ProgramWithRequirements | null;
  isOpen: boolean;
  onClose: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCloseDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseRetentionPolicy(fullDescription: string | null | undefined): string[] {
  if (!fullDescription) return [];
  const lines = fullDescription
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  return lines;
}

function parseRequirements(
  requirements: { name: string; description?: string | null }[],
): string[] {
  return requirements.map((r) => (r.description ? `${r.name} — ${r.description}` : r.name));
}

// ─── Static styles ────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  scrollContent: {
    gap: 20,
  },
  pill: {
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#717680',
    letterSpacing: -0.24,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    padding: 4,
    borderCurve: 'continuous',
  } as any,
  tabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    borderCurve: 'continuous',
  } as any,
  tabActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#181D27',
    textAlign: 'center',
  },
  tabInactiveText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71727A',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#181D27',
    letterSpacing: -0.8,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#717680',
    letterSpacing: -0.32,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    marginTop: 4,
    color: '#717680',
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#717680',
    letterSpacing: -0.32,
  },
  applyBtn: {
    borderRadius: 24,
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2970FF',
    borderWidth: 2,
    borderColor: '#528BFF',
    borderCurve: 'continuous',
    boxShadow: '0 5px 30px rgba(0, 34, 102, 0.2)',
  } as any,
  applyBtnDisabled: {
    opacity: 0.7,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.32,
  },
  contentWrapper: {
    flex: 1,
  },
  stickyBar: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  headerBtn: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    letterSpacing: -0.32,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medalOuter: {
    height: 56,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#FAFAFA',
    padding: 8,
  },
  medalInner: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  programName: {
    fontSize: 20,
    fontWeight: '500',
    color: '#181D27',
    letterSpacing: -0.4,
  },
  sponsorName: {
    marginTop: 4,
    fontSize: 13,
    color: '#717680',
    letterSpacing: -0.26,
  },
});

const pillsRowStyle = { gap: 4 } as const;
const scrollViewStyle = { flex: 1 } as const;

// ─── Memoized sub-components ──────────────────────────────────────────────────

const InfoPill = memo(function InfoPill({ label }: { label: string }) {
  return (
    <View style={S.pill}>
      <Text style={S.pillText}>{label}</Text>
    </View>
  );
});

const BulletItem = memo(function BulletItem({ text }: { text: string }) {
  return (
    <View style={S.bulletRow}>
      <Text style={S.bullet}>{'•'}</Text>
      <Text style={S.bulletText}>{text}</Text>
    </View>
  );
});

// ─── Animated Tab Indicator ──────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const animBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['transparent', '#FFFFFF']),
  }));

  return (
    <AnimatedPressable onPress={onPress} style={[S.tabPill, animBg]}>
      <Text style={active ? S.tabActiveText : S.tabInactiveText}>{label}</Text>
    </AnimatedPressable>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScholarshipDetailModal({ program, isOpen, onClose }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('description');
  const [isCreating, setIsCreating] = useState(false);
  const createLockRef = useRef(false);

  const { createApplication, myApplications } = useScholarshipStore();

  // Reset tab when a new program opens
  useEffect(() => {
    if (isOpen) setActiveTab('description');
  }, [isOpen, program?.id]);

  const existingApplication = useMemo(
    () => myApplications.find(
      (a) => a.programId === program?.id && (a.status === 'draft' || a.status === 'submitted'),
    ),
    [myApplications, program?.id],
  );

  const handleApply = useCallback(async () => {
    if (!program || createLockRef.current) return;

    // If existing draft, go directly to it
    if (existingApplication) {
      onClose();
      router.push({
        pathname: '/student-development-affairs/apply',
        params: { applicationId: existingApplication.id },
      });
      return;
    }

    createLockRef.current = true;
    setIsCreating(true);

    try {
      const applicationId = await createApplication(program.id, {});
      if (applicationId) {
        onClose();
        router.push({
          pathname: '/student-development-affairs/apply',
          params: { applicationId },
        });
      } else {
        Alert.alert('Error', 'Could not start your application. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', msg);
    } finally {
      setIsCreating(false);
      createLockRef.current = false;
    }
  }, [program, existingApplication, createApplication, onClose, router]);

  // Requirements come embedded in program from the joined getPrograms query (no extra fetch)
  const requirements = useMemo(
    () => program?.requirements ?? [],
    [program?.requirements],
  );

  const retentionBullets = useMemo(
    () => parseRetentionPolicy(program?.fullDescription),
    [program?.fullDescription],
  );

  const requirementBullets = useMemo(
    () => parseRequirements(requirements),
    [requirements],
  );

  const pills = useMemo<string[]>(() => {
    if (!program) return [];
    const result: string[] = [];
    if (program.tuitionDiscountPercent > 0) result.push(`${program.tuitionDiscountPercent}% Tuition`);
    if (program.miscDiscountPercent > 0) result.push(`${program.miscDiscountPercent}% Misc`);
    if (program.applicationCloseDate) result.push(`Closes ${formatCloseDate(program.applicationCloseDate)}`);
    const slotsLeft = program.totalSlots - program.filledSlots;
    if (slotsLeft > 0) result.push(`${slotsLeft} slots`);
    return result;
  }, [program?.id, program?.tuitionDiscountPercent, program?.miscDiscountPercent, program?.applicationCloseDate, program?.totalSlots, program?.filledSlots]);

  const applyLabel = existingApplication
    ? existingApplication.status === 'submitted'
      ? 'View Application'
      : 'Continue Application'
    : 'Apply for this Scholarship';

  const scrollContentStyle = useMemo(
    () => [S.scrollContent, { paddingBottom: 24 }],
    [],
  );

  const onDescriptionTab = useCallback(() => setActiveTab('description'), []);
  const onRetentionTab = useCallback(() => setActiveTab('retention'), []);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay isCloseOnPress />
        <BottomSheet.Content
          snapPoints={['92%']}
          index={0}
          className="rounded-t-[32px] bg-white">

          {/* ── Header bar ── */}
          <View style={S.headerRow}>
            <Pressable onPress={onClose} style={S.headerBtn}>
              <Ionicons name="chevron-back" size={20} color="#181D27" />
            </Pressable>
            <Text style={S.headerTitle}>Scholarship Detail</Text>
            <View style={S.headerBtn}>
              <Ionicons name="share-outline" size={20} color="#181D27" />
            </View>
          </View>

          {program ? (
            <View style={S.contentWrapper}>
              <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                style={scrollViewStyle}
                contentContainerStyle={scrollContentStyle}
                keyboardShouldPersistTaps="handled"
                overScrollMode="never"
                bounces
                scrollIndicatorInsets={{ bottom: 0 }}>

                {/* ── Identity row ── */}
                <View style={S.identityRow}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={S.medalOuter}>
                      <View style={S.medalInner}>
                        <IconsaxMedalStarFilledIcon size={32} color="#5B8AF5" />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.programName} numberOfLines={2}>
                        {program.name}
                      </Text>
                      <Text style={S.sponsorName}>{program.sponsorName}</Text>
                    </View>
                  </View>
                  <Ionicons name="bookmark-outline" size={24} color="#181D27" />
                </View>

                {/* ── Pills row ── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={pillsRowStyle}>
                  {pills.map((pill) => (
                    <InfoPill key={pill} label={pill} />
                  ))}
                </ScrollView>

                {/* ── Tab switcher ── */}
                <View style={S.tabBar}>
                  <TabButton
                    label="Description"
                    active={activeTab === 'description'}
                    onPress={onDescriptionTab}
                  />
                  <TabButton
                    label="Retention Policy"
                    active={activeTab === 'retention'}
                    onPress={onRetentionTab}
                  />
                </View>

                {/* ── Description tab ── */}
                {activeTab === 'description' ? (
                  <View style={{ gap: 20 }}>
                    <View style={{ gap: 8 }}>
                      <Text style={S.sectionTitle}>About this Scholarship</Text>
                      <Text style={S.bodyText}>{program.shortDescription}</Text>
                    </View>

                    {requirementBullets.length > 0 ? (
                      <View style={{ gap: 12 }}>
                        <Text style={S.sectionTitle}>Requirements</Text>
                        <View style={{ gap: 16 }}>
                          {requirementBullets.map((item, i) => (
                            <BulletItem key={i} text={item} />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={S.sectionTitle}>Retention Policy</Text>
                    {retentionBullets.length > 0 ? (
                      <View style={{ gap: 16 }}>
                        {retentionBullets.map((item, i) => (
                          <BulletItem key={i} text={item} />
                        ))}
                      </View>
                    ) : (
                      <Text style={S.bodyText}>No retention policy details available.</Text>
                    )}
                  </View>
                )}
              </Animated.ScrollView>

              {/* ── Sticky apply button inside modal ── */}
              <View style={S.stickyBar}>
                <Pressable
                  onPress={handleApply}
                  disabled={isCreating}
                  style={isCreating ? [S.applyBtn, S.applyBtnDisabled] : S.applyBtn}>
                  {isCreating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={S.applyBtnText}>{applyLabel}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <ActivityIndicator size="large" color="#2970FF" />
            </View>
          )}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
