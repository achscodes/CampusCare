import { Text, View } from 'react-native';

import { IconsaxHourglassIcon } from '@/components/icons/IconsaxHourglassIcon';

const BG = '#DCFAE6';
const FG = '#079455';

export type SanctionInReviewBadgeProps = {
  /** Override label if needed */
  label?: string;
};

/**
 * “In review” status pill (Figma node 462:2932) — success tint + hourglass icon.
 */
export function SanctionInReviewBadge({ label = 'In review' }: SanctionInReviewBadgeProps) {
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: BG }}>
      <IconsaxHourglassIcon size={16} color={FG} />
      <Text style={{ fontSize: 12, fontWeight: '600', lineHeight: 16, color: FG }}>
        {label}
      </Text>
    </View>
  );
}
