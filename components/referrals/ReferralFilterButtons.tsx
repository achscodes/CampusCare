import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCHEDULE_PARTNER } from '@/lib/ui/theme';

const T = SCHEDULE_PARTNER;

export type FilterOption = {
  key: string;
  label: string;
  count: number;
};

export type ReferralFilterButtonsProps = {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
};

export function ReferralFilterButtons({
  filters,
  activeFilter,
  onFilterChange,
}: ReferralFilterButtonsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 44 }}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
      }}>
      {filters.map((filter) => {
        const isActive = filter.key === activeFilter;
        
        return (
          <Pressable
            key={filter.key}
            onPress={() => onFilterChange(filter.key)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isActive ? T.brand : '#E5E7EB',
              backgroundColor: isActive 
                ? T.brand 
                : pressed 
                  ? T.segmentTrackBg 
                  : '#F9FAFB',
              opacity: isActive ? 1 : 0.7,
            })}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: isActive ? '#FFFFFF' : '#9CA3AF',
                marginRight: 6,
              }}>
              {filter.label}
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                backgroundColor: isActive 
                  ? 'rgba(255, 255, 255, 0.2)' 
                  : T.segmentTrackBg,
              }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isActive ? '#FFFFFF' : '#9CA3AF',
                }}>
                {filter.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
