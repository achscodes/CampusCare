import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from 'heroui-native';

import { ScreenNavbar } from '@/components/ScreenNavbar';
import { ScholarshipDetailHeroCard } from '@/components/student-development-affairs/ScholarshipDetailHeroCard';
import { ScholarshipDetailSegmentedTabs } from '@/components/student-development-affairs/ScholarshipDetailSegmentedTabs';
import type { ScholarshipDetailTab } from '@/components/student-development-affairs/ScholarshipDetailSegmentedTabs';
import { ScholarshipEligibilityChecklist } from '@/components/student-development-affairs/ScholarshipEligibilityChecklist';
import { ScholarshipFeeSummaryCard } from '@/components/student-development-affairs/ScholarshipFeeSummaryCard';
import { ScholarshipRequirementsList } from '@/components/student-development-affairs/ScholarshipRequirementsList';
import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';

function buildEligibilityStrings(program: {
  minGpa: number | null;
  maxGpa: number | null;
  yearLevels: string[] | null;
  programs: string[] | null;
  tuitionDiscountPercent: number;
  miscDiscountPercent: number;
}): string[] {
  const items: string[] = [];
  if (program.minGpa != null) {
    items.push(`Maintain a minimum GPA of ${program.minGpa.toFixed(2)}`);
  }
  if (program.maxGpa != null) {
    items.push(`GPA must not exceed ${program.maxGpa.toFixed(2)}`);
  }
  if (program.yearLevels && program.yearLevels.length > 0) {
    items.push(`Open to ${program.yearLevels.join(', ')} year level students`);
  }
  if (program.programs && program.programs.length > 0) {
    items.push(`Available for: ${program.programs.join(', ')}`);
  }
  if (program.tuitionDiscountPercent > 0) {
    items.push(`Receive ${program.tuitionDiscountPercent}% discount on tuition fees`);
  }
  if (program.miscDiscountPercent > 0) {
    items.push(`Receive ${program.miscDiscountPercent}% discount on miscellaneous fees`);
  }
  items.push('Must be continuously enrolled');
  items.push('Must maintain good conduct record');
  items.push('No failing, incomplete, or withdrawn subjects');
  return items;
}

