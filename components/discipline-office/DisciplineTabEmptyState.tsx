import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export type DisciplineTabEmptyVariant = 'case' | 'sanctions';

const COPY: Record<
  DisciplineTabEmptyVariant,
  { title: string; body: string; icon: keyof typeof Ionicons.glyphMap; iconLabel: string }
> = {
  case: {
    title: 'No active case',
    body:
      'You don’t have any discipline cases on file right now. If you expected to see something here or need help, reach out to the Discipline Office.',
    icon: 'document-text-outline',
    iconLabel: 'No case document',
  },
  sanctions: {
    title: 'No sanctions on your record',
    body:
      'There are no sanctions linked to your student profile. Staying within campus policies helps keep it that way — we’re here if you ever have questions.',
    icon: 'shield-checkmark-outline',
    iconLabel: 'Clear record',
  },
};

export type DisciplineTabEmptyStateProps = {
  variant: DisciplineTabEmptyVariant;
};

/**
 * Friendly empty state for Discipline Office tab panels (no case / no sanctions).
 */
export function DisciplineTabEmptyState({ variant }: DisciplineTabEmptyStateProps) {
  const { title, body, icon, iconLabel } = COPY[variant];

  return (
    <View className="flex-1 justify-center py-8">
      <View className="items-center rounded-2xl bg-[#F8F9FE] px-6 py-10">
        <View
          accessibilityLabel={iconLabel}
          className="mb-5 size-14 items-center justify-center rounded-2xl bg-[#EFF4FF]"
          importantForAccessibility="yes">
          <Ionicons name={icon} size={32} color="#2970FF" />
        </View>
        <Text className="text-center text-lg font-semibold leading-6 text-[#1F2024]">{title}</Text>
        <Text className="mt-3 text-center text-sm font-normal leading-5 text-[#71727A]">{body}</Text>
        <View className="mt-6 flex-row items-center gap-2 rounded-full bg-white/80 px-4 py-2">
          <Ionicons name="information-circle-outline" size={18} color="#006FFD" />
          <Text className="max-w-[260px] flex-1 text-xs leading-4 text-[#535862]">
            Need support? Open the menu and contact your campus Discipline Office.
          </Text>
        </View>
      </View>
    </View>
  );
}
