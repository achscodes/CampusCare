import { Text, View } from 'react-native';

import { IconsaxMedalIcon } from '@/components/icons/IconsaxMedalIcon';

export type ScholarshipCardHeaderProps = {
  title: string;
  categoryLabel: string;
};

/** Title + category sized for comfortable reading on large iPhones (e.g. Pro Max). */
export function ScholarshipCardHeader({ title, categoryLabel }: ScholarshipCardHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 pb-3 pt-1">
      <View className="items-center justify-center rounded-full bg-white p-2.5">
        <IconsaxMedalIcon size={24} color="#E8A317" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-lg font-semibold capitalize leading-6 text-[#181D27]">{title}</Text>
        <Text className="mt-0.5 text-[15px] font-normal leading-5 text-[#535862]">{categoryLabel}</Text>
      </View>
    </View>
  );
}
