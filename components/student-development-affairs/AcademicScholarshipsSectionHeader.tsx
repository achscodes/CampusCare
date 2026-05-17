import { Pressable, Text, View } from 'react-native';

export type AcademicScholarshipsSectionHeaderProps = {
  onSeeAllPress?: () => void;
};

export function AcademicScholarshipsSectionHeader({
  onSeeAllPress,
}: AcademicScholarshipsSectionHeaderProps) {
  return (
    <View className="w-full flex-row items-center justify-between">
      <Text className="text-lg font-semibold leading-6 tracking-[0.08px] text-[#1F2024]">
        Academic Scholarships
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See all scholarships"
        hitSlop={10}
        onPress={onSeeAllPress}
        className="active:opacity-70">
        <Text className="text-sm font-medium leading-5 tracking-[0.12px] text-[#2970FF]">See All</Text>
      </Pressable>
    </View>
  );
}
