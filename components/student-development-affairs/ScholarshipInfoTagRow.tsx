import { Text, View } from 'react-native';

import { IconsaxBookSavedIcon } from '@/components/icons/IconsaxBookSavedIcon';
import { IconsaxTeacherFilledIcon } from '@/components/icons/IconsaxTeacherFilledIcon';

const TAG_TEXT = '#2970FF';

export type ScholarshipInfoTagRowProps = {
  discountLabel: string;
  scheduleLabel: string;
};

/** Info chips — 13px body so labels stay legible next to larger titles. */
export function ScholarshipInfoTagRow({ discountLabel, scheduleLabel }: ScholarshipInfoTagRowProps) {
  return (
    <View className="flex-row items-stretch gap-3 rounded-lg bg-[#EFF4FF] px-2 py-2">
      <View className="flex-row items-center gap-2">
        <IconsaxTeacherFilledIcon size={18} color={TAG_TEXT} />
        <Text className="text-[13px] capitalize leading-5 text-[#00359E]">{discountLabel}</Text>
      </View>
      <View className="w-px self-stretch bg-[#D4D6DD]" />
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <IconsaxBookSavedIcon size={16} color={TAG_TEXT} />
        <Text
          className="min-w-0 flex-1 text-[13px] capitalize leading-5 text-[#00359E]"
          numberOfLines={2}>
          {scheduleLabel}
        </Text>
      </View>
    </View>
  );
}
