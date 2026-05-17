import { Pressable, Text, View } from 'react-native';

import { CalendarSearchIcon } from '@/components/icons/CalendarSearchIcon';
import { DiscountShapeIcon } from '@/components/icons/DiscountShapeIcon';
import { IconsaxMedalStarFilledIcon } from '@/components/icons/IconsaxMedalStarFilledIcon';
import { IconsaxProfileIcon } from '@/components/icons/IconsaxProfileIcon';

export type ScholarshipCardStatus = 'closing_soon' | 'limited_slots' | 'high_demand' | 'open';

export type ScholarshipCardProps = {
  title: string;
  academicYear: string;
  term: string;
  slotsLeft: number;
  tuitionPercent: number;
  miscPercent: number;
  minGpa: number | null;
  closeDate: string;
  applicationCount: number;
  status: ScholarshipCardStatus;
  onPress?: () => void;
};

const STATUS_CONFIG: Record<
  ScholarshipCardStatus,
  { label: string; bg: string; text: string } | null
> = {
  closing_soon: { label: 'Closing Soon', bg: '#FEF3F2', text: '#F04438' },
  limited_slots: { label: 'Limited Slots', bg: '#EAF2FF', text: '#2970FF' },
  high_demand: { label: 'High Demand', bg: '#FFFAEB', text: '#F79009' },
  open: null,
};

/** Redesigned scholarship card per Figma – horizontal layout with status badge. */
export function ScholarshipCard({
  title,
  academicYear,
  term,
  slotsLeft,
  tuitionPercent,
  miscPercent,
  minGpa,
  closeDate,
  applicationCount,
  status,
  onPress,
}: ScholarshipCardProps) {
  const badge = STATUS_CONFIG[status];

  return (
    <Pressable onPress={onPress} className="w-full active:opacity-80">
      {/* Outer wrapper matches Figma: bg-[#FAFAFA] with padding */}
      <View className="rounded-[16px] bg-[#FAFAFA] pb-3 pt-1 px-1">
        {/* Inner white card */}
        <View className="rounded-[16px] border border-[#F5F5F5] bg-white px-4 py-3">

          {/* Row 1: Medal + Title + Slots */}
          <View className="flex-row items-center gap-1">
            <View className="h-10 w-10 items-center justify-center rounded-full overflow-hidden">
              <IconsaxMedalStarFilledIcon size={24} color="#5B8AF5" />
            </View>

            <View className="min-w-0 flex-1 pl-1">
              <Text
                className="text-[16px] font-medium leading-5 text-[#181D27]"
                numberOfLines={1}
                style={{ letterSpacing: -0.32 }}>
                {title}
              </Text>
              <Text className="mt-0.5 text-[14px] text-[#717680]" style={{ letterSpacing: -0.28 }}>
                AY {academicYear} • {term}
              </Text>
            </View>

            <View className="shrink-0 flex-row items-end gap-0.5">
              <Text className="text-[20px] font-normal text-[#252B37]" style={{ letterSpacing: -2.4 }}>
                {slotsLeft}{' '}
              </Text>
              <Text className="text-[16px] font-normal text-[#717680] mb-0.5" style={{ letterSpacing: -0.64 }}>
                /slots
              </Text>
            </View>
          </View>

          {/* Row 2: Info Pills - white bg with border like Figma */}
          <View className="mt-4 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-[12px] border border-[#F5F5F5] bg-white px-3 py-1">
              <DiscountShapeIcon size={14} color="#717680" />
              <Text className="text-[12px] font-medium text-[#252B37]" style={{ letterSpacing: -0.24 }}>
                {tuitionPercent}% Tuition Fee
              </Text>
            </View>
            {minGpa != null ? (
              <View className="rounded-[12px] border border-[#F5F5F5] bg-white px-3 py-1">
                <Text className="text-[12px] font-medium text-[#252B37]" style={{ letterSpacing: -0.24 }}>
                  <Text className="text-[#717680]">Min GPA: </Text>
                  {minGpa}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Bottom row: outside inner card, inside outer wrapper */}
        <View className="mt-2 flex-row items-center justify-between px-3">
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <CalendarSearchIcon size={14} color="#717680" />
              <Text className="text-[12px] text-[#717680]" style={{ letterSpacing: -0.48 }}>
                {closeDate}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <IconsaxProfileIcon size={14} color="#717680" />
              <Text className="text-[12px] text-[#717680]" style={{ letterSpacing: -0.48 }}>
                {applicationCount} application
              </Text>
            </View>
          </View>

          {badge ? (
            <View
              style={{ backgroundColor: badge.bg }}
              className="rounded-[12px] px-3 py-2">
              <Text style={{ color: badge.text, letterSpacing: -0.24 }} className="text-[12px] font-medium">
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
