import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { BottomSheet } from 'heroui-native';

import {
  ActiveScholarshipCard,
  ScholarshipCard,
  ScholarshipDetailModal,
  ScholarshipSearchBar,
  type ScholarshipCardStatus,
} from '@/components/student-development-affairs';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useScholarshipStore } from '@/lib/scholarships/scholarshipStore';
import type { ScholarshipProgram } from '@/lib/scholarships/types';

type SortKey = 'name_asc' | 'name_desc' | 'closes_asc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name_asc', label: 'Scholarship name (A–Z)' },
  { key: 'name_desc', label: 'Scholarship name (Z–A)' },
  { key: 'closes_asc', label: 'Closing date (soonest first)' },
];

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function formatCloseDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `Closes ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getCardStatus(program: ScholarshipProgram): ScholarshipCardStatus {
  const slotsLeft = program.totalSlots - program.filledSlots;
  const daysLeft = Math.ceil(
    (new Date(program.applicationCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (slotsLeft <= 5) return 'high_demand';
  if (slotsLeft <= 10) return 'limited_slots';
  if (daysLeft <= 7) return 'closing_soon';
  return 'open';
}

/** Search band + white sheet on the same gradient shell as the home tab. */
export default function StudentDevelopmentAffairsScreen() {
  const { programs, myEnrollment, isLoadingPrograms, error, fetchPrograms } = useScholarshipStore();

  const [selectedProgram, setSelectedProgram] = useState<ScholarshipProgram | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [academicYearFilter, setAcademicYearFilter] = useState<string | null>(null);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  // Programs are pre-fetched at login by AuthProvider.
  // Only re-fetch if the store is empty (e.g. first cold load before AuthProvider fires).
  useEffect(() => {
    if (programs.length === 0 && !isLoadingPrograms) {
      fetchPrograms();
    }
  }, []);

  const academicYears = useMemo(
    () => [...new Set(programs.map((p) => p.academicYear).filter((year): year is string => year !== null))]
        .sort((a, b) => b.localeCompare(a)),
    [programs],
  );

  const displayed = useMemo(() => {
    let list = [...programs];
    const q = normalize(query);
    if (q.length > 0) {
      list = list.filter((p) => normalize(p.name).includes(q));
    }
    if (academicYearFilter != null) {
      list = list.filter((p) => p.academicYear === academicYearFilter);
    }
    return list.sort((a, b) => {
      if (sortKey === 'name_asc') return a.name.localeCompare(b.name);
      if (sortKey === 'name_desc') return b.name.localeCompare(a.name);
      return new Date(a.applicationCloseDate).getTime() - new Date(b.applicationCloseDate).getTime();
    });
  }, [query, sortKey, academicYearFilter, programs]);

  const selectSort = useCallback((key: SortKey) => {
    setSortKey(key);
    setSortSheetOpen(false);
  }, []);

  const selectYear = useCallback((value: string | null) => {
    setAcademicYearFilter(value);
    setSortSheetOpen(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
      <ScreenHeader
        title="Scholarship List"
        subtitle="Apply for scholarships and track your enrollment status."
        paddingBottom={8}
      />
      <View className="mt-2 min-h-0 flex-1 bg-transparent px-0">
        <View className="gap-3 px-4 pt-1">
          <ScholarshipSearchBar
            value={query}
            onChangeText={setQuery}
            onSortPress={() => setSortSheetOpen(true)}
            
          />
          {/*{openBanner ? (
            <View className="mb-2">
              <ScholarshipAnnouncementBanner message={openBanner} />
            </View>
          ) : null} */}
        </View>
        <View className="min-h-0 flex-1 rounded-t-[30px] pb-12 pt-2">
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="w-full gap-3 px-4 pb-4">
              {myEnrollment ? (
                <ActiveScholarshipCard enrollment={myEnrollment as any} />
              ) : null}
              {isLoadingPrograms ? (
                <View className="items-center justify-center py-16">
                  <ActivityIndicator size="large" color="#2970FF" />
                  <Text className="mt-3 text-sm leading-5 text-[#717680]">Loading scholarships…</Text>
                </View>
              ) : error ? (
                <View className="items-center justify-center py-10 px-4">
                  <Text className="text-center text-sm leading-5 text-[#D92D20]">{error}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={fetchPrograms}
                    className="mt-4 rounded-full bg-[#2970FF] px-5 py-2.5">
                    <Text className="text-sm font-semibold text-white">Try Again</Text>
                  </Pressable>
                </View>
              ) : displayed.length === 0 ? (
                <View className="items-center justify-center py-10 px-4">
                  <Text className="text-center text-sm leading-5 text-[#535862]">
                    {query.length > 0
                      ? 'No scholarships match that name. Try another search or change filters.'
                      : 'No scholarships are currently open.'}
                  </Text>
                </View>
              ) : (
                displayed.map((program) => (
                  <ScholarshipCard
                    key={program.id}
                    title={program.name}
                    academicYear={program.academicYear || '2024-2025'}
                    term={program.term || '1st Term'}
                    slotsLeft={program.totalSlots - program.filledSlots}
                    tuitionPercent={program.tuitionDiscountPercent}
                    miscPercent={program.miscDiscountPercent}
                    minGpa={program.minGpa}
                    closeDate={formatCloseDate(program.applicationCloseDate)}
                    applicationCount={program.filledSlots}
                    status={getCardStatus(program)}
                    onPress={() => {
                      setSelectedProgram(program);
                      setModalOpen(true);
                    }}
                  />
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      <ScholarshipDetailModal
        program={selectedProgram}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <BottomSheet isOpen={sortSheetOpen} onOpenChange={setSortSheetOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay isCloseOnPress />
          <BottomSheet.Content snapPoints={['52%', '72%']} index={0}>
            <BottomSheet.Title className="mb-3 px-1 text-base font-semibold leading-6 text-[#181D27]">
              Sort & filter
            </BottomSheet.Title>
            <ScrollView
              className="max-h-[420px]"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[#8F9098]">
                Sort by
              </Text>
              {SORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  accessibilityRole="button"
                  className="rounded-xl px-3 py-3.5 active:bg-[#FAFAFA]"
                  onPress={() => selectSort(opt.key)}>
                  <Text
                    className={`text-sm leading-5 ${sortKey === opt.key ? 'font-semibold text-[#2970FF]' : 'text-[#181D27]'}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
              {academicYears.length > 0 ? (
                <>
                  <Text className="mb-2 mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-[#8F9098]">
                    Academic Year
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    className="rounded-xl px-3 py-3.5 active:bg-[#FAFAFA]"
                    onPress={() => selectYear(null)}>
                    <Text
                      className={`text-sm leading-5 ${academicYearFilter === null ? 'font-semibold text-[#2970FF]' : 'text-[#181D27]'}`}>
                      All years
                    </Text>
                  </Pressable>
                  {academicYears.map((year) => (
                    <Pressable
                      key={year}
                      accessibilityRole="button"
                      className="rounded-xl px-3 py-3.5 active:bg-[#FAFAFA]"
                      onPress={() => selectYear(year)}>
                      <Text
                        className={`text-sm leading-5 ${academicYearFilter === year ? 'font-semibold text-[#2970FF]' : 'text-[#181D27]'}`}>
                        AY {year}
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
