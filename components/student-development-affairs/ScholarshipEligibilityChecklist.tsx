import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export type ScholarshipEligibilityChecklistProps = {
  items: string[];
  checked: boolean[];
  onToggle: (index: number) => void;
};

/**
 * Interactive eligibility checklist (Figma 713:10390 structure; checkboxes per product request).
 */
export function ScholarshipEligibilityChecklist({
  items,
  checked,
  onToggle,
}: ScholarshipEligibilityChecklistProps) {
  return (
    <View className="w-full rounded-[20px] bg-[#F8F9FE] px-5 py-6">
      <View>
        {items.map((label, index) => (
          <Pressable
            key={`${index}-${label}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: checked[index] }}
            onPress={() => onToggle(index)}
            className="flex-row items-start gap-3.5 rounded-xl py-3 pr-1 active:opacity-80">
            <View
              className={`mt-0.5 size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                checked[index] ? 'border-[#2970FF] bg-[#2970FF]' : 'border-[#C5C6CC] bg-white'
              }`}>
              {checked[index] ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : null}
            </View>
            <Text className="min-w-0 flex-1 text-sm font-normal leading-6 tracking-[0.12px] text-[#1F2024]">
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
