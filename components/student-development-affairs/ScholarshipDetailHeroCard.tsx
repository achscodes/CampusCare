import { Text, View } from 'react-native';

import { IconsaxMedalFilledIcon } from '@/components/icons/IconsaxMedalFilledIcon';

export type ScholarshipDetailHeroCardProps = {
  sponsorLabel: string;
  title: string;
  aboutTitle?: string;
  aboutBody: string;
};

/** Figma 713:10322 — brand-600 hero + medal + about copy. */
export function ScholarshipDetailHeroCard({
  sponsorLabel,
  title,
  aboutTitle = 'About',
  aboutBody,
}: ScholarshipDetailHeroCardProps) {
  return (
    <View className="w-full gap-3.5 rounded-xl bg-[#155EEF] px-4 py-5">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[0.08em] text-[#B2CCFF]">
          {sponsorLabel}
        </Text>
        <View className="flex-row flex-wrap items-center gap-1">
          <Text className="text-2xl font-bold capitalize leading-8 text-white">{title}</Text>
          <IconsaxMedalFilledIcon size={30} color="#FFFFFF" />
        </View>
      </View>
      <View className="h-px w-full bg-white/35" />
      <View className="gap-2">
        <Text className="text-sm font-semibold text-white">{aboutTitle}</Text>
        <Text className="text-sm font-normal leading-5 text-white/95">{aboutBody}</Text>
      </View>
    </View>
  );
}
