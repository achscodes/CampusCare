import { Text, View } from 'react-native';

export type ScholarshipRequirementsListProps = {
  items: string[];
};

/** Figma 713:10348 — numbered blue badges + labels. */
export function ScholarshipRequirementsList({ items }: ScholarshipRequirementsListProps) {
  return (
    <View className="w-full gap-4 px-1 py-0.5">
      {items.map((label, index) => (
        <View key={`${index}-${label}`} className="w-full flex-row items-center gap-3 rounded-xl px-1.5">
          <View className="size-8 items-center justify-center rounded-full bg-[#006FFD]">
            <Text className="text-xs font-semibold text-white">{index + 1}</Text>
          </View>
          <Text className="min-w-0 flex-1 text-sm font-normal leading-5 tracking-[0.12px] text-[#1F2024]">
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
