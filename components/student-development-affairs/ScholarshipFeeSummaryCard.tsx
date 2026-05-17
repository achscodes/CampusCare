import { Text, View } from 'react-native';

export type ScholarshipFeeSummaryCardProps = {
  tuitionPercent: string;
  miscPercent: string;
  tuitionLabel?: string;
  miscLabel?: string;
};

/** Figma 713:10338 — dual stat card with vertical rule. */
export function ScholarshipFeeSummaryCard({
  tuitionPercent,
  miscPercent,
  tuitionLabel = 'Tuition Fee Discount',
  miscLabel = 'Miscellaneous Fees',
}: ScholarshipFeeSummaryCardProps) {
  return (
    <View className="w-full flex-row items-center justify-between rounded-3xl border border-black/10 bg-white px-6 py-4">
      <View className="min-w-0 flex-1 items-center gap-2">
        <Text className="text-center text-2xl font-semibold text-[#00359E]">{tuitionPercent}</Text>
        <Text className="text-center text-sm font-normal capitalize leading-5 text-[#181D27]">
          {tuitionLabel}
        </Text>
      </View>
      <View className="mx-2 h-14 w-px bg-[#D4D6DD]" />
      <View className="min-w-0 flex-1 items-center gap-2">
        <Text className="text-center text-2xl font-semibold text-[#00359E]">{miscPercent}</Text>
        <Text className="text-center text-sm font-normal capitalize leading-5 text-[#181D27]">
          {miscLabel}
        </Text>
      </View>
    </View>
  );
}