export default function AboutScholarshipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const {
    currentProgram,
    isLoadingProgram,
    myApplications,
    isSubmitting,
    error,
    fetchProgramById,
    fetchMyApplications,
    createApplication,
    clearCurrentProgram,
  } = useScholarshipStore();

  const [tab, setTab] = useState<ScholarshipDetailTab>('requirements');
  const [eligibilityChecked, setEligibilityChecked] = useState<boolean[]>([]);

  useEffect(() => {
    if (id) {
      fetchProgramById(id);
      fetchMyApplications();
    }
    return () => {
      clearCurrentProgram();
    };
  }, [id, fetchProgramById, fetchMyApplications, clearCurrentProgram]);

  // Sync eligibility checkbox count when program loads
  useEffect(() => {
    if (currentProgram) {
      const items = buildEligibilityStrings(currentProgram);
      setEligibilityChecked(items.map(() => false));
    }
  }, [currentProgram]);

  const existingApplication = useMemo(
    () => myApplications.find((a) => a.programId === id),
    [myApplications, id],
  );

  const requirementItems = useMemo(
    () => currentProgram?.requirements.map((r) => r.name) ?? [],
    [currentProgram],
  );

  const eligibilityItems = useMemo(
    () => (currentProgram ? buildEligibilityStrings(currentProgram) : []),
    [currentProgram],
  );

  const toggleEligibility = useCallback((index: number) => {
    setEligibilityChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const onWantToApply = useCallback(async () => {
    if (!id) return;

    // Continue existing draft
    if (existingApplication?.status === 'draft') {
      router.push({
        pathname: '/student-development-affairs/apply',
        params: { applicationId: existingApplication.id },
      });
      return;
    }

    // Already submitted / reviewed — show status info
    if (existingApplication) {
      Alert.alert(
        'Application Status',
        `Your application (ref: ${existingApplication.referenceNumber ?? 'pending'}) is currently: ${existingApplication.status.replace(/_/g, ' ')}.`,
      );
      return;
    }

    // Create new draft and navigate
    const applicationId = await createApplication(id, {});
    if (applicationId) {
      router.push({
        pathname: '/student-development-affairs/apply',
        params: { applicationId },
      });
    }
  }, [id, existingApplication, createApplication, router]);

  const buttonLabel = useMemo(() => {
    if (isSubmitting) return 'Creating application…';
    if (!existingApplication) return 'I want to apply';
    const s = existingApplication.status;
    if (s === 'draft') return 'Continue application';
    if (s === 'submitted') return 'Application submitted';
    if (s === 'under_review') return 'Under review';
    if (s === 'approved') return 'Application approved';
    if (s === 'rejected') return 'Application not approved';
    return 'View application';
  }, [existingApplication, isSubmitting]);

  const buttonDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (!existingApplication) return false;
    return existingApplication.status !== 'draft';
  }, [existingApplication, isSubmitting]);

  if (isLoadingProgram) {
    return (
      <View className="flex-1 bg-white">
        <ScreenNavbar title="About Scholarship" menuIconSize={32} onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2970FF" />
          <Text className="mt-3 text-sm leading-5 text-[#717680]">Loading details…</Text>
        </View>
      </View>
    );
  }

  if (!currentProgram || error) {
    return (
      <View className="flex-1 bg-white">
        <ScreenNavbar title="About Scholarship" menuIconSize={32} onBackPress={() => router.back()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm leading-5 text-[#D92D20]">
            {error ?? 'Could not load scholarship details.'}
          </Text>
        </View>
      </View>
    );
  }

  const tuitionLabel =
    currentProgram.tuitionDiscountPercent === 100 ? '100%' : `${currentProgram.tuitionDiscountPercent}%`;
  const miscLabel =
    currentProgram.miscDiscountPercent === 100 ? '100%' : `${currentProgram.miscDiscountPercent}%`;

  return (
    <View className="flex-1 bg-white">
      <ScreenNavbar
        title="About Scholarship"
        menuIconSize={32}
        onBackPress={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <View className="gap-4">
          <ScholarshipDetailHeroCard
            sponsorLabel={currentProgram.sponsorName}
            title={currentProgram.name}
            aboutBody={currentProgram.fullDescription ?? currentProgram.shortDescription}
          />
          <ScholarshipFeeSummaryCard
            tuitionPercent={tuitionLabel}
            miscPercent={miscLabel}
          />
          <View className="gap-4">
            <ScholarshipDetailSegmentedTabs active={tab} onChange={setTab} />
            {tab === 'requirements' ? (
              requirementItems.length > 0 ? (
                <ScholarshipRequirementsList items={requirementItems} />
              ) : (
                <View className="items-center py-6">
                  <Text className="text-sm leading-5 text-[#717680]">No requirements listed yet.</Text>
                </View>
              )
            ) : (
              eligibilityItems.length > 0 ? (
                <ScholarshipEligibilityChecklist
                  items={eligibilityItems}
                  checked={eligibilityChecked}
                  onToggle={toggleEligibility}
                />
              ) : (
                <View className="items-center py-6">
                  <Text className="text-sm leading-5 text-[#717680]">No eligibility criteria listed yet.</Text>
                </View>
              )
            )}
          </View>
        </View>
      </ScrollView>
      <View
        className="px-5 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
        <Button
          variant="primary"
          isDisabled={buttonDisabled}
          className={`h-12 w-full rounded-full border border-[#001229]/10 ${buttonDisabled ? 'bg-[#D0D5DD]' : 'bg-[#2970FF]'}`}
          onPress={onWantToApply}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Button.Label className="text-sm font-semibold text-white">{buttonLabel}</Button.Label>
          )}
        </Button>
      </View>
    </View>
  );
}
