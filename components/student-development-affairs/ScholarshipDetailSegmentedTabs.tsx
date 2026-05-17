import { Pressable, Text, View } from 'react-native';

export type ScholarshipDetailTab = 'requirements' | 'eligibility';

export type ScholarshipDetailSegmentedTabsProps = {
  active: ScholarshipDetailTab;
  onChange: (tab: ScholarshipDetailTab) => void;
};

/** Figma 713:10347 / 713:10389 — pill switcher. */
export function ScholarshipDetailSegmentedTabs({ active, onChange }: ScholarshipDetailSegmentedTabsProps) {
  return (
    <View className="min-h-[44px] w-full flex-row items-center rounded-2xl bg-[#F8F9FE] p-1">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'requirements' }}
        onPress={() => onChange('requirements')}
        className={`min-h-0 flex-1 items-center justify-center rounded-xl px-3 py-2.5 ${
          active === 'requirements' ? 'bg-white' : ''
        }`}>
        <Text
          className={`text-sm font-bold ${active === 'requirements' ? 'text-[#181D27]' : 'text-[#71727A]'}`}>
          Requirements
        </Text>
      </Pressable>
      <View className="h-6 w-px bg-[#D4D6DD]" />
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'eligibility' }}
        onPress={() => onChange('eligibility')}
        className={`min-h-0 flex-1 items-center justify-center rounded-xl px-3 py-2.5 ${
          active === 'eligibility' ? 'bg-white' : ''
        }`}>
        <Text
          className={`text-sm font-bold ${active === 'eligibility' ? 'text-[#181D27]' : 'text-[#71727A]'}`}>
          Eligibility List
        </Text>
      </Pressable>
    </View>
  );
}
